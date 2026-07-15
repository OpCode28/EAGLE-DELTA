
import React, { useState, useEffect } from "react";
import Header from "../components/Header";
import { Line, Bar } from "react-chartjs-2";

const API_BASE = import.meta.env.VITE_API_BASE || "http://10.66.191.174:4032/api/netra32";

export default function AnalyticsView({ token }) {
  const [recentTelemetry, setRecentTelemetry] = useState([]);
  const [selectedNode, setSelectedNode] = useState("");
  const [nodeHistory, setNodeHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecent();
  }, []);

  const fetchRecent = async () => {
    try {
      const res = await fetch(`${API_BASE}/telemetry/recent`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setRecentTelemetry(data.telemetry || []);
        if (data.telemetry && data.telemetry.length > 0) {
          setSelectedNode(data.telemetry[0].node_key);
          fetchNodeHistory(data.telemetry[0].node_key);
        }
      }
    } catch (e) {
      console.error("Failed to fetch recent telemetry", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchNodeHistory = async (nodeKey) => {
    try {
      const res = await fetch(`${API_BASE}/nodes/${nodeKey}/history?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setNodeHistory(data.history.reverse()); // show oldest first in charts
      }
    } catch (e) {
      console.error("Failed to fetch node history", e);
    }
  };

  const uniqueNodes = [...new Set(recentTelemetry.map((t) => t.node_key))];

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        Loading analytics...
      </div>
    );
  }

  const hrData = {
    labels: nodeHistory.map((h) => new Date(h.ts).toLocaleTimeString()),
    datasets: [
      {
        label: "Heart Rate (BPM)",
        data: nodeHistory.map((h) => h.heart_rate_bpm),
        borderColor: "#ff6b6b",
        backgroundColor: "rgba(255,107,107,0.2)",
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const rrData = {
    labels: nodeHistory.map((h) => new Date(h.ts).toLocaleTimeString()),
    datasets: [
      {
        label: "Respiratory Rate (RPM)",
        data: nodeHistory.map((h) => h.resp_rate_rpm),
        borderColor: "#4ecdc4",
        backgroundColor: "rgba(78,205,196,0.2)",
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const activityData = {
    labels: nodeHistory.map((h) => new Date(h.ts).toLocaleTimeString()),
    datasets: [
      {
        label: "Movement Score",
        data: nodeHistory.map((h) => h.movement_score),
        borderColor: "#a855f7",
        backgroundColor: "rgba(168,85,247,0.2)",
        tension: 0.3,
        fill: true,
      },
    ],
  };

  return (
    <div>
      <Header title="Analytics & Reports" subtitle="View historical telemetry data" />
      <div style={{ padding: "1rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ marginRight: "0.5rem" }}>Select Node: </label>
          <select
            value={selectedNode}
            onChange={(e) => {
              setSelectedNode(e.target.value);
              fetchNodeHistory(e.target.value);
            }}
            style={{
              padding: "0.5rem",
              background: "#111",
              border: "1px solid #333",
              borderRadius: "4px",
              color: "white",
            }}
          >
            {uniqueNodes.map((nodeKey) => (
              <option key={nodeKey} value={nodeKey}>
                {nodeKey}
              </option>
            ))}
          </select>
        </div>

        <div className="nt-grid">
          <div>
            <h3 style={{ marginBottom: "1rem" }}>Heart Rate Trend</h3>
            <Line data={hrData} options={{ responsive: true }} />
          </div>
          <div>
            <h3 style={{ marginBottom: "1rem" }}>Respiratory Rate Trend</h3>
            <Line data={rrData} options={{ responsive: true }} />
          </div>
        </div>

        <div style={{ marginTop: "1.5rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>Movement Score</h3>
          <Line data={activityData} options={{ responsive: true }} />
        </div>

        <div style={{ marginTop: "1.5rem" }}>
          <h3 style={{ marginBottom: "1rem" }}>Recent Records ({nodeHistory.length} samples)</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #333" }}>
                  <th style={{ textAlign: "left", padding: "0.75rem" }}>Time</th>
                  <th style={{ textAlign: "left", padding: "0.75rem" }}>Presence</th>
                  <th style={{ textAlign: "left", padding: "0.75rem" }}>Activity</th>
                  <th style={{ textAlign: "left", padding: "0.75rem" }}>HR</th>
                  <th style={{ textAlign: "left", padding: "0.75rem" }}>RR</th>
                  <th style={{ textAlign: "left", padding: "0.75rem" }}>People</th>
                </tr>
              </thead>
              <tbody>
                {nodeHistory.slice().reverse().map((record, idx) => (
                  <tr key={record.id} style={{ borderBottom: "1px solid #333" }}>
                    <td style={{ padding: "0.75rem" }}>
                      {new Date(record.ts).toLocaleString()}
                    </td>
                    <td style={{ padding: "0.75rem" }}>
                      {record.ai_presence ? (
                        <span style={{ color: "#4ade80" }}>✓ Present</span>
                      ) : (
                        <span style={{ color: "#9ca3af" }}>— Empty</span>
                      )}
                    </td>
                    <td style={{ padding: "0.75rem" }}>{record.ai_activity}</td>
                    <td style={{ padding: "0.75rem" }}>
                      {record.heart_rate_bpm ? `${record.heart_rate_bpm} BPM` : "—"}
                    </td>
                    <td style={{ padding: "0.75rem" }}>
                      {record.resp_rate_rpm ? `${record.resp_rate_rpm} RPM` : "—"}
                    </td>
                    <td style={{ padding: "0.75rem" }}>{record.ai_occupancy_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
