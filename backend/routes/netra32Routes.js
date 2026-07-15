// eagle-delta/routes/netra32Routes.js
// All HTTP + SSE routes consumed by the Netra32 frontend and the
// eagle_delta_node ESP32 firmware.

const express = require("express");
const router = express.Router();
const bus = require("../events");

const { login, register, getWifiCreds, verifyToken } = require("../controllers/authController");
const { ingest, getRecent } = require("../controllers/telemetryController");
const {
  getAllNodes,
  getNode,
  updateNode,
  deleteNode,
  getNodeHistory,
  updatePosition,
  identifyNode,
} = require("../controllers/nodeController");

// --- Auth -----------------------------------------------------------
router.post("/auth/login", login);
router.post("/auth/register", register);
router.get("/auth/wifi-creds", verifyToken, getWifiCreds);

// --- Wi-Fi Manager --------------------------------------------------
const { scanNetworks } = require("../controllers/wifiController");
router.get("/wifi/scan", verifyToken, scanNetworks);

// --- Telemetry ingest (called by ESP32 firmware) ---------------------
router.post("/telemetry", ingest);

// --- Telemetry history (called by the dashboard on load) -------------
router.get("/telemetry/recent", verifyToken, getRecent);

// --- Zero-delay live stream -------------------------------------------
// The Netra32 frontend opens this once and receives every new telemetry
// packet the instant the backend receives it from the ESP32 node.
router.get("/telemetry/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write("retry: 2000\n\n");

  const onTelemetry = (record) => {
    res.write(`event: telemetry\ndata: ${JSON.stringify(record)}\n\n`);
  };

  bus.on("telemetry", onTelemetry);

  req.on("close", () => {
    bus.off("telemetry", onTelemetry);
  });
});

// --- Test Dummy Telemetry -------------------------------------------
let dummyInterval = null;
router.post("/test/start-dummy", (req, res) => {
  if (dummyInterval) {
    return res.json({ ok: true, message: "Dummy telemetry already running" });
  }

  // Generate dummy CSI matrix
  const generateDummyCsi = () => {
    const csi = [];
    for (let i = 0; i < 20; i++) {
      const subcarriers = [];
      for (let j = 0; j < 30; j++) {
        subcarriers.push(50 + Math.sin(Date.now()/1000 + j) * 20 + Math.random() * 10);
      }
      csi.push(subcarriers);
    }
    return csi;
  };

  // Send dummy telemetry every 500ms
  let nodeKeys = ["dummy-node-1", "dummy-node-2", "dummy-node-3", "dummy-node-4"];
  let idx = 0;
  dummyInterval = setInterval(() => {
    const record = {
      node_key: nodeKeys[idx % 4],
      label: `Dummy Node ${(idx % 4) + 1}`,
      room: "Test Room",
      presence: Math.random() > 0.3,
      movement_score: Math.random() * 100,
      heart_rate_bpm: 60 + Math.random() * 40,
      resp_rate_rpm: 12 + Math.random() * 8,
      people_count: Math.floor(Math.random() * 3),
      gait_behavior: ["Standing", "Sitting", "Walking", "Empty"][Math.floor(Math.random() * 4)],
      pos_x: Math.random(),
      pos_y: Math.random(),
      pos_z: Math.random(),
      csi_matrix: generateDummyCsi(),
      sample_rate_hz: 20
    };

    // Send to telemetry controller
    // Call ingest as if it's a POST request body
    const fakeReq = { body: record };
    const fakeRes = { json: () => {}, status: () => fakeRes };
    ingest(fakeReq, fakeRes);
    idx++;
  }, 500);

  res.json({ ok: true, message: "Dummy telemetry started" });
});

router.post("/test/stop-dummy", (req, res) => {
  if (dummyInterval) {
    clearInterval(dummyInterval);
    dummyInterval = null;
    res.json({ ok: true, message: "Dummy telemetry stopped" });
  } else {
    res.json({ ok: true, message: "Dummy telemetry not running" });
  }
});

router.get("/health", (req, res) => {
  res.json({ ok: true, service: "eagle-delta", ts: new Date().toISOString(), dummyRunning: !!dummyInterval });
});

// --- Node Management --------------------------------------------------
router.get("/nodes", verifyToken, getAllNodes);
router.get("/nodes/:node_key", verifyToken, getNode);
router.put("/nodes/:node_key", verifyToken, updateNode);
router.delete("/nodes/:node_key", verifyToken, deleteNode);
router.put("/nodes/:node_key/position", verifyToken, updatePosition);
router.post("/nodes/:node_key/identify", verifyToken, identifyNode);
router.get("/nodes/:node_key/history", verifyToken, getNodeHistory);

module.exports = router;
