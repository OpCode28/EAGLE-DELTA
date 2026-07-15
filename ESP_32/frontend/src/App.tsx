import { useState, useEffect } from 'react';
import './index.css';

interface SensingState {
  timestamp_ms: number;
  presence: boolean;
  n_persons: number;
  confidence: number;
  motion: number;
  activity: string;
  breathing_rate_bpm: number | null;
  heartrate_bpm: number | null;
  gait_behavior: string;
  nodes_online: number;
}

function App() {
  const [data, setData] = useState<SensingState | null>(null);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    const fetchSensingData = async () => {
      try {
        const response = await fetch('http://localhost:3020/api/v1/sensing/latest');
        if (!response.ok) throw new Error('API Error');
        const json = await response.json();
        setData(json);
        setError(false);
      } catch (err) {
        setError(true);
      }
    };

    const intervalId = setInterval(fetchSensingData, 500); // Fetch twice a second
    fetchSensingData();
    
    return () => clearInterval(intervalId);
  }, []);

  if (error || !data) {
    return (
      <div className="dashboard-container">
        <header>
          <h1>RuView AI</h1>
          <div className="subtitle">Radar Sensing Dashboard</div>
        </header>
        <div className="connection-status offline">
          <span className="status-dot"></span>
          Waiting for WROOM-32 CSI Bridge (http://localhost:3020)...
        </div>
      </div>
    );
  }

  // Formatting for presentation
  const gaitDisplay = data.gait_behavior.replace(/_/g, ' ');

  return (
    <div className="dashboard-container">
      <header>
        <h1>RuView AI</h1>
        <div className="subtitle">Real-Time CSI Radar Analytics</div>
        <div className="connection-status">
          <span className="status-dot"></span>
          Connected ({data.nodes_online} / 4 Nodes Active)
        </div>
      </header>

      <div className="grid">
        {/* Person Count Card */}
        <div className="glass-card">
          <div className="card-title">Live Person Count</div>
          <div className="value-container">
            <span className="massive-value">{data.n_persons}</span>
            <span className="unit">Persons</span>
          </div>
          <div className="subtitle" style={{marginTop: '1.5rem', fontSize: '0.9rem'}}>
            AI Confidence: {(data.confidence * 100).toFixed(0)}%
          </div>
        </div>

        {/* Gait Behavior Card */}
        <div className="glass-card">
          <div className="card-title">Gait & Activity Analysis</div>
          <div className="gait-badge">
            {data.activity === 'moving' ? gaitDisplay : data.activity}
          </div>
          <div className="subtitle" style={{marginTop: '1.5rem', fontSize: '0.9rem'}}>
            Raw Motion Energy: {data.motion.toFixed(2)}
          </div>
        </div>

        {/* Vital Signs Card */}
        <div className="glass-card" style={{gridColumn: '1 / -1'}}>
          <div className="card-title">Vital Signs Estimation (Beta)</div>
          <div style={{display: 'flex', gap: '4rem', marginTop: '1rem'}}>
            <div>
              <div className="subtitle">Heart Rate</div>
              <div className="value-container">
                <span className="massive-value" style={{color: '#ff4b4b'}}>
                  {data.heartrate_bpm ? data.heartrate_bpm : '--'}
                </span>
                <span className="unit">BPM</span>
              </div>
            </div>
            <div>
              <div className="subtitle">Breathing Rate</div>
              <div className="value-container">
                <span className="massive-value" style={{color: '#4b9dff'}}>
                  {data.breathing_rate_bpm ? data.breathing_rate_bpm : '--'}
                </span>
                <span className="unit">BPM</span>
              </div>
            </div>
          </div>
          <div className="subtitle" style={{marginTop: '1.5rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)'}}>
            * Vitals require subjects to be sitting/laying still for at least 15 seconds to accumulate enough micro-movement frames.
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
