import React from "react";

export default function VitalCard({ label, value, unit, placeholder = "—", color = null }) {
  const display = value === null || value === undefined ? placeholder : value;

  return (
    <div className="nt-card nt-vital-card">
      <div className="nt-vital-label">{label}</div>
      <div className="nt-vital-value" style={{ color: color || undefined }}>
        {display}
        {unit && display !== placeholder && <span className="nt-vital-unit">{unit}</span>}
      </div>
    </div>
  );
}
