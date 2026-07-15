import React from "react";
import Header from "../components/Header.jsx";

const FEATURES = [
  { title: "Wi-Fi / CSI Sensing", body: "Sub-GHz–like sensing layered on your existing Wi-Fi infrastructure — no new radios to install." },
  { title: "ESP32 Powered Edge Node", body: "Built on ESP32 for compact, high-performance IoT sensing at the edge." },
  { title: "Ambient Sensing", body: "Passive, contactless detection driven entirely by Wi-Fi CSI signal fluctuations." },
  { title: "Generalized Architecture", body: "An extendable foundation designed to support multiple sensing applications over time." },
  { title: "Local Environment Localization", body: "Indoor monitoring and localization tuned for smart-space layouts." },
  { title: "Dynamics Monitoring", body: "Tracks environmental changes and human presence dynamics in real time." },
  { title: "Privacy-First Protocols", body: "No cameras, no personal data leaves the local network — private by design." },
  { title: "Real-Time Insights", body: "Presence, movement, trends, and patterns surfaced the instant they happen." },
];

export default function AboutView() {
  return (
    <div>
      <Header title="About & System Overview" subtitle="EAGLE∆ engine · Netra32 interface" connected={true} />

      <img
        className="nt-about-logo"
        src="/assets/netra32-logo.png"
        alt="Netra32"
        onError={(e) => (e.currentTarget.style.display = "none")}
      />

      <div className="nt-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>EAGLE∆ Engine Overview</h3>
        <p style={{ color: "var(--nt-steel-dim)", lineHeight: 1.6 }}>
          EAGLE∆ is an AI-powered, privacy-first Wi-Fi sensing system that turns invisible sub-GHz / CSI
          signals into real-world ambient intelligence — without cameras or wearables. An ESP32-powered
          edge node samples the environment and streams telemetry over an isolated local network to this
          backend, where DSP and ML pipelines extract presence, movement dynamics, localization, and
          vital rate signals.
        </p>
      </div>

      <div className="nt-card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Netra32 Web Interface</h3>
        <p style={{ color: "var(--nt-steel-dim)", lineHeight: 1.6 }}>
          Netra32 is the local, secure, private application layer on top of EAGLE∆ — giving you real-time
          environmental intelligence entirely from your browser, entirely on your own network.
        </p>
      </div>

      <h3>Core Features Matrix</h3>
      <div className="nt-feature-matrix">
        {FEATURES.map((f) => (
          <div className="nt-feature-cell" key={f.title}>
            <h4>{f.title}</h4>
            <p>{f.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
