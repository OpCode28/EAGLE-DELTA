import React from "react";
import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/csi-visualization", label: "CSI Visualization" },
  { to: "/presence", label: "Presence" },
  { to: "/movement", label: "Movement" },
  { to: "/environment", label: "Environment" },
  { to: "/nodes", label: "Node Management" },
  { to: "/analytics", label: "Analytics" },
  { to: "/wizard", label: "Provision Node" },
  { to: "/about", label: "About" },
  { to: "/settings", label: "Settings" },
];

export default function Sidebar() {
  return (
    <aside className="nt-sidebar">
      <div className="nt-sidebar-brand">
        <img src="/assets/netra32-logo.png" alt="Netra32" onError={(e) => (e.currentTarget.style.display = "none")} />
        <div className="nt-wordmark">
          NETRA<span>32</span>
        </div>
      </div>

      <nav className="nt-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => "nt-nav-item" + (isActive ? " active" : "")}
          >
            <span className="nt-nav-dot" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
