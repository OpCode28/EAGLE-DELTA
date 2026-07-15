import React from "react";
import Header from "../components/Header.jsx";

export default function MovementView() {
  return (
    <div>
      <Header title="Movement" subtitle="eagle-delta · Netra32" connected={true} />
      <div className="nt-card">
        <p style={{ color: "var(--nt-steel-dim)" }}>
          Movement telemetry views render here, sourced from the same live
          eagle-delta SSE stream used on the Dashboard.
        </p>
      </div>
    </div>
  );
}
