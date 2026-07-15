import React from "react";

export default function Header({ title, subtitle, connected }) {
  return (
    <div className="nt-header">
      <div className="nt-header-titleblock">
        <img
          className="nt-header-logo"
          src="/assets/netra32-logo.png"
          alt="Netra32"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
        <div>
          <h1>{title}</h1>
          {subtitle && <div className="nt-header-sub">{subtitle}</div>}
        </div>
      </div>
      <div className={"nt-status-pill" + (connected ? "" : " offline")}>
        <span className="nt-dot" />
        {connected ? "Live · eagle-delta stream" : "Disconnected"}
      </div>
    </div>
  );
}
