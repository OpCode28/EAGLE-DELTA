
# EAGLE-Δ Project - Phase 1: WiFi CSI Collection

## Overview
Phase 1 implements the core WiFi CSI collection system using ESP32 microcontrollers, UDP communication, and a Python backend receiver.

---

## Project Structure

```
eagle-delta-fresh/
├── ESP_32/
│   ├── esp32_wroom32_csi_idf/
│   │   └── csi_node/
│   │       ├── components/
│   │       │   ├── wifi_manager/
│   │       │   │   ├── CMakeLists.txt
│   │       │   │   ├── include/
│   │       │   │   │   └── wifi_manager.h
│   │       │   │   └── wifi_manager.c
│   │       │   ├── csi_manager/
│   │       │   │   ├── CMakeLists.txt
│   │       │   │   ├── include/
│   │       │   │   │   └── csi_manager.h
│   │       │   │   └── csi_manager.c
│   │       │   └── udp_sender/
│   │       │       ├── CMakeLists.txt
│   │       │       ├── include/
│   │       │       │   └── udp_sender.h
│   │       │       └── udp_sender.c
│   │       ├── main/
│   │       │   ├── CMakeLists.txt
│   │       │   ├── Kconfig.projbuild
│   │       │   └── main.c
│   │       ├── CMakeLists.txt
│   │       └── sdkconfig.defaults
│   ├── csi_receiver.py          # Python CSI receiver script
│   └── data/                    # CSI data storage
└── ...
```

---

## Hardware Setup

### Components Required
- 4 × ESP32-WROOM-32 development boards
- 2.4 GHz WiFi router
- 12 V power supply
- LM2596 buck converters
- Jumper wires

### Wiring Diagram
```
12V Power Supply → LM2596 (set to 5V) → ESP32 VIN/GND
```

---

## Firmware Setup (ESP32)

### Prerequisites
- ESP-IDF v5.2.7 installed
- ESP32 board connected via USB

### Configuration
1. Navigate to the firmware directory:
   ```bash
   cd ESP_32/esp32_wroom32_csi_idf/csi_node
   ```

2. Configure WiFi and Node ID (optional, defaults in sdkconfig.defaults):
   ```bash
   idf.py menuconfig
   # Go to "EAGLE-Δ CSI Node Configuration"
   ```

3. Build and flash:
   ```bash
   idf.py build
   idf.py -p &lt;PORT&gt; flash monitor
   ```

### Repeat for All Nodes
For each of the 4 nodes, change the Node ID in `menuconfig` to a unique value (1‑4) before flashing.

---

## Python Backend Setup

### Installation
```bash
cd ESP_32
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate
```

### Usage
Start the CSI receiver:
```bash
python csi_receiver.py -p 3021 -o ./data/csi
```

Options:
- `-p, --port`: UDP port (default: 3021)
- `-o, --output-dir`: Directory to save CSI data
- `--no-save`: Don't save to files
- `--no-print`: Don't print to console

---

## Data Format

### CSI Packet Structure (CSV)
```
CSI_DATA,node_id,sequence,timestamp_us,rssi,channel,sig_mode,mcs,cwb,stbc,length,[csi_data...]
```

### Saved Data Format (JSONL)
Each line is a JSON object:
```json
{
  "node_id": 3,
  "sequence_number": 12345,
  "timestamp_us": 9876543210,
  "rssi": -45,
  "channel": 6,
  "sig_mode": 0,
  "mcs": 3,
  "cwb": 0,
  "stbc": 0,
  "len": 128,
  "data": [...],
  "received_at": "2026-07-13T09:15:30.123456"
}
```

---

## Testing Procedure

1. Start the Python CSI receiver
2. Power on all ESP32 nodes
3. Verify WiFi connection on each node (via serial monitor)
4. Verify CSI data is being received and saved
5. Test with empty room and occupied room to see differences

---

## Common Issues &amp; Debugging

### No WiFi Connection
- Verify SSID/password
- Check router is 2.4 GHz
- Use `idf.py monitor` to view logs

### No CSI Data
- Ensure WiFi is connected
- Verify promiscuous mode is active
- Generate some WiFi traffic (e.g., ping from another device)

### High Packet Loss
- Increase queue size in `csi_manager` or `udp_sender`
- Use a wired connection for receiver if possible

---

## Next Steps
Proceed to Phase 2: Signal Processing

