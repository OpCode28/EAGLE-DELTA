import React, { useEffect, useRef } from "react";

/**
 * Renders a scrolling waveform of a numeric telemetry field
 * (e.g. movement_score) using an offline <canvas> — no chart CDN needed.
 */
export default function RealTimeWaveform({ series = [], label = "Movement Signal" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0C1210";
    ctx.fillRect(0, 0, width, height);

    if (series.length < 2) {
      ctx.fillStyle = "#7C8A83";
      ctx.font = "12px ui-monospace, monospace";
      ctx.fillText("awaiting telemetry…", 12, height / 2);
      return;
    }

    const max = Math.max(...series, 1);
    const min = Math.min(...series, 0);
    const range = max - min || 1;
    const stepX = width / (series.length - 1);

    ctx.beginPath();
    series.forEach((value, i) => {
      const x = i * stepX;
      const norm = (value - min) / range;
      const y = height - norm * (height - 16) - 8;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = "#7CFF3C";
    ctx.lineWidth = 1.75;
    ctx.shadowColor = "rgba(124,255,60,0.55)";
    ctx.shadowBlur = 6;
    ctx.stroke();
  }, [series]);

  return (
    <div className="nt-card">
      <div className="nt-vital-label">{label}</div>
      <canvas ref={canvasRef} className="nt-waveform-canvas" />
    </div>
  );
}
