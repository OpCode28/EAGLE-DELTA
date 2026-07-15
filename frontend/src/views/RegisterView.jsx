import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:4032/api/netra32`;

export default function RegisterView({ onLogin }) {
  const [id, setId] = useState("");
  const [key, setKey] = useState("");
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, key, wifi_ssid: wifiSsid, wifi_password: wifiPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }
      onLogin(data.token);
      navigate("/provision"); // Redirect to provision immediately
    } catch (err) {
      setError("Could not reach the eagle-delta backend on the local network.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="nt-login-wrap nt-radar-field">
      <div className="nt-login-card">
        <img
          src="/assets/netra32-logo.png"
          alt="Netra32"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
        <h2>NETRA32</h2>
        <div className="nt-login-sub">Register & Configure Wi-Fi</div>

        <form onSubmit={handleSubmit}>
          {error && <div className="nt-login-error">{error}</div>}

          <div className="nt-field">
            <label htmlFor="nt-id">Console ID</label>
            <input
              id="nt-id"
              type="text"
              autoComplete="username"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="admin"
              required
            />
          </div>

          <div className="nt-field">
            <label htmlFor="nt-key">Access Key</label>
            <input
              id="nt-key"
              type="password"
              autoComplete="new-password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="••••••••••"
              required
            />
          </div>

          <div className="nt-field">
            <label htmlFor="nt-ssid">Wi-Fi SSID (for ESP32)</label>
            <input
              id="nt-ssid"
              type="text"
              value={wifiSsid}
              onChange={(e) => setWifiSsid(e.target.value)}
              placeholder="MyHomeNetwork"
              required
            />
          </div>

          <div className="nt-field">
            <label htmlFor="nt-wifipass">Wi-Fi Password</label>
            <input
              id="nt-wifipass"
              type="password"
              value={wifiPassword}
              onChange={(e) => setWifiPassword(e.target.value)}
              placeholder="••••••••••"
              required
            />
          </div>

          <button className="nt-btn" type="submit" disabled={loading} style={{ marginTop: 10 }}>
            {loading ? "Registering…" : "Register"}
          </button>
          
          <div style={{ marginTop: 16, textAlign: "center", fontSize: 13 }}>
            <Link to="/login" style={{ color: "#7CFF3C" }}>Already have an account? Login</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
