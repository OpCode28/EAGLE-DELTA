import React, { useEffect, useRef, useState } from "react";
import Header from "../components/Header.jsx";
import VitalCard from "../components/VitalCard.jsx";
import RealTimeWaveform from "../components/RealTimeWaveform.jsx";
import PoseFusionViewport from "../components/PoseFusionViewport.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:4032/api/netra32`;
const MAX_POINTS = 120;

export default function DashboardOverview({ token }) {
  const [connected, setConnected] = useState(false);
  const [latest, setLatest] = useState(null);
  const [movementHistory, setMovementHistory] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [dummyRunning, setDummyRunning] = useState(false);
  const eventSourceRef = useRef(null);

  // Fetch nodes on mount
  useEffect(() => {
    const fetchNodes = async () => {
      try {
        const res = await fetch(`${API_BASE}/nodes`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.ok) {
          setNodes(data.nodes);
        }
      } catch (err) {
        console.error("Failed to fetch nodes", err);
      }
    };
    fetchNodes();
  }, [token]);

  useEffect(() => {
    // Zero-delay subscription: the backend pushes each new ESP32 packet
    // the instant it lands, via Server-Sent Events — no polling.
    const es = new EventSource(`${API_BASE}/telemetry/stream`);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.addEventListener("telemetry", (event) => {
      const record = JSON.parse(event.data);
      setLatest(record);
      // Update matching node status dynamically in state (no fetch polling)
      setNodes((prevNodes) =>
        prevNodes.map((n) =>
          n.mac_address === record.mac_address
            ? { ...n, status: "online", last_seen: new Date().toISOString() }
            : n
        )
      );
      setMovementHistory((prev) => {
        const next = [...prev, record.movement_score ?? 0];
        return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
      });
    });

    return () => es.close();
  }, [token]);

  const toggleDummy = async () => {
    try {
      if (dummyRunning) {
        await fetch(`${API_BASE}/test/stop-dummy`, { method: "POST" });
        setDummyRunning(false);
      } else {
        await fetch(`${API_BASE}/test/start-dummy`, { method: "POST" });
        setDummyRunning(true);
      }
    } catch (err) {
      console.error("Failed to toggle dummy telemetry", err);
    }
  };

  return (
    <div>
      <Header
        title="Dashboard"
        subtitle="Ambient intelligence overview · eagle-delta engine"
        connected={connected}
      />

      {/* Dummy Telemetry Toggle */}
      <div style={{ padding: "8px 16px", display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={toggleDummy}
          style={{
            padding: "8px 16px",
            backgroundColor: dummyRunning ? "#dc2626" : "#16a34a",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          {dummyRunning ? "Stop Dummy Telemetry" : "Start Dummy Telemetry"}
        </button>
      </div>

      {/* Connected Nodes */}
      <div style={{ padding: "0 16px", marginBottom: "16px" }}>
        <h3 style={{ color: "#e5e7eb", marginBottom: "12px" }}>
          Connected Nodes ({nodes.length})
        </h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
          {nodes.map((node) => (
            <div
              key={node.mac_address}
              style={{
                padding: "12px",
                backgroundColor: "#1f2937",
                borderRadius: "8px",
                border: "1px solid #374151",
                minWidth: "200px"
              }}
            >
              <div style={{ color: "#10b981", fontWeight: "bold", marginBottom: "4px" }}>
                {node.name || node.label || 'EAGLE Node'}
              </div>
              <div style={{ color: "var(--nt-steel-dim)", fontSize: "12px", marginBottom: "4px" }}>
                MAC: {node.mac_address || node.node_key}
              </div>
              <div style={{ color: "var(--nt-steel-dim)", fontSize: "12px", marginBottom: "4px" }}>
                Status: <span style={{ color: node.status === 'online' ? "var(--nt-iris)" : "var(--nt-warning)" }}>{node.status || 'Offline'}</span>
              </div>
              <div style={{ color: "var(--nt-steel-dim)", fontSize: "12px", marginBottom: "4px" }}>
                Wi-Fi: {node.status === 'online' ? "Connected" : "Disconnected"}
              </div>
              <div style={{ color: "var(--nt-steel-dim)", fontSize: "12px" }}>
                CSI Signal Quality: {node.status === 'online' ? (latest?.csi_signal_quality || "Excellent (98%)") : "N/A"}
              </div>
            </div>
          ))}
          {nodes.length === 0 && (
            <div style={{ color: "#6b7280" }}>
              No nodes connected yet — start dummy telemetry to test!
            </div>
          )}
        </div>
      </div>

      <div className="nt-grid" style={{ marginBottom: 16 }}>
        <VitalCard label="Presence" value={latest ? (latest.ai_presence ? "Detected" : "Clear") : null} />
        <VitalCard label="Occupancy" value={latest?.ai_occupancy_count ?? 0} unit="People" />
        <VitalCard label="Gait Behavior" value={latest?.ai_activity ?? "Empty"} />
        <VitalCard label="Heart Rate" value={latest?.heart_rate_bpm ?? null} unit="BPM" />
        <VitalCard label="Respiratory Rate" value={latest?.resp_rate_rpm ?? null} unit="RPM" />
        <VitalCard label="Movement Score" value={latest?.movement_score ?? null} />
      </div>

      <div className="nt-grid">
        <RealTimeWaveform series={movementHistory} label="Movement Signal (live)" />
        <PoseFusionViewport pose={latest?.pose} peopleCount={latest?.ai_occupancy_count ?? 0} gait={latest?.ai_activity ?? "Empty"} />
      </div>
    </div>
  );
}
