
# EAGLEΔ Deployment Guide
## Phase 7: Full System Deployment

---

## Prerequisites
- 4 × ESP32-WROOM-32 development boards
- Jio (or equivalent) 2.4 GHz Wi‑Fi router
- 12 V 5 A power supply
- LM2596 Buck Converters (4)
- WAGO lever connectors
- Centralized power bus
- Laptop/PC running Windows 11 (or Linux)
- Android device (for APK installation, optional)

---

## 1. ESP32 Nodes Deployment

### 1.1 Arduino IDE Version
1. Open `firmware/eagle_delta_node.ino` in Arduino IDE
2. Update `CONFIG_ESP_WIFI_SSID` and `CONFIG_ESP_WIFI_PASSWORD` to match your network
3. For each node, set unique `CONFIG_ESP_CSI_NODE_ID` (1‑4)
4. Select board “ESP32 Dev Module”
5. Upload the firmware to each node

### 1.2 ESP‑IDF Version
1. Navigate to `ESP_32/esp32_wroom32_csi_idf/csi_node`
2. Run `idf.py menuconfig` → “EAGLEΔ CSI Node Configuration”
3. Set unique Node ID (1‑4), Wi‑Fi credentials, backend host IP/port
4. Build: `idf.py build`
5. Flash: `idf.py flash monitor`

---

## 2. Backend Deployment
### 2.1 Install Dependencies
```bash
cd backend
npm install
pip install -r requirements.txt
```

### 2.2 Run the Backend
```bash
node server.js
```
- Backend is at `http://<your-laptop-ip>:4032`

---

## 3. Web Dashboard Deployment
### 3.1 Build
```bash
cd frontend
npm install
npm run build
```
### 3.2 Preview Locally
```bash
npm run preview
```
Or, serve using any static file server (e.g., serve, nginx, etc.)

---

## 4. Android APK Deployment (Capacitor)
### 4.1 Sync Frontend Build
```bash
cd frontend
npm install
npm run build
npx cap sync android
```
### 4.2 Open in Android Studio
```bash
npx cap open android
```
### 4.3 Build APK
1. In Android Studio, go to “Build” → “Build Bundle(s)/APK(s)” → “Build APK(s)”
2. Wait for build to finish
3. The APK is in `frontend/android/app/build/outputs/apk/debug/`
### 4.4 Install APK
- Transfer to Android device, enable “Unknown Sources”, install

---

## Deployment Checklist
- [ ] All four ESP32 nodes connected to Wi‑Fi
- [ ] All four nodes sending CSI data to backend
- [ ] Backend running on laptop
- [ ] Dashboard running (web or Android)
- [ ] All visualizations and features working
