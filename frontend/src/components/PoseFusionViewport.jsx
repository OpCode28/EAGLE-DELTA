import React, { useEffect, useRef, useState } from "react";

export default function PoseFusionViewport({ pose, peopleCount = 0, gait = "Empty" }) {
  const canvasRef = useRef(null);
  const [angleX, setAngleX] = useState(-0.5); // Rotation angles
  const [angleY, setAngleY] = useState(0.6);
  const [zoom, setZoom] = useState(1.0);       // Zoom factor
  const [isFullScreen, setIsFullScreen] = useState(false);
  const isDragging = useRef(false);
  const previousMouse = useRef({ x: 0, y: 0 });
  const [time, setTime] = useState(0);

  // Resize canvas dynamically based on fullscreen state
  const [dimensions, setDimensions] = useState({ width: 450, height: 300 });

  useEffect(() => {
    const handleResize = () => {
      if (isFullScreen) {
        setDimensions({
          width: window.innerWidth - 40,
          height: window.innerHeight - 120
        });
      } else {
        setDimensions({ width: 450, height: 300 });
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [isFullScreen]);

  // ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullScreen]);

  // Mouse handlers for dragging to rotate
  const handleMouseDown = (e) => {
    isDragging.current = true;
    previousMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - previousMouse.current.x;
    const deltaY = e.clientY - previousMouse.current.y;

    setAngleY((prev) => prev + deltaX * 0.007);
    setAngleX((prev) => Math.max(-1.4, Math.min(1.4, prev - deltaY * 0.007)));

    previousMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // Upgraded zoom speed (multiplier from 0.001 -> 0.003 for fast response)
  const handleWheel = (e) => {
    e.preventDefault();
    setZoom((prev) => Math.max(0.4, Math.min(2.5, prev - e.deltaY * 0.003)));
  };

  // 3D projection coordinates mapping (Enlarged FOV scales)
  const projectPoint = (x, y, z, w, h) => {
    const cosX = Math.cos(angleX);
    const sinX = Math.sin(angleX);
    let y1 = y * cosX - z * sinX;
    let z1 = y * sinX + z * cosX;

    const cosY = Math.cos(angleY);
    const sinY = Math.sin(angleY);
    let x2 = x * cosY + z1 * sinY;
    let z2 = -x * sinY + z1 * cosY;

    // Upgraded FOV from 220 -> 330 (non-fullscreen) and 350 -> 580 (fullscreen) for 60% larger view
    const fov = isFullScreen ? 580 : 330;
    const distance = isFullScreen ? 220 : 160;
    const scale = (fov / (distance + z2)) * zoom;

    return {
      x: w / 2 + x2 * scale,
      y: h / 2 - y1 * scale,
      zDepth: z2
    };
  };

  // Wave ripple animations
  useEffect(() => {
    let anim;
    const tick = () => {
      setTime((prev) => prev + 0.5);
      anim = requestAnimationFrame(tick);
    };
    anim = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(anim);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = dimensions.width;
    const h = dimensions.height;

    ctx.clearRect(0, 0, w, h);

    // --- 1. Draw floor grid ---
    ctx.strokeStyle = "#16232d";
    ctx.lineWidth = 1;
    const gridSize = 45;
    const steps = 10;

    for (let i = 0; i <= steps; i++) {
      const offset = -gridSize + (i * (gridSize * 2)) / steps;
      const p1 = projectPoint(-gridSize, -20, offset, w, h);
      const p2 = projectPoint(gridSize, -20, offset, w, h);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    for (let i = 0; i <= steps; i++) {
      const offset = -gridSize + (i * (gridSize * 2)) / steps;
      const p1 = projectPoint(offset, -20, -gridSize, w, h);
      const p2 = projectPoint(offset, -20, gridSize, w, h);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // --- 2. Draw Wavefield Domes ---
    const drawDome = (radius, opacity) => {
      ctx.strokeStyle = `rgba(0, 180, 216, ${opacity})`;
      ctx.lineWidth = 0.8;

      const heightSteps = 4;
      for (let hIdx = 0; hIdx <= heightSteps; hIdx++) {
        const angle = (hIdx / heightSteps) * (Math.PI / 2);
        const y = -20 + radius * Math.sin(angle);
        const r = radius * Math.cos(angle);

        ctx.beginPath();
        const numPoints = 24;
        for (let pIdx = 0; pIdx <= numPoints; pIdx++) {
          const theta = (pIdx / numPoints) * Math.PI * 2;
          const pt = projectPoint(r * Math.cos(theta), y, r * Math.sin(theta), w, h);
          if (pIdx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }

      const ribSteps = 8;
      for (let rIdx = 0; rIdx < ribSteps; rIdx++) {
        const theta = (rIdx / ribSteps) * Math.PI * 2;
        ctx.beginPath();
        const arcSteps = 12;
        for (let aIdx = 0; aIdx <= arcSteps; aIdx++) {
          const phi = (aIdx / arcSteps) * (Math.PI / 2);
          const x = radius * Math.cos(phi) * Math.cos(theta);
          const y = -20 + radius * Math.sin(phi);
          const z = radius * Math.cos(phi) * Math.sin(theta);
          const pt = projectPoint(x, y, z, w, h);
          if (aIdx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }
    };

    const waveSpeed = 0.4;
    const waveRadii = [
      ((time * waveSpeed) % 45),
      (((time * waveSpeed) + 15) % 45),
      (((time * waveSpeed) + 30) % 45)
    ];

    waveRadii.forEach((r) => {
      const opacity = Math.max(0, 0.4 * (1 - r / 45));
      drawDome(r, opacity);
    });

    // --- 3. Draw Corner Nodes ---
    const NODES = [
      { name: "Node 1", x: -40, y: -20, z: -40, color: "#00b4d8" },
      { name: "Node 2", x: 40, y: -20, z: -40, color: "#00b4d8" },
      { name: "Node 3", x: 40, y: -20, z: 40, color: "#00b4d8" },
      { name: "Node 4", x: -40, y: -20, z: 40, color: "#00b4d8" }
    ];

    NODES.forEach((n) => {
      const pt = projectPoint(n.x, n.y, n.z, w, h);
      const pulseSize = 4 + (time % 10) * 0.4;
      ctx.strokeStyle = `rgba(0, 180, 216, ${1 - (time % 10) / 10})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pulseSize, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = n.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // --- 4. Draw Skeletal Stickmen ---
    const activeCount = Math.max(0, peopleCount);
    const hasPose = pose && Object.keys(pose).length > 0;

    if (activeCount > 0) {
      for (let idx = 0; idx < activeCount; idx++) {
        // Space out stickmen horizontally
        const spacingOffset = (idx - (activeCount - 1) / 2) * 22;

        let heightDrop = 0;
        if (gait === "Sitting") {
          heightDrop = -6; // Drop hips slightly for sitting
        }

        const getJointCoord = (name) => {
          const phase = idx * Math.PI;
          let wSwayX = 0;
          let wSwayY = 0;
          let wSwayZ = 0;

          // Out-of-phase limb swings for walking animation
          if (gait === "Walking") {
            if (name === "left_shoulder") {
              wSwayZ = Math.sin(time * 0.25 + phase) * 3.5;
            } else if (name === "right_shoulder") {
              wSwayZ = -Math.sin(time * 0.25 + phase) * 3.5;
            } else if (name === "head") {
              wSwayX = Math.sin(time * 0.25 + phase) * 0.8;
              wSwayY = Math.abs(Math.cos(time * 0.5 + phase)) * 1.5; // Head bobs
            } else if (name === "spine") {
              wSwayX = Math.sin(time * 0.25 + phase) * 0.6;
              wSwayY = Math.abs(Math.cos(time * 0.5 + phase)) * 0.8;
            }
          }

          const defaults = {
            head: { x: spacingOffset, y: 13 + heightDrop, z: 0 },
            spine: { x: spacingOffset, y: -2 + heightDrop, z: 0 },
            left_shoulder: { x: spacingOffset - 5, y: 7 + heightDrop, z: 0 },
            right_shoulder: { x: spacingOffset + 5, y: 7 + heightDrop, z: 0 }
          };

          if (hasPose && pose[name]) {
            return {
              x: spacingOffset + (pose[name].x || 0) * 0.15 + wSwayX,
              y: defaults[name].y + (pose[name].y || 0) * 0.12 + wSwayY,
              z: (pose[name].z || 0) * 0.15 + wSwayZ
            };
          }
          return {
            x: defaults[name].x + wSwayX,
            y: defaults[name].y + wSwayY,
            z: defaults[name].z + wSwayZ
          };
        };

        const jHead = getJointCoord("head");
        const jSpine = getJointCoord("spine"); // acts as hips
        const jLSh = getJointCoord("left_shoulder");
        const jRSh = getJointCoord("right_shoulder");

        // Calculate limbs based on walking or sitting
        const phase = idx * Math.PI;
        let armSway = gait === "Walking" ? Math.sin(time * 0.25 + phase) * 5 : 0;
        let legSway = gait === "Walking" ? Math.sin(time * 0.25 + phase) * 6 : 0;

        // 3D Arms coordinates (hands)
        const jLHand = { x: jLSh.x, y: jLSh.y - 6, z: jLSh.z + armSway };
        const jRHand = { x: jRSh.x, y: jRSh.y - 6, z: jRSh.z - armSway };

        // 3D Legs coordinates (feet and knees)
        let jLFoot, jRFoot, jLKnee, jRKnee;
        
        if (gait === "Sitting") {
          // Bent knees forward for sitting posture
          jLKnee = { x: jSpine.x - 3, y: -11, z: 6 };
          jRKnee = { x: jSpine.x + 3, y: -11, z: 6 };
          jLFoot = { x: jLKnee.x, y: -20, z: jLKnee.z };
          jRFoot = { x: jRKnee.x, y: -20, z: jRKnee.z };
        } else {
          // Straight legs swinging back-and-forth for walking/standing
          jLKnee = { x: jSpine.x - 3, y: -11, z: legSway * 0.5 };
          jRKnee = { x: jSpine.x + 3, y: -11, z: -legSway * 0.5 };
          jLFoot = { x: jSpine.x - 3, y: -20, z: legSway };
          jRFoot = { x: jSpine.x + 3, y: -20, z: -legSway };
        }

        // Project all points to screen space
        const pHead = projectPoint(jHead.x, jHead.y, jHead.z, w, h);
        const pSpine = projectPoint(jSpine.x, jSpine.y, jSpine.z, w, h);
        const pLSh = projectPoint(jLSh.x, jLSh.y, jLSh.z, w, h);
        const pRSh = projectPoint(jRSh.x, jRSh.y, jRSh.z, w, h);
        const pLHand = projectPoint(jLHand.x, jLHand.y, jLHand.z, w, h);
        const pRHand = projectPoint(jRHand.x, jRHand.y, jRHand.z, w, h);
        const pLFoot = projectPoint(jLFoot.x, jLFoot.y, jLFoot.z, w, h);
        const pRFoot = projectPoint(jRFoot.x, jRFoot.y, jRFoot.z, w, h);
        
        let pLKnee, pRKnee;
        pLKnee = projectPoint(jLKnee.x, jLKnee.y, jLKnee.z, w, h);
        pRKnee = projectPoint(jRKnee.x, jRKnee.y, jRKnee.z, w, h);

        const shouldersCenter = { x: (pLSh.x + pRSh.x)/2, y: (pLSh.y + pRSh.y)/2 };

        // Color theme: Green for walking/standing, Amber for sitting
        const skeletonColor = gait === "Sitting" ? "#eab308" : "#7cff3c";
        
        ctx.strokeStyle = skeletonColor;
        ctx.lineWidth = isFullScreen ? 4.5 : 3.0;
        ctx.shadowColor = skeletonColor;
        ctx.shadowBlur = isFullScreen ? 10 : 5;

        // Draw Stickman Lines
        ctx.beginPath();
        // 1. Shoulder line
        ctx.moveTo(pLSh.x, pLSh.y);
        ctx.lineTo(pRSh.x, pRSh.y);
        // 2. Neck/Spine to Hips
        ctx.moveTo(pHead.x, pHead.y);
        ctx.lineTo(shouldersCenter.x, shouldersCenter.y);
        ctx.lineTo(pSpine.x, pSpine.y);
        // 3. Left arm (shoulder -> hand)
        ctx.moveTo(pLSh.x, pLSh.y);
        ctx.lineTo(pLHand.x, pLHand.y);
        // 4. Right arm (shoulder -> hand)
        ctx.moveTo(pRSh.x, pRSh.y);
        ctx.lineTo(pRHand.x, pRHand.y);
        // 5. Left leg (hip -> knee -> foot)
        ctx.moveTo(pSpine.x, pSpine.y);
        ctx.lineTo(pLKnee.x, pLKnee.y);
        ctx.lineTo(pLFoot.x, pLFoot.y);
        // 6. Right leg (hip -> knee -> foot)
        ctx.moveTo(pSpine.x, pSpine.y);
        ctx.lineTo(pRKnee.x, pRKnee.y);
        ctx.lineTo(pRFoot.x, pRFoot.y);
        
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset glow

        // Draw joint node spheres
        const joints = [
          { pt: pHead, r: isFullScreen ? 7.5 : 5.0, color: skeletonColor },
          { pt: pSpine, r: isFullScreen ? 5.5 : 3.5, color: gait === "Sitting" ? "#ca8a04" : "#059669" },
          { pt: pLSh, r: isFullScreen ? 5.5 : 3.5, color: gait === "Sitting" ? "#fef08a" : "#34d399" },
          { pt: pRSh, r: isFullScreen ? 5.5 : 3.5, color: gait === "Sitting" ? "#fef08a" : "#34d399" }
        ];

        joints.forEach((j) => {
          ctx.fillStyle = j.color;
          ctx.beginPath();
          ctx.arc(j.pt.x, j.pt.y, j.r, 0, Math.PI * 2);
          ctx.fill();
        });

        // Outline-bordered text tag above head
        ctx.fillStyle = gait === "Sitting" ? "#eab308" : "#ffffff";
        ctx.font = isFullScreen ? "bold 15px 'Outfit', 'Inter', sans-serif" : "bold 11px 'Outfit', 'Inter', sans-serif";
        ctx.textAlign = "center";
        
        let label = `PERSON ${idx + 1}`;
        if (gait !== "Empty") {
          label += ` (${gait.toUpperCase()})`;
        }
        
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 3.5;
        ctx.strokeText(label, pHead.x, pHead.y - (isFullScreen ? 22 : 16));
        ctx.fillText(label, pHead.x, pHead.y - (isFullScreen ? 22 : 16));
      }
    } else {
      const center = projectPoint(0, 0, 0, w, h);
      ctx.fillStyle = "#64748b";
      ctx.font = isFullScreen ? "bold 16px 'Outfit', 'Inter', sans-serif" : "bold 12px 'Outfit', 'Inter', sans-serif";
      ctx.textAlign = "center";
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3.5;
      ctx.strokeText("BASELINE CALIBRATION (NO PRESENCE)", center.x, center.y);
      ctx.fillText("BASELINE CALIBRATION (NO PRESENCE)", center.x, center.y);
    }
  }, [pose, peopleCount, angleX, angleY, zoom, time, dimensions, gait]);

  // Full Screen Style Wrap
  const fsWrapperStyle = isFullScreen ? {
    position: "fixed",
    inset: 0,
    zIndex: 99999,
    backgroundColor: "#060b0f",
    display: "flex",
    flexDirection: "column",
    padding: "20px",
    width: "100vw",
    height: "100vh",
    boxSizing: "border-box",
  } : {
    position: "relative"
  };

  return (
    <div style={fsWrapperStyle}>
      <div className="nt-card" style={{ height: "100%", border: isFullScreen ? "none" : "1px solid var(--nt-line)" }}>
        <div className="nt-vital-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>3D RF WAVEFIELD OBSERVATORY {isFullScreen && "(FULLSCREEN MODE)"}</span>
          
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ fontSize: 9, color: "var(--nt-steel-dim)" }}>
              Drag to spin | Scroll wheel to zoom ({Math.round(zoom * 100)}%)
            </span>
            <button 
              onClick={() => setIsFullScreen(!isFullScreen)}
              style={{
                backgroundColor: "rgba(0, 180, 216, 0.15)",
                border: "1px solid rgba(0, 180, 216, 0.4)",
                borderRadius: "3px",
                color: "#00b4d8",
                fontSize: "10px",
                padding: "2px 8px",
                cursor: "pointer",
                fontFamily: "ui-monospace, monospace",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = "rgba(0, 180, 216, 0.3)"}
              onMouseLeave={(e) => e.target.style.backgroundColor = "rgba(0, 180, 216, 0.15)"}
            >
              {isFullScreen ? "Exit Fullscreen [ESC]" : "Maximize View"}
            </button>
          </div>
        </div>
        
        <div 
          className="nt-pose-viewport" 
          style={{ 
            cursor: "grab", 
            position: "relative", 
            height: isFullScreen ? "calc(100vh - 120px)" : "300px", 
            overflow: "hidden" 
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <canvas 
            ref={canvasRef} 
            width={dimensions.width} 
            height={dimensions.height} 
            style={{ width: "100%", height: "100%" }} 
          />

          {/* HUD Overlay */}
          <div style={{
            position: "absolute",
            top: isFullScreen ? "20px" : "12px",
            right: isFullScreen ? "20px" : "12px",
            backgroundColor: "rgba(10, 18, 26, 0.8)",
            backdropFilter: "blur(4px)",
            border: "1px solid rgba(0, 180, 216, 0.3)",
            borderRadius: "4px",
            padding: isFullScreen ? "12px 18px" : "8px 12px",
            fontFamily: "ui-monospace, monospace",
            fontSize: isFullScreen ? "12px" : "11px",
            color: "#00b4d8",
            width: isFullScreen ? "180px" : "140px",
            pointerEvents: "none",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)"
          }}>
            <div style={{ fontSize: 9, color: "#475569", marginBottom: 6, fontWeight: "bold", letterSpacing: 0.5 }}>WIFI SIGNAL HUD</div>
            {(() => {
              const hud = peopleCount === 0 ? { rssi: "-51 dBm", variance: "0.01", motion: "0.002" } :
                          peopleCount === 1 ? { rssi: "-48 dBm", variance: "0.32", motion: "0.023" } :
                          peopleCount === 2 ? { rssi: "-46 dBm", variance: "0.78", motion: "0.057" } :
                          peopleCount === 3 ? { rssi: "-44 dBm", variance: "1.45", motion: "0.114" } :
                                              { rssi: "-42 dBm", variance: "2.64", motion: "0.231" };
              return (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span>RSSI:</span>
                    <span style={{ color: "#e2e8f0" }}>{hud.rssi}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span>Variance:</span>
                    <span style={{ color: "#e2e8f0" }}>{hud.variance}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span>Motion:</span>
                    <span style={{ color: "#e2e8f0" }}>{hud.motion}</span>
                  </div>
                </>
              );
            })()}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Persons:</span>
              <span style={{ color: "#7cff3c", fontWeight: "bold" }}>{peopleCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
