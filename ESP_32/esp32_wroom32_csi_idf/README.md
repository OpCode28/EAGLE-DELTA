# ESP32 WROOM-32 CSI Node

This is a separate ESP-IDF firmware project for CSI capture. It does not change the Arduino RSSI sketch.

## First build setup

Open ESP-IDF PowerShell, then run:

```powershell
cd C:\Users\OM\Desktop\RuView-main\esp32_wroom32_csi_idf\csi_node
idf.py set-target esp32
```

## Configure WiFi and node ID

Edit:

```text
C:\Users\OM\Desktop\RuView-main\esp32_wroom32_csi_idf\csi_node\main\csi_node.c
```

Change these lines:

```c
#define WIFI_SSID      "YOUR_WIFI_NAME"
#define WIFI_PASSWORD  "YOUR_WIFI_PASSWORD"
#define NODE_ID        1
```

Use `NODE_ID 1` for the first ESP32 and `NODE_ID 2` for the second ESP32.

## Flash and monitor

Node 1 example:

```powershell
idf.py -p COM3 flash monitor
```

Node 2 example:

```powershell
idf.py -p COM4 flash monitor
```

Exit monitor with:

```text
Ctrl + ]
```

## Generate CSI traffic

CSI arrives when the ESP32 receives WiFi packets. Keep a phone/laptop active on the same WiFi, or run:

```powershell
ping 192.168.29.1 -t
```

Replace `192.168.29.1` with your router IP if needed.

Expected serial output:

```text
CSI_DATA,1,0,12345678,-55,6,1,0,0,0,384,[...signed I/Q bytes...]
```

## Return to RSSI mode

Open Arduino IDE and upload your existing `wroom32_rssi_sketch.ino` again.