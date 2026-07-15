import React, { useEffect, useRef, useState } from "react";
import Header from "../components/Header.jsx";
import VitalCard from "../components/VitalCard.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:4032/api/netra32`;

export default function PresenceView({ token }) {
  const [connected, setConnected] = useState(false);
  const [latest, setLatest] = useState(null);
  const [presenceHistory, setPresenceHistory] = useState([]);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/telemetry/stream`);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.addEventListener("telemetry", (event) => {
      const record = JSON.parse(event.data);
      setLatest(record);
      setPresenceHistory((prev) => {
        const next = [...prev, { ts: Date.now(), presence: record.ai_presence }];
        return next.length > 60 ? next.slice(next.length - 60) : next;
      });
    });

    return () => es.close();
  }, [token]);

  return (
    <div>
      <Header title="Presence & Occupancy" subtitle="Real-time people counting & activity tracking" connected={connected} />
      
      <div className="nt-grid" style={{ marginBottom: 16 }}>
        <VitalCard 
          label="Presence" 
          value={latest ? (latest.ai_presence ? "Detected" : "Area Clear") : "Waiting..."} 
          color={latest?.ai_presence ? "#10b981" : "#6b7280"}
        />
        <VitalCard label="Occupancy Count" value={latest?.ai_occupancy_count ?? 0} unit="People" />
        <VitalCard label="Activity" value={latest?.ai_activity ?? "Unknown"} />
        <VitalCard label="Movement Score" value={latest?.movement_score ?? 0} />
      </div>

      <div className="nt-card" style={{ padding: 16 }}>
        <h3 style={{ color: "#e5e7eb", marginBottom: "12px" }}>Presence History (Last 60s)</h3>
        <div style={{ 
          height: "100px", 
          display: "flex", 
          gap: "4px", 
          alignItems: "flex-end",
          justifyContent: "center"
        }}>
          {presenceHistory.map((point, i) => (
            <div 
              key={i} 
              style={{
                width: "6px",
                height: `${30 + (point.presence ? 70 : 0)}%`,
                backgroundColor: point.presence ? "#10b981" : "#374151",
                borderRadius: "2px"
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
