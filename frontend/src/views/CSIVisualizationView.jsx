
import React, { useEffect, useRef, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import Header from "../components/Header.jsx";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement
);

const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:4032/api/netra32`;
const MAX_CSI_SAMPLES = 100;
const MAX_SUBCHART_POINTS = 50;

export default function CSIVisualizationView({ token }) {
  const [connected, setConnected] = useState(false);
  const [csiMatrix, setCsiMatrix] = useState([]); // 2D array: [sample][subcarrier]
  const [selectedSubcarrier, setSelectedSubcarrier] = useState(0);
  const [subcarrierData, setSubcarrierData] = useState([]);
  const [poseData, setPoseData] = useState({ head: { x: 0, y: 0 }, spine: { x: 0, y: 0 } });
  const [nodes, setNodes] = useState([]);
  const eventSourceRef = useRef(null);

  const selectedSubcarrierRef = useRef(0);
  selectedSubcarrierRef.current = selectedSubcarrier;

  // Compute simple FFT for PSD (just a demo)
  const computeSimplePSD = (data) => {
    const n = data.length;
    if (n < 2) return { frequencies: [], values: [] };
    const frequencies = [];
    const values = [];
    for (let k = 0; k < n / 2; k++) {
      frequencies.push(k * (100 / n)); // Assume 100 Hz sampling
      let real = 0, imag = 0;
      for (let t = 0; t < n; t++) {
        const angle = 2 * Math.PI * k * t / n;
        real += data[t] * Math.cos(angle);
        imag -= data[t] * Math.sin(angle);
      }
      values.push(Math.sqrt(real * real + imag * imag) / n);
    }
    return { frequencies, values };
  };

  // Compute PSD dynamically based on csiMatrix via useMemo (prevents reconnect loop)
  const psdData = React.useMemo(() => {
    if (csiMatrix.length < 10) return { frequencies: [], values: [] };
    const avgSeries = [];
    for (let i = 0; i < csiMatrix.length; i++) {
      let sum = 0;
      let count = 0;
      for (let j = 0; j < 5 && j < csiMatrix[i].length; j++) {
        sum += csiMatrix[i][j];
        count++;
      }
      avgSeries.push(count > 0 ? sum / count : 0);
    }
    return computeSimplePSD(avgSeries);
  }, [csiMatrix]);

  useEffect(() => {
    // Connect to backend telemetry stream
    const es = new EventSource(`${API_BASE}/telemetry/stream`);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.addEventListener("telemetry", (event) => {
      const record = JSON.parse(event.data);
      
      if (record.csi_matrix && Array.isArray(record.csi_matrix) && record.csi_matrix.length > 0) {
        setCsiMatrix(prev => {
          const next = [...prev, ...record.csi_matrix]; // Flatten the 20 rows!
          return next.length > MAX_CSI_SAMPLES ? next.slice(next.length - MAX_CSI_SAMPLES) : next;
        });
        
        // Extract the selected subcarrier values for all 20 samples in the batch
        const sc = selectedSubcarrierRef.current;
        const newSamples = record.csi_matrix.map(row => row[sc] || 0);
        setSubcarrierData(prev => {
          const next = [...prev, ...newSamples];
          return next.length > MAX_SUBCHART_POINTS ? next.slice(next.length - MAX_SUBCHART_POINTS) : next;
        });
      }
      if (record.pose) {
        setPoseData(record.pose);
      }
    });

    // Fetch nodes for spatial visualization
    const fetchNodes = async () => {
      try {
        const res = await fetch(`${API_BASE}/nodes`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.ok) setNodes(data.nodes);
      } catch (err) {
        console.error("Failed to fetch nodes for spatial layout");
      }
    };
    fetchNodes();

    return () => es.close();
  }, [token]);

  // Generate synthetic CSI if no real data for demonstration
  useEffect(() => {
    if (csiMatrix.length === 0) {
      const syntheticMatrix = [];
      for (let i = 0; i < 50; i++) {
        const row = [];
        for (let j = 0; j < 30; j++) {
          row.push(50 + Math.sin(i / 10 + j / 5) * 20 + Math.random() * 10);
        }
        syntheticMatrix.push(row);
      }
      setCsiMatrix(syntheticMatrix);
      setSubcarrierData(syntheticMatrix.map(row => row[0]));
    }
  }, []);

  // Chart options
  const heatmapData = {
    labels: csiMatrix.length > 0 ? Array.from({ length: csiMatrix[0].length }, (_, i) => `SC${i}`) : [],
    datasets: csiMatrix.slice(-30).map((row, idx) => ({
      label: `Sample ${idx}`,
      data: row,
      borderColor: `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 1)`,
      backgroundColor: `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, 0.2)`,
    }))
  };

  const timeSeriesData = {
    labels: subcarrierData.map((_, i) => i),
    datasets: [
      {
        label: `Subcarrier ${selectedSubcarrier} Amplitude`,
        data: subcarrierData,
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const psdChartData = {
    labels: psdData.frequencies.map(f => f.toFixed(1)),
    datasets: [
      {
        label: "Power Spectral Density",
        data: psdData.values,
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(255, 99, 132, 0.5)",
        tension: 0.3,
        fill: true,
      },
    ],
  };

  // Render CSI matrix as a heatmap-style bar chart
  const renderCsiMatrix = () => {
    if (csiMatrix.length === 0) return null;
    
    // Create a 2D matrix for heatmap visualization
    const matrix = csiMatrix.slice(-30); // Last 30 samples
    const numSamples = matrix.length;
    const numSubcarriers = matrix[0].length;
    
    // Flatten into a heatmap-like data structure for display
    return (
      <div style={{ 
        width: "100%", 
        overflowX: "auto",
        padding: "16px 0",
        background: "var(--nt-void)",
        border: "1px solid var(--nt-line)",
        borderRadius: "var(--nt-radius)"
      }}>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: `repeat(${numSubcarriers}, minmax(12px, 1fr))`, 
          gap: "1px",
          padding: "8px"
        }}>
          {matrix.map((row, sampleIdx) =>
            row.map((value, scIdx) => {
              // Normalize value for color
              const minVal = Math.min(...row);
              const maxVal = Math.max(...row);
              const normalized = (value - minVal) / (maxVal - minVal || 1);
              const hue = 240 - normalized * 240; // Blue to Red
              
              return (
                <div
                  key={`${sampleIdx}-${scIdx}`}
                  style={{
                    width: "100%",
                    aspectRatio: "1/1",
                    backgroundColor: `hsl(${hue}, 80%, 50%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "10px",
                    color: "white",
                    fontWeight: "bold",
                    borderRadius: "2px",
                    cursor: "pointer",
                  }}
                  onClick={() => setSelectedSubcarrier(scIdx)}
                  title={`Sample ${sampleIdx}, SC${scIdx}: ${value.toFixed(2)}`}
                />
              );
            })
          )}
        </div>
      </div>
    );
  };

  const render2DRoomView = () => {
    // Map abstract pose coordinates to SVG viewport (PCA offsets range from -50 to 50, scale by 2.2 for 300px box)
    const mapPoseX = (x) => 150 + (x * 2.2);
    const mapPoseY = (y) => 150 - (y * 2.2);
    
    // Map node coordinates (0 to 1) to SVG viewport (0 to 300)
    const mapNodeX = (x) => x * 300;
    const mapNodeY = (y) => y * 300;

    return (
      <div className="nt-pose-viewport" style={{ background: "var(--nt-void)", border: "1px solid var(--nt-iris-dim)", position: "relative", overflow: "hidden" }}>
        <div className="nt-radar-field" style={{ position: "absolute", inset: 0, opacity: 0.3 }} />
        <svg width="100%" height="100%" viewBox="0 0 300 300" style={{ position: "relative", zIndex: 1 }}>
          <rect width="300" height="300" fill="transparent" stroke="var(--nt-line)" strokeWidth="2" strokeDasharray="10 10" />
          
          {/* Hardware Nodes */}
          {nodes.filter(n => n.pos_x !== null && n.pos_y !== null).map(node => (
            <g key={node.mac_address}>
              <circle cx={mapNodeX(node.pos_x)} cy={mapNodeY(node.pos_y)} r="6" fill="var(--nt-iris)" opacity="0.8" />
              <text x={mapNodeX(node.pos_x)} y={mapNodeY(node.pos_y) - 10} fill="var(--nt-steel)" fontSize="10" textAnchor="middle">
                {node.name || 'Node'}
              </text>
            </g>
          ))}
          
          {/* Pose Render */}
          <g style={{ transition: "all 0.3s ease-out" }}>
            {poseData.spine && (
              <circle cx={mapPoseX(poseData.spine.x)} cy={mapPoseY(poseData.spine.y)} r="8" fill="#2E5A1C" stroke="#7CFF3C" strokeWidth="2" />
            )}
            {poseData.head && (
              <>
                <line 
                  x1={mapPoseX(poseData.spine?.x || 0)} y1={mapPoseY(poseData.spine?.y || 0)} 
                  x2={mapPoseX(poseData.head.x)} y2={mapPoseY(poseData.head.y)} 
                  stroke="#7CFF3C" strokeWidth="3" opacity="0.6" 
                />
                <circle cx={mapPoseX(poseData.head.x)} cy={mapPoseY(poseData.head.y)} r="12" fill="#06090A" stroke="#7CFF3C" strokeWidth="3">
                  <animate attributeName="r" values="12;16;12" dur="2s" repeatCount="indefinite" />
                </circle>
              </>
            )}
          </g>
        </svg>
      </div>
    );
  };

    return (
    <div>
      <Header
        title="CSI Visualization"
        subtitle="Phase 4: Real-time WiFi Channel State Information visualization"
        connected={connected}
      />
      
      <div className="nt-grid" style={{ marginBottom: "24px" }}>
        <div>
          <h3 style={{ marginBottom: "12px", color: "var(--nt-steel)" }}>Live Heat Map (Spectrogram)</h3>
          {renderCsiMatrix()}
        </div>
        <div>
          <h3 style={{ marginBottom: "12px", color: "var(--nt-steel)" }}>2D Room Tracking (Pose)</h3>
          {render2DRoomView()}
        </div>
      </div>
      
      <div className="nt-grid" style={{ marginBottom: "24px" }}>
        <div>
          <h3 style={{ marginBottom: "12px" }}>Selected Subcarrier Time Series</h3>
          <Line 
            data={timeSeriesData} 
            options={{
              responsive: true,
              scales: {
                y: { beginAtZero: false },
              },
            }} 
          />
        </div>
        <div>
          <h3 style={{ marginBottom: "12px" }}>Signal Spectrum (PSD)</h3>
          <Line 
            data={psdChartData} 
            options={{
              responsive: true,
              scales: {
                y: { beginAtZero: true },
              },
            }} 
          />
        </div>
      </div>
      
      <div className="nt-grid">
        <div>
          <h3 style={{ marginBottom: "12px" }}>Subcarrier Distribution (Last Sample)</h3>
          {csiMatrix.length > 0 && (
            <Bar 
              data={{
                labels: Array.from({ length: csiMatrix[0].length }, (_, i) => `SC${i}`),
                datasets: [
                  {
                    label: "Amplitude",
                    data: csiMatrix[csiMatrix.length - 1],
                    backgroundColor: "rgba(124, 255, 60, 0.5)",
                  },
                ],
              }}
              options={{ responsive: true }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
