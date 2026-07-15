import React, { useState, useEffect } from "react";
import Header from "../components/Header.jsx";

export default function ProvisionView({ token }) {
  const [creds, setCreds] = useState({ ssid: "", password: "" });
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    // Fetch stored Wi-Fi creds
    fetch(`${import.meta.env.VITE_API_BASE || "http://localhost:4032/api/netra32"}/auth/wifi-creds`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          setCreds({ ssid: data.wifi_ssid, password: data.wifi_password });
        }
      });
  }, [token]);

  const handleProvision = async () => {
    setStatus("provisioning");
    try {
      // The ESP32 AP runs on 192.168.4.1
      const res = await fetch("http://192.168.4.1/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ssid: creds.ssid, password: creds.password })
      });
      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  return (
    <div>
      <Header title="Provision Node" subtitle="eagle-delta · Netra32" connected={true} />
      <div className="nt-card" style={{ maxWidth: 600 }}>
        <h3 style={{ color: "#7CFF3C", marginTop: 0 }}>ESP32 Wi-Fi Setup</h3>
        <p style={{ color: "var(--nt-steel-dim)", lineHeight: 1.5 }}>
          Your Wi-Fi credentials have been saved securely. Follow these steps to provision your ESP32:
        </p>
        <ol style={{ color: "#D1DDD7", lineHeight: 1.8, marginBottom: 24 }}>
          <li>Power on your ESP32 device.</li>
          <li>Connect this device (phone/laptop) to the Wi-Fi network named <strong>EAGLE-SETUP</strong>.</li>
          <li>Click the button below to push your credentials to the ESP32.</li>
          <li>Once successful, reconnect to your home Wi-Fi network.</li>
        </ol>

        <button 
          className="nt-btn" 
          onClick={handleProvision} 
          disabled={status === "provisioning" || !creds.ssid}
          style={{ width: "100%", padding: 12 }}
        >
          {status === "provisioning" ? "Sending..." : "Push Credentials to ESP32"}
        </button>

        {status === "success" && (
          <div style={{ marginTop: 16, color: "#7CFF3C", padding: 12, border: "1px solid #7CFF3C", borderRadius: 4 }}>
            Successfully provisioned! The ESP32 is rebooting. Please reconnect to your home Wi-Fi.
          </div>
        )}
        {status === "error" && (
          <div style={{ marginTop: 16, color: "#FF5252", padding: 12, border: "1px solid #FF5252", borderRadius: 4 }}>
            Failed to connect to ESP32. Ensure you are connected to the <strong>EAGLE-SETUP</strong> Wi-Fi network.
          </div>
        )}
      </div>
    </div>
  );
}
