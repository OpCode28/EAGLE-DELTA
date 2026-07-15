
import React, { useState, useEffect } from "react";
import Header from "../components/Header";

const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:4032/api/netra32`;

export default function NodeManagementView({ token }) {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingNode, setEditingNode] = useState(null);
  const [form, setForm] = useState({ name: "" });

  useEffect(() => {
    fetchNodes();
  }, []);

  const fetchNodes = async () => {
    try {
      const res = await fetch(`${API_BASE}/nodes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setNodes(data.nodes);
      }
    } catch (e) {
      console.error("Failed to fetch nodes", e);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (node) => {
    setEditingNode(node.mac_address);
    setForm({ name: node.name || "" });
  };

  const saveEdit = async () => {
    try {
      const res = await fetch(`${API_BASE}/nodes/${editingNode}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      await res.json();
      setEditingNode(null);
      fetchNodes();
    } catch (e) {
      console.error("Failed to update node", e);
    }
  };

  const deleteNode = async (nodeKey) => {
    if (!window.confirm("Are you sure you want to delete this node?")) {
      return;
    }
    try {
      await fetch(`${API_BASE}/nodes/${nodeKey}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchNodes();
    } catch (e) {
      console.error("Failed to delete node", e);
    }
  };

  const identifyNode = async (nodeKey) => {
    try {
      const res = await fetch(`${API_BASE}/nodes/${nodeKey}/identify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.ok) alert(data.error || "Failed to identify node");
    } catch (e) {
      console.error("Identify failed", e);
      alert("Failed to communicate with node");
    }
  };

  const updatePosition = async (nodeKey, x, y) => {
    try {
      await fetch(`${API_BASE}/nodes/${nodeKey}/position`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pos_x: x, pos_y: y, pos_z: 0 }),
      });
      fetchNodes();
    } catch (e) {
      console.error("Failed to update position", e);
    }
  };

  const renderRoomBuilder = () => {
    // A simple 60x20ft ratio box
    return (
      <div style={{ marginTop: "2rem" }}>
        <h3 style={{ marginBottom: "1rem", color: "var(--nt-steel)" }}>Spatial Calibration (Room Builder)</h3>
        <p style={{ color: "var(--nt-steel-dim)", marginBottom: "1rem" }}>
          Drag your nodes into their physical locations to calibrate the AI Tracking Engine. (Assumes 60ft x 20ft room)
        </p>
        <div style={{
          width: "100%",
          maxWidth: "900px",
          height: "300px",
          background: "var(--nt-void)",
          border: "2px solid var(--nt-line)",
          position: "relative"
        }}>
          {nodes.map(node => {
            const left = node.pos_x !== null ? node.pos_x * 100 : 50;
            const top = node.pos_y !== null ? node.pos_y * 100 : 50;
            return (
              <div 
                key={node.mac_address}
                style={{
                  position: "absolute",
                  left: `calc(${left}% - 15px)`,
                  top: `calc(${top}% - 15px)`,
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  background: node.status === 'online' ? "var(--nt-iris)" : "#555",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "move",
                  boxShadow: "0 0 10px rgba(0,0,0,0.5)"
                }}
                draggable
                onDragEnd={(e) => {
                  const rect = e.target.parentElement.getBoundingClientRect();
                  let x = (e.clientX - rect.left) / rect.width;
                  let y = (e.clientY - rect.top) / rect.height;
                  x = Math.max(0, Math.min(1, x));
                  y = Math.max(0, Math.min(1, y));
                  updatePosition(node.mac_address, x, y);
                }}
                title={node.name || node.mac_address}
              >
                <span style={{ fontSize: "10px", color: "black", fontWeight: "bold" }}>
                  {node.name ? node.name.charAt(0).toUpperCase() : "?"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        Loading nodes...
      </div>
    );
  }

  return (
    <div>
      <Header title="Device Manager" subtitle="Manage your EAGLE-Δ ESP32 nodes" />
      <div style={{ padding: "1rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #333" }}>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>MAC Address</th>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Name</th>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Status</th>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Last Seen</th>
              <th style={{ textAlign: "left", padding: "0.75rem" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((node) => (
              <tr key={node.mac_address} style={{ borderBottom: "1px solid #333" }}>
                <td style={{ padding: "0.75rem" }}>{node.mac_address}</td>
                {editingNode === node.mac_address ? (
                  <>
                    <td style={{ padding: "0.75rem" }}>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                        style={{
                          width: "100%",
                          padding: "0.5rem",
                          background: "#111",
                          border: "1px solid #333",
                          borderRadius: "4px",
                          color: "white",
                        }}
                      />
                    </td>
                    <td colSpan="2" style={{ padding: "0.75rem" }}>
                      Editing...
                    </td>
                    <td style={{ padding: "0.75rem" }}>
                      <button
                        onClick={saveEdit}
                        style={{
                          marginRight: "0.5rem",
                          background: "#0f62fe",
                          color: "white",
                          border: "none",
                          padding: "0.5rem 1rem",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingNode(null)}
                        style={{
                          background: "#333",
                          color: "white",
                          border: "none",
                          padding: "0.5rem 1rem",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: "0.75rem" }}>{node.name || 'Unnamed'}</td>
                    <td style={{ padding: "0.75rem" }}>
                      <span style={{ 
                        color: node.status === 'online' ? '#24a148' : '#8d8d8d',
                        fontWeight: 'bold' 
                      }}>
                        {node.status || 'Offline'}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem" }}>{new Date(node.last_seen).toLocaleString()}</td>
                    <td style={{ padding: "0.75rem" }}>
                      <button
                        onClick={() => startEdit(node)}
                        style={{
                          marginRight: "0.5rem",
                          background: "#333",
                          color: "white",
                          border: "none",
                          padding: "0.5rem 1rem",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteNode(node.mac_address)}
                        style={{
                          marginRight: "0.5rem",
                          background: "#da1e28",
                          color: "white",
                          border: "none",
                          padding: "0.5rem 1rem",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => identifyNode(node.mac_address)}
                        style={{
                          background: "var(--nt-iris-dim)",
                          color: "var(--nt-iris)",
                          border: "1px solid var(--nt-iris)",
                          padding: "0.5rem 1rem",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                        disabled={node.status !== 'online'}
                      >
                        Blink LED
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {renderRoomBuilder()}
      </div>
    </div>
  );
}
