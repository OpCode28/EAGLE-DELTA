const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");

function logDebug(msg) {
  try {
    const logDir = path.join(__dirname, "..", "data");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, "pybridge_debug.log");
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (err) {}
}

const SCRIPT_PATH = path.join(__dirname, "signal_processor.py");
const PYTHON_CMD = os.platform() === "win32" ? "python" : "python3";

let pythonProcess = null;
let requestCounter = 0;
const pendingRequests = new Map();
let isReady = false;

function initBridge() {
  if (pythonProcess) return;

  logDebug(`Spawning: ${PYTHON_CMD} with script ${SCRIPT_PATH}`);

  try {
    pythonProcess = spawn(PYTHON_CMD, [SCRIPT_PATH, "--stdin-loop"]);
  } catch (err) {
    logDebug(`Spawn Exception: ${err.message}`);
    return;
  }
  
  let buffer = "";

  pythonProcess.on("error", (err) => {
    logDebug(`Process Error: ${err.message}`);
  });

  pythonProcess.stdout.on("data", (data) => {
    logDebug(`STDOUT: ${data.toString().trim()}`);
    buffer += data.toString();
    let lines = buffer.split("\n");
    buffer = lines.pop(); // Keep incomplete line

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const result = JSON.parse(line);
        if (result.status === "ready") {
          logDebug("AI Engine confirmed READY status.");
          console.log("[eagle-delta] AI Engine ready.");
          isReady = true;
        } else if (result._id !== undefined) {
          const reqId = result._id;
          if (pendingRequests.has(reqId)) {
            const { resolve, timeout } = pendingRequests.get(reqId);
            clearTimeout(timeout); // Clear timeout to prevent memory leak
            pendingRequests.delete(reqId);
            resolve(result);
          }
        }
      } catch (err) {
        logDebug(`JSON parse error on line: ${line} -> ${err.message}`);
        console.error("[eagle-delta] pyBridge stdout parse error:", err.message);
      }
    }
  });

  pythonProcess.stderr.on("data", (data) => {
    logDebug(`STDERR: ${data.toString().trim()}`);
    console.error("[eagle-delta] AI Engine:", data.toString().trim());
  });

  pythonProcess.on("close", (code) => {
    logDebug(`Process EXITED with code ${code}`);
    console.log(`[eagle-delta] AI Engine exited with code ${code}`);
    pythonProcess = null;
    isReady = false;
  });
}

/**
 * @param {number[][]} csiMatrix
 * @param {number} sampleRateHz
 * @returns {Promise<object | null>}
 */
async function runProcessor(csiMatrix, sampleRateHz = 20.0) {
  if (!pythonProcess) {
    initBridge();
  }
  
  if (!isReady) {
    // If it's still loading ML models, we might just fail fast or wait.
    // For now, let's just fail fast to avoid blocking 20Hz stream.
    return null;
  }

  const reqId = requestCounter++;
  const payload = JSON.stringify({
    id: reqId,
    csi_matrix: csiMatrix,
    sample_rate_hz: sampleRateHz
  }) + "\n";

  return new Promise((resolve) => {
    // Timeout to prevent memory leaks if Python crashes silently
    const timeout = setTimeout(() => {
      if (pendingRequests.has(reqId)) {
        pendingRequests.delete(reqId);
        resolve(null);
      }
    }, 2000);

    pendingRequests.set(reqId, { resolve, timeout });
    pythonProcess.stdin.write(payload);
  });
}

// Start the bridge on load so ML models start training immediately
initBridge();

module.exports = { runProcessor };
