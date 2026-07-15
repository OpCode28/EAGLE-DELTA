# EAGLE-Δ System Inspection Report

## Date
July 14, 2026

## Project Overview
EAGLE-Δ is an offline, air-gapped Wi-Fi CSI (Channel State Information) sensing system consisting of ESP32 edge nodes, a Node.js/Express backend, and a React/Vite/Electron frontend (Netra32 dashboard).

---

## System Components

### 1. Backend (`backend/`)
**File**: `backend/package.json`
**Status**: ✅ Complete
**Key Features**:
- Express server on port 4032
- SQLite database via `better-sqlite3`
- UDP receiver on port 3021 for CSI data
- SSE (Server-Sent Events) for real-time telemetry
- Python DSP/ML bridge via `pyBridge.js`
- mDNS service advertisement (`_eagle._tcp.local`)

**Dependencies**:
- better-sqlite3
- express
- cors
- body-parser
- bonjour-service
- jsonwebtoken
- node-wifi

---

### 2. Frontend (`frontend/`)
**File**: `frontend/package.json`
**Status**: ✅ Complete
**Key Features**:
- React + Vite dashboard
- Electron wrapper
- Android app support via Capacitor
- Chart.js for visualizations
- HashRouter for Electron compatibility

**Dependencies**:
- react
- react-dom
- react-router-dom
- chart.js
- react-chartjs-2
- @capacitor/*

---

### 3. Root Electron Wrapper (`main.js`, `package.json`)
**File**: `package.json` (root)
**Status**: ✅ Complete
**Key Features**:
- Starts backend as a forked Node.js process
- Loads built frontend (`frontend/dist/index.html`)
- Enables Web Bluetooth for BLE provisioning

---

### 4. ESP32 Firmware Options
There are 2 firmware options:

#### A. Arduino Firmware (`firmware/eagle_delta_node/eagle_delta_node.ino`)
**Status**: ✅ Complete
**Key Features**:
- BLE and Wi-Fi AP provisioning
- mDNS backend discovery
- CSI collection at 20 Hz
- HTTP POST telemetry to backend

#### B. ESP-IDF Firmware (`ESP_32/esp32_wroom32_csi_idf/csi_node/`)
**Status**: ✅ Complete
**Key Features**:
- Kconfig for easy configuration (node ID, Wi-Fi credentials, backend host)
- UDP sender (port 3021)
- HTTP sender
- 4-node support via configurable `CONFIG_ESP_CSI_NODE_ID` (1-4)

---

### 5. CSI Utilities (`ESP_32/`)
**Files**:
- `csi_receiver.py`: Standalone UDP receiver for CSI data
- `wroom32_csi_bridge.py`: Serial/UDP to HTTP bridge with ML inference
- `phase2/`: DSP preprocessing library
- `phase3/`: ML classification library

---

## Configuration Checklist

### Backend Configuration
- [x] Database schema initialized via `config/database.js`
- [x] UDP port 3021 listening
- [x] HTTP port 4032 listening
- [x] SSE endpoint `/api/netra32/telemetry/stream`

### Frontend Configuration
- [x] `.env` file: `VITE_API_BASE=http://localhost:4032/api/netra32`
- [x] Vite config: `base: "./"` (for Electron file:// protocol)
- [x] React Router: HashRouter (not BrowserRouter)

### Electron Configuration
- [x] GPU disabled flags to prevent Windows cache errors
- [x] Loads `frontend/dist/index.html`

---

## Next Steps
1. Install dependencies in backend: `cd backend && npm install`
2. Install dependencies in frontend: `cd frontend && npm install`
3. Build frontend: `cd frontend && npm run build`
4. Start Electron app from root: `npm start`
5. Flash ESP32 nodes with appropriate firmware (configure node IDs 1-4)
