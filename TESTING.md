
# EAGLEΔ Testing Guide

---

## 1. Test the Backend First

### 1.1 Start the Backend
1. Open a terminal in the project root
2. Navigate to `backend` directory
   ```bash
   cd backend
   ```
3. Install dependencies (first time only)
   ```bash
   npm install
   pip install -r requirements.txt
   ```
4. Start the server
   ```bash
   node server.js
   ```
5. Check the terminal for startup logs (port 4032)

---

## 2. Test the Web Dashboard

### 2.1 Build and Serve the Web App
1. Open a new terminal
2. Navigate to `frontend` directory
   ```bash
   cd frontend
   ```
3. Install dependencies (first time only)
   ```bash
   npm install
   ```
4. Build the app
   ```bash
   npm run build
   ```
5. Preview locally
   ```bash
   npm run preview
   ```
6. Open your browser to `http://localhost:4173` (or whatever port the preview server shows)

### 2.2 Test the Login
1. On the login page, enter:
   - ID: `admin`
   - Key: `eagle-delta`
2. Click “Login”
3. Verify that you are redirected to the dashboard

### 2.3 Test Dashboard Functionality
- Check “Connected” indicator (top-right)
- Verify real-time telemetry (if ESP32 nodes are active)
- Check CSI Visualization, Presence, Movement, Environment, Analytics, Node Management, etc.

---

## 3. Test ESP32 Nodes (Arduino Version)
1. Open `firmware/eagle_delta_node.ino` in Arduino IDE
2. Update Wi-Fi credentials (`CONFIG_ESP_WIFI_SSID`, `CONFIG_ESP_WIFI_PASSWORD`)
3. Set `CONFIG_ESP_CSI_NODE_ID` to 1
4. Select board “ESP32 Dev Module”, port
5. Upload to first ESP32
6. Open Serial Monitor (115200 baud)
7. Verify:
   - Wi-Fi connects
   - CSI starts
   - Data sends to backend
8. Repeat steps 3‑7 for nodes 2‑4 (unique IDs)

---

## 4. Test ESP32 Nodes (ESP-IDF Version)
1. Navigate to `ESP_32/esp32_wroom32_csi_idf/csi_node`
2. Run `idf.py menuconfig`
   - Set Node ID
   - Wi-Fi credentials
   - Backend host/port (use your laptop's IP!)
3. Build: `idf.py build`
4. Flash: `idf.py flash monitor`
5. Check monitor logs for:
   - Wi‑Fi connected
   - CSI active
   - Telemetry sent to backend

---

## 5. Test Android App (Capacitor APK)
1. Open a terminal in `frontend` directory
2. Build the frontend: `npm run build`
3. Sync Capacitor: `npx cap sync android`
4. Open in Android Studio: `npx cap open android`
5. Build APK in Android Studio
6. Install on Android device
7. Open app, login, check functionality (ensure Android device is on the same Wi‑Fi as your laptop/ESP32s)

---

## Troubleshooting Tips
1. **Backend won't start** – make sure port 4032 isn't already in use
2. **Frontend can't reach backend** – check that `VITE_API_BASE` in `.env` matches your backend's IP:port
3. **ESP32 not connecting to Wi‑Fi** – double-check SSID/password in firmware
4. **No telemetry in dashboard** – verify node is sending to correct backend IP, check backend logs for incoming `/api/netra32/telemetry` requests
