# EAGLE-Δ Quick Start Guide for Customers

---

## What you need
- 4× ESP32-WROOM-32 development boards
- Your Wi‑Fi router
- Laptop or desktop computer (Windows, macOS, or Linux)
- Micro-USB cables
- Power supply for ESP32s (optional, if using USB power for testing)

---

## Step 1: Set up the Netra32 Dashboard
1. Open a terminal and go to the `eagle-delta-fresh` folder:
    ```bash
    cd C:\Users\OM\Desktop\eagle-delta-fresh
    ```

2. Start the backend server:
    ```bash
    cd backend
    npm install
    node server.js
    ```
    Leave this running!

3. Open another terminal and start the frontend (or use the Electron desktop app):
    - For web browser:
        ```bash
        cd ../frontend
        npm install
        npm run build
        npm run preview
        ```
        Open your browser to http://localhost:4173
    - For desktop app:
        ```bash
        cd ../frontend
        npm install
        npm run build
        npm run electron
        ```

---

## Step 2: Log in
- Username: `admin`
- Password: `eagle-delta` (default for the first time

---

## Step 3: Flash ESP32 nodes
1. For each node:
    1. Plug your ESP32 to your computer with a micro-USB cable
    2. Run the flashing script:
        ```bash
        cd firmware
        flash-node.bat
        ```
    3. Follow the on-screen instructions:
        - Enter your Wi‑Fi SSID and password
        - Enter your laptop's Wi‑Fi IP (run `ipconfig` and look for "Wireless LAN adapter Wi‑Fi → IPv4 Address`)
        - Enter the node ID (1‑4 for your 4 nodes)
        - Hold down BOOT button on ESP32 and press Enter

---

## Step 4: Provision (if needed)
Alternatively, use the "Provision Node" page in the dashboard!

1. Plug the ESP32, wait for it to boot into AP mode
2. Connect your laptop to the `EAGLE-SETUP` Wi‑Fi
3. Use "Push Credentials to ESP32"
4. Reconnect your laptop to your normal Wi‑Fi

---

## Step 5: Watch your system working!
You're all set! Open the dashboard and watch ESP32s connect and send data!
