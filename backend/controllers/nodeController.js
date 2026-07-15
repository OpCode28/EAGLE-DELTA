
const { db } = require("../config/database");
const http = require("http");

/**
 * Get all registered nodes
 */
function getAllNodes(req, res) {
  const nodes = db.prepare("SELECT * FROM devices ORDER BY mac_address ASC").all();
  // #region debug-point E:nodes-list
  (() => { let u = "http://127.0.0.1:7777/event", s = "esp32-csi-offline"; try { const e = require("fs").readFileSync(".dbg/esp32-csi-offline.env", "utf8"); u = e.match(/DEBUG_SERVER_URL=(.+)/)?.[1] || u; s = e.match(/DEBUG_SESSION_ID=(.+)/)?.[1] || s; } catch {} fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: s, runId: "pre-fix", hypothesisId: "E", location: "backend/controllers/nodeController.js:getAllNodes", msg: "[DEBUG] node list requested", data: { count: nodes.length, node_keys: nodes.map((node) => node.mac_address) }, ts: Date.now() }) }).catch(() => {}); })();
  // #endregion
  return res.json({ ok: true, nodes });
}

/**
 * Get a single node by node_key
 */
function getNode(req, res) {
  const mac_address = req.params.mac_address || req.params.node_key;
  const node = db.prepare("SELECT * FROM devices WHERE mac_address = ?").get(mac_address);
  if (!node) {
    return res.status(404).json({ ok: false, error: "Node not found" });
  }
  return res.json({ ok: true, node });
}

/**
 * Update node information (label, room, etc.)
 */
function updateNode(req, res) {
  const mac_address = req.params.mac_address || req.params.node_key;
  const { name } = req.body;

  const existing = db.prepare("SELECT * FROM devices WHERE mac_address = ?").get(mac_address);
  if (!existing) {
    return res.status(404).json({ ok: false, error: "Node not found" });
  }

  db.prepare(`
    UPDATE devices
    SET name = COALESCE(?, name)
    WHERE mac_address = ?
  `).run(name, mac_address);

  const updated = db.prepare("SELECT * FROM devices WHERE mac_address = ?").get(mac_address);
  return res.json({ ok: true, node: updated });
}

/**
 * Update node spatial position
 */
function updatePosition(req, res) {
  const mac_address = req.params.mac_address || req.params.node_key;
  const { pos_x, pos_y, pos_z } = req.body;

  const existing = db.prepare("SELECT * FROM devices WHERE mac_address = ?").get(mac_address);
  if (!existing) {
    return res.status(404).json({ ok: false, error: "Node not found" });
  }

  db.prepare(`
    UPDATE devices
    SET pos_x = ?, pos_y = ?, pos_z = ?
    WHERE mac_address = ?
  `).run(pos_x, pos_y, pos_z, mac_address);

  const updated = db.prepare("SELECT * FROM devices WHERE mac_address = ?").get(mac_address);
  return res.json({ ok: true, node: updated });
}

/**
 * Trigger identify LED blink on the physical node
 */
function identifyNode(req, res) {
  const mac_address = req.params.mac_address || req.params.node_key;
  const node = db.prepare("SELECT * FROM devices WHERE mac_address = ?").get(mac_address);
  
  if (!node) {
    return res.status(404).json({ ok: false, error: "Node not found" });
  }
  if (!node.ip_address || node.status !== "online") {
    return res.status(400).json({ ok: false, error: "Node is offline or has no IP address" });
  }

  // Proxy the request to the physical ESP32 node
  const options = {
    hostname: node.ip_address,
    port: 80,
    path: '/identify',
    method: 'POST',
    timeout: 3000
  };

  const proxyReq = http.request(options, (proxyRes) => {
    let data = '';
    proxyRes.on('data', chunk => data += chunk);
    proxyRes.on('end', () => {
      if (proxyRes.statusCode === 200) {
        return res.json({ ok: true, message: "Identify triggered" });
      } else {
        return res.status(500).json({ ok: false, error: "Node responded with error" });
      }
    });
  });

  proxyReq.on('error', (err) => {
    console.error(`[eagle-delta] Proxy error to ${node.ip_address}:`, err.message);
    return res.status(500).json({ ok: false, error: "Failed to connect to physical node" });
  });

  proxyReq.end();
}

/**
 * Delete a node
 */
function deleteNode(req, res) {
  const mac_address = req.params.mac_address || req.params.node_key;
  db.prepare("DELETE FROM raw_csi WHERE mac_address = ?").run(mac_address);
  db.prepare("DELETE FROM processed_features WHERE mac_address = ?").run(mac_address);
  db.prepare("DELETE FROM devices WHERE mac_address = ?").run(mac_address);
  return res.json({ ok: true });
}

/**
 * Get telemetry history for a specific node
 */
function getNodeHistory(req, res) {
  const mac_address = req.params.mac_address || req.params.node_key;
  const { limit = 100, offset = 0 } = req.query;

  const history = db.prepare(`
    SELECT * FROM processed_features
    WHERE mac_address = ?
    ORDER BY timestamp DESC
    LIMIT ?
    OFFSET ?
  `).all(mac_address, limit, offset).map(row => ({
    ...row,
    ai_presence: !!row.ai_presence,
    pose: row.pose_json ? JSON.parse(row.pose_json) : null
  }));

  const total = db.prepare(`
    SELECT COUNT(*) AS count FROM processed_features WHERE mac_address = ?
  `).get(mac_address).count;

  return res.json({ ok: true, history, total });
}

module.exports = {
  getAllNodes,
  getNode,
  updateNode,
  deleteNode,
  getNodeHistory,
  updatePosition,
  identifyNode,
};
