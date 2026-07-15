// eagle-delta/controllers/telemetryController.js
// Receives structured JSON telemetry from HTTP POST or UDP,
// performs sequence tracking to measure packet loss,
// buffers database inserts to avoid blocking the event loop,
// and streams live updates via the zero-delay SSE event bus.

const { db } = require("../config/database");
const bus = require("../events");
const pyBridge = require("../processors/pyBridge");

// Database Prepared Statements
const upsertNode = db.prepare(`
  INSERT INTO devices (mac_address, name, ip_address, status, last_seen)
  VALUES (@mac_address, @name, @ip_address, 'online', datetime('now'))
  ON CONFLICT(mac_address) DO UPDATE SET ip_address = @ip_address, last_seen = datetime('now'), status = 'online'
`);

const recentTelemetry = db.prepare(`
  SELECT * FROM processed_features
  ORDER BY id DESC
  LIMIT ?
`);

// Memory Buffers for Write Coalescing (Write Buffering)
let rawCsiQueue = [];
let processedQueue = [];

// Bulk Insert Transactions (Executed every 2 seconds)
const insertRawBatch = db.transaction((rows) => {
  const stmt = db.prepare(`
    INSERT INTO raw_csi (mac_address, timestamp_us, sequence, rssi, csi_matrix)
    VALUES (@mac_address, @timestamp_us, @sequence, @rssi, @csi_matrix)
  `);
  for (const row of rows) {
    stmt.run(row);
  }
});

const insertProcessedBatch = db.transaction((rows) => {
  const stmt = db.prepare(`
    INSERT INTO processed_features (mac_address, ai_presence, ai_occupancy_count, ai_activity, heart_rate_bpm, resp_rate_rpm, pose_json, vital_confidence, inference_time_ms)
    VALUES (@mac_address, @ai_presence, @ai_occupancy_count, @ai_activity, @heart_rate_bpm, @resp_rate_rpm, @pose_json, @vital_confidence, @inference_time_ms)
  `);
  for (const row of rows) {
    stmt.run(row);
  }
});

// Periodic database flush (every 2 seconds)
setInterval(() => {
  if (rawCsiQueue.length > 0) {
    try {
      insertRawBatch(rawCsiQueue);
      rawCsiQueue = [];
    } catch (err) {
      console.error("[eagle-delta] Error flushing raw CSI batch:", err.message);
    }
  }
  if (processedQueue.length > 0) {
    try {
      insertProcessedBatch(processedQueue);
      processedQueue = [];
    } catch (err) {
      console.error("[eagle-delta] Error flushing processed features batch:", err.message);
    }
  }
}, 2000);

// Sequence Tracking & Network Packet Loss Metrics
const nodeStats = new Map(); // node_key -> { lastSeq, received, dropped, outOfOrder }

function trackPacket(nodeKey, seq) {
  if (seq === undefined || seq === null) return;
  
  if (!nodeStats.has(nodeKey)) {
    nodeStats.set(nodeKey, {
      lastSeq: seq,
      received: 1,
      dropped: 0,
      outOfOrder: 0
    });
    console.log(`[eagle-delta] [Network Log] First packet from ${nodeKey}: seq=${seq}`);
    return;
  }
  
  const stats = nodeStats.get(nodeKey);
  stats.received++;
  
  const diff = seq - stats.lastSeq;
  if (diff > 1) {
    const lost = diff - 1;
    stats.dropped += lost;
    console.warn(`[eagle-delta] [Network Log] Node ${nodeKey} packet loss detected: lost ${lost} packets. seq=${seq}, last_seq=${stats.lastSeq}`);
  } else if (diff < 1 && diff !== -stats.lastSeq) {
    stats.outOfOrder++;
    console.warn(`[eagle-delta] [Network Log] Node ${nodeKey} out-of-order packet: seq=${seq}, last_seq=${stats.lastSeq}`);
  }
  
  stats.lastSeq = seq;
}

/**
 * Common ingestion pipeline for both HTTP POST and UDP
 */
async function processTelemetry(payload, clientIp) {
  const {
    node_key,
    label = "eagle-delta-node",
    presence = false,
    sequence = null,
    timestamp_us = null,
    rssi = 0,
    heart_rate_bpm: heartRateIn = null,
    resp_rate_rpm: respRateIn = null,
    pose: poseIn = null,
    csi_matrix = null,
    sample_rate_hz = 20.0,
  } = payload;

  const mac_address = node_key;
  const name = label;

  if (!mac_address) {
    return { ok: false, error: "mac_address (or node_key) is required" };
  }

  // 1. Logging and Packet Loss Measurement (Before AI processing)
  trackPacket(mac_address, sequence);

  let heart_rate_bpm = heartRateIn;
  let resp_rate_rpm = respRateIn;
  let pose = poseIn;
  let people_count = 0;
  let gait_behavior = "Empty";
  let final_presence = presence;
  let vital_confidence = 0.0;
  let inference_time_ms = 0.0;

  // 2. Queue Raw CSI measurements for permanent separate storage
  if (Array.isArray(csi_matrix) && csi_matrix.length > 0) {
    rawCsiQueue.push({
      mac_address,
      timestamp_us: timestamp_us || 0,
      sequence: sequence || 0,
      rssi: rssi || 0,
      csi_matrix: JSON.stringify(csi_matrix)
    });

    // 3. AI Inference & Feature Processing
    const startAi = Date.now();
    const dspResult = await pyBridge.runProcessor(csi_matrix, sample_rate_hz);
    inference_time_ms = Date.now() - startAi;

    if (dspResult) {
      heart_rate_bpm = dspResult.heart_rate_bpm;
      resp_rate_rpm = dspResult.resp_rate_rpm;
      pose = dspResult.pose;
      people_count = dspResult.people_count;
      gait_behavior = dspResult.gait_behavior;
      final_presence = dspResult.presence !== undefined ? dspResult.presence : presence;
      vital_confidence = dspResult.vital_confidence || 0.0;
    } else {
      console.warn(`[eagle-delta] DSP engine unavailable for ${mac_address}, using provided fields`);
    }
  }

  // 4. Update Node Status & Client IP in Devices table
  upsertNode.run({ mac_address, name, ip_address: clientIp });

  // 5. Queue Processed features for separate storage
  processedQueue.push({
    mac_address,
    ai_presence: final_presence ? 1 : 0,
    ai_occupancy_count: people_count,
    ai_activity: gait_behavior,
    heart_rate_bpm,
    resp_rate_rpm,
    pose_json: pose ? JSON.stringify(pose) : null,
    vital_confidence,
    inference_time_ms
  });

  // 6. Compute movement score based on temporal variance across the batch of samples
  let movement_score = 0;
  if (Array.isArray(csi_matrix) && csi_matrix.length > 1 && Array.isArray(csi_matrix[0])) {
    const numSamples = csi_matrix.length;
    const numSubcarriers = csi_matrix[0].length;
    let totalVar = 0;
    
    for (let c = 0; c < numSubcarriers; c++) {
      let colSum = 0;
      for (let r = 0; r < numSamples; r++) {
        colSum += csi_matrix[r][c] || 0;
      }
      const colMean = colSum / numSamples;
      
      let colVar = 0;
      for (let r = 0; r < numSamples; r++) {
        colVar += ((csi_matrix[r][c] || 0) - colMean) ** 2;
      }
      totalVar += colVar / numSamples;
    }
    
    const avgStd = Math.sqrt(totalVar / numSubcarriers);
    movement_score = Math.min(100, Math.round(avgStd * 50)); // Scale to 0-100%
  }

  const record = {
    mac_address,
    timestamp: new Date().toISOString(),
    ai_presence: !!final_presence,
    heart_rate_bpm,
    resp_rate_rpm,
    pose,
    ai_occupancy_count: people_count,
    ai_activity: gait_behavior,
    csi_matrix: csi_matrix,
    rssi,
    sequence,
    timestamp_us,
    movement_score,
    inference_time_ms
  };

  // Push straight to any subscribed Netra32 SSE clients
  bus.emit("telemetry", record);

  return { ok: true, record };
}

/**
 * Express HTTP POST Ingest endpoint
 */
async function ingest(req, res) {
  const clientIp = req.ip || (req.socket ? req.socket.remoteAddress : "127.0.0.1") || "127.0.0.1";
  const result = await processTelemetry(req.body || {}, clientIp);
  if (!result.ok) {
    return res.status(400).json(result);
  }
  return res.status(201).json(result);
}

/**
 * UDP Ingest router helper
 */
async function ingestUdp(payload, clientIp) {
  try {
    await processTelemetry(payload, clientIp);
  } catch (err) {
    console.error("[eagle-delta] UDP Ingestion pipeline crashed:", err.message);
  }
}

/**
 * Retrieve recent telemetry runs
 */
function getRecent(req, res) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000);
  const rows = recentTelemetry.all(limit).map((row) => ({
    ...row,
    ai_presence: !!row.ai_presence,
    pose: row.pose_json ? JSON.parse(row.pose_json) : null,
  }));
  return res.json({ ok: true, count: rows.length, rows });
}

module.exports = { ingest, ingestUdp, getRecent, nodeStats };
