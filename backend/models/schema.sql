-- eagle-delta/models/schema.sql
-- Local SQLite schema for the EAGLE∆ / Netra32 offline stack.

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    password_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS devices (
    mac_address TEXT PRIMARY KEY,
    name TEXT,
    ip_address TEXT,
    firmware_version TEXT,
    status TEXT, -- 'online', 'offline'
    last_seen DATETIME,
    sampling_rate INTEGER DEFAULT 20,
    pos_x REAL,
    pos_y REAL,
    pos_z REAL
);

CREATE TABLE IF NOT EXISTS raw_csi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mac_address TEXT,
    timestamp_us INTEGER,
    sequence INTEGER,
    rssi INTEGER,
    csi_matrix TEXT, -- Matrix string representation
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(mac_address) REFERENCES devices(mac_address)
);

CREATE TABLE IF NOT EXISTS processed_features (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mac_address TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    ai_presence BOOLEAN,
    ai_occupancy_count INTEGER,
    ai_activity TEXT,
    heart_rate_bpm REAL,
    resp_rate_rpm REAL,
    pose_json TEXT,
    vital_confidence REAL,
    inference_time_ms REAL,
    FOREIGN KEY(mac_address) REFERENCES devices(mac_address)
);

CREATE INDEX IF NOT EXISTS idx_raw_csi_mac ON raw_csi (mac_address);
CREATE INDEX IF NOT EXISTS idx_processed_mac ON processed_features (mac_address);
CREATE INDEX IF NOT EXISTS idx_processed_ts ON processed_features (timestamp);

