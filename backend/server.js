// eagle-delta/server.js
// Entry point for the eagle-delta backend. Fully offline: no external
// CDN calls, no outbound network requests, local SQLite only.

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const Bonjour = require("bonjour-service");
const bonjour = new Bonjour();

const { initSchema } = require("./config/database");
initSchema();

const netra32Routes = require("./routes/netra32Routes");

const PORT = process.env.EAGLE_DELTA_PORT || 4032;

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));

app.use("/api/netra32", netra32Routes);

app.get("/", (req, res) => {
  res.json({ ok: true, service: "eagle-delta backend", dashboard: "Netra32" });
});

app.use((err, req, res, next) => {
  console.error("[eagle-delta] unhandled error:", err);
  res.status(500).json({ ok: false, error: "internal server error" });
});

const serverInstance = app.listen(PORT, () => {
  console.log(`[eagle-delta] backend listening on http://localhost:${PORT}`);
  console.log("[eagle-delta] Netra32 SSE stream: /api/netra32/telemetry/stream");
  
  bonjour.publish({ name: 'eagle-delta-backend', type: 'eagle', port: PORT });
  console.log("[eagle-delta] mDNS service _eagle._tcp.local advertised");
});

// Setup UDP Telemetry Socket on port 3021 for wireless offline streaming
const dgram = require("dgram");
const udpServer = dgram.createSocket("udp4");
const { ingestUdp } = require("./controllers/telemetryController");

udpServer.on("message", (msg, rinfo) => {
  try {
    const dataStr = msg.toString("utf8").trim();
    if (!dataStr) return;

    let payload = {};
    if (dataStr.startsWith("{")) {
      payload = JSON.parse(dataStr);
    } else if (dataStr.startsWith("CSI_DATA,")) {
      // Expected CSV format: CSI_DATA,node_id,seq,timestamp_us,rssi,channel,sig_mode,mcs,cwb,stbc,len,[csi_data...]
      const parts = dataStr.split(",", 11);
      if (parts.length >= 11) {
        const matrixIndex = dataStr.indexOf("[");
        if (matrixIndex !== -1) {
          const matrixStr = dataStr.substring(matrixIndex).trim();
          const csiArray = JSON.parse(matrixStr);
          payload = {
            node_key: parts[1],
            sequence: parseInt(parts[2], 10),
            timestamp_us: parseInt(parts[3], 10),
            rssi: parseInt(parts[4], 10),
            csi_matrix: [csiArray] // Wrap single array row into a 2D matrix
          };
        }
      }
    }

    if (payload.node_key) {
      ingestUdp(payload, rinfo.address);
    }
  } catch (err) {
    console.error("[eagle-delta] UDP receiver parse error:", err.message);
  }
});

udpServer.on("listening", () => {
  const addr = udpServer.address();
  console.log(`[eagle-delta] UDP Telemetry receiver listening on ${addr.address}:${addr.port}`);
});

udpServer.bind(3021);

// Shutdown handlers
process.on("SIGTERM", () => {
  udpServer.close();
  serverInstance.close(() => process.exit(0));
});

// Periodically mark inactive nodes as offline (15 second timeout)
setInterval(() => {
  try {
    const { db } = require("./config/database");
    db.prepare(`
      UPDATE devices
      SET status = 'offline'
      WHERE datetime(last_seen) < datetime('now', '-15 seconds') AND status = 'online'
    `).run();
  } catch (err) {
    console.error("[eagle-delta] Heartbeat timeout runner error:", err.message);
  }
}, 5000);

