/*
  eagle_delta_node.ino
  -----------------------------------------------------------------------
  EAGLE∆ edge node firmware for ESP32.

  Features:
  - Access Point (AP) fallback provisioning mode (`EAGLE-SETUP`)
  - Wi-Fi connection via credentials saved in Preferences (NVS)
  - Real Wi-Fi CSI extraction via esp_wifi_set_csi_rx_cb
  - 20Hz sampling batched to 1-second chunks for HTTP POST
-----------------------------------------------------------------------
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <esp_wifi.h>
#include <esp_timer.h>
#include <esp_mac.h>
#include <Preferences.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// ---------------------------------------------------------------------
// Core configuration (Dynamic via NVS & mDNS)
// ---------------------------------------------------------------------
String backend_host = "";
int backend_port = 4032;
const char* TELEMETRY_PATH = "/api/netra32/telemetry";

String node_key = "eagle-delta-node-default";
String node_label = "Unconfigured Node";
String node_room  = "unassigned";

// ---------------------------------------------------------------------
// 🚨 URGENT DEMO OVERRIDE 🚨
// If you are presenting tomorrow and provisioning is failing, just type 
// your Wi-Fi details here. 
// The ESP32 will skip provisioning and connect directly!
// ---------------------------------------------------------------------
const char* HARDCODED_SSID = "CSI_Project";          // Example: "MyWiFi"
const char* HARDCODED_PASSWORD = "67110926";      // Example: "MyPassword"
const char* HARDCODED_BACKEND_IP = "192.168.1.104";    // Example: "192.168.1.104" (Set your laptop IP here to skip scanning!)

Preferences preferences;
WebServer server(80);

String wifi_ssid = "";
String wifi_password = "";
bool is_provisioning = false;

const int CSI_SUBCARRIERS = 64; 
const int BATCH_SIZE = 20;      
float csi_matrix[BATCH_SIZE][CSI_SUBCARRIERS];
volatile int csi_sample_count = 0;
volatile bool batch_ready = false;

// Double Buffer for Thread Safety
float double_buffer[BATCH_SIZE][CSI_SUBCARRIERS];
volatile bool db_ready = false;
portMUX_TYPE csi_spinlock = portMUX_INITIALIZER_UNLOCKED;

// Metrics
unsigned long packets_sent = 0;
unsigned long packet_sequence = 0;
char json_buffer[10240];

// ---------------------------------------------------------------------
// BLE Provisioning Handlers
// ---------------------------------------------------------------------
class ProvisioningCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String rxValue = pCharacteristic->getValue();
      if (rxValue.length() > 0) {
        String payload = rxValue;
        Serial.println("[eagle-delta] Received BLE provisioning payload: " + payload);

        // Rudimentary JSON extraction
        int ssidStart = payload.indexOf("\"ssid\":\"") + 8;
        if (ssidStart < 8) return; // Invalid payload
        int ssidEnd = payload.indexOf("\"", ssidStart);
        String newSsid = payload.substring(ssidStart, ssidEnd);

        int passStart = payload.indexOf("\"password\":\"") + 12;
        int passEnd = payload.indexOf("\"", passStart);
        String newPass = payload.substring(passStart, passEnd);
        
        int nameStart = payload.indexOf("\"name\":\"");
        String newName = "";
        if (nameStart > -1) {
          nameStart += 8;
          int nameEnd = payload.indexOf("\"", nameStart);
          newName = payload.substring(nameStart, nameEnd);
        }

        if (newSsid.length() > 0) {
          preferences.begin("netra32_v2", false);
          preferences.putString("ssid", newSsid);
          preferences.putString("password", newPass);
          if (newName.length() > 0) {
            preferences.putString("name", newName);
          }
          preferences.end();
          
          Serial.println("[eagle-delta] Credentials saved. Rebooting in 2s...");
          delay(2000);
          ESP.restart();
        }
      }
    }
};

// ---------------------------------------------------------------------
// Network Setup
// ---------------------------------------------------------------------
void scanForBackend() {
  Serial.println("[eagle-delta] mDNS failed. Scanning local subnet outwards for backend on port 4032...");
  IPAddress local = WiFi.localIP();
  int base = local[3];
  
  // Check the base IP first if somehow it matches (unlikely)
  WiFiClient client;
  client.setTimeout(80);
  if (client.connect(local, 4032)) {
    backend_host = local.toString();
    backend_port = 4032;
    client.stop();
    Serial.printf("[eagle-delta] Found backend at %s:%d\n", backend_host.c_str(), backend_port);
    return;
  }

  for (int offset = 1; offset < 255; offset++) {
    delay(1); // Yield and feed the Task Watchdog Timer (WDT) to prevent reboots!

    int targets[2] = { base - offset, base + offset };
    for (int t = 0; t < 2; t++) {
      int last_octet = targets[t];
      if (last_octet < 1 || last_octet > 254) continue;

      IPAddress target = local;
      target[3] = last_octet;

      WiFiClient targetClient;
      targetClient.setTimeout(80); // 80ms is plenty for local LAN ping-pong
      if (targetClient.connect(target, 4032)) {
        backend_host = target.toString();
        backend_port = 4032;
        targetClient.stop();
        Serial.printf("[eagle-delta] Found backend via Outward Subnet Scan at %s:%d\n", backend_host.c_str(), backend_port);
        return;
      }
    }
  }
  Serial.println("[eagle-delta] Outward subnet scan failed. Backend not found.");
}

void connectOrFallback() {
  preferences.begin("netra32_v2", true);
  wifi_ssid = preferences.getString("ssid", "");
  wifi_password = preferences.getString("password", "");
  String savedName = preferences.getString("name", "");
  if (savedName.length() > 0) {
    node_label = savedName;
  }
  
  // Read hardware MAC address directly from eFuse to prevent 00:00:00:00:00:00 issue
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_WIFI_STA);
  char mac_str[18];
  snprintf(mac_str, sizeof(mac_str), "%02X:%02X:%02X:%02X:%02X:%02X", 
           mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  node_key = String(mac_str);
  
  preferences.end();

  if (String(HARDCODED_BACKEND_IP).length() > 0) {
    backend_host = String(HARDCODED_BACKEND_IP);
    backend_port = 4032;
    Serial.printf("[eagle-delta] HARDCODED OVERRIDE: Using backend IP %s:%d\n", backend_host.c_str(), backend_port);
  }

  if (String(HARDCODED_SSID).length() > 0) {
    wifi_ssid = String(HARDCODED_SSID);
    wifi_password = String(HARDCODED_PASSWORD);
  }

  if (wifi_ssid.length() == 0) {
    Serial.println("[eagle-delta] No Wi-Fi credentials found. Starting AP Provisioning.");
    startBLEProvisioning();
    return;
  }

  Serial.printf("[eagle-delta] connecting to local SSID: %s\n", wifi_ssid.c_str());
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifi_ssid.c_str(), wifi_password.c_str());

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (millis() - start > 15000) {
      Serial.println("\n[eagle-delta] connection timeout, falling back to AP provisioning...");
      startBLEProvisioning();
      return;
    }
  }
  
  Serial.println();
  Serial.printf("[eagle-delta] connected, local IP: %s\n", WiFi.localIP().toString().c_str());
  is_provisioning = false;
  
  if (backend_host.length() == 0) {
    if (!MDNS.begin("eagle-node")) {
      Serial.println("[eagle-delta] Error starting mDNS responder");
      scanForBackend();
    } else {
      Serial.println("[eagle-delta] mDNS started. Querying for Netra32 service (_eagle._tcp)...");
      int n = MDNS.queryService("eagle", "tcp");
      if (n > 0) {
        backend_host = MDNS.address(0).toString();
        backend_port = MDNS.port(0);
        Serial.printf("[eagle-delta] Found backend via mDNS Service Discovery at %s:%d\n", backend_host.c_str(), backend_port);
      } else {
        scanForBackend();
      }
    }
  }
  
  // Initialize ESP32 CSI only in STA mode
  ESP_ERROR_CHECK(esp_wifi_set_promiscuous(true));
  ESP_ERROR_CHECK(esp_wifi_set_csi_rx_cb(&csi_rx_cb, NULL));
  ESP_ERROR_CHECK(esp_wifi_set_csi(true));
  Serial.println("[eagle-delta] CSI collection enabled.");

  // Start web server for STA mode (identify requests)
  setupWebServer();
}

void startBLEProvisioning() {
  is_provisioning = true;
  String mac = WiFi.macAddress();
  mac.replace(":", "");
  String bleName = "EAGLE-" + mac.substring(mac.length() - 4);
  
  BLEDevice::init(bleName.c_str());
  BLEDevice::setMTU(512);
  BLEServer *pServer = BLEDevice::createServer();
  BLEService *pService = pServer->createService(SERVICE_UUID);
  BLECharacteristic *pCharacteristic = pService->createCharacteristic(
                                         CHARACTERISTIC_UUID,
                                         BLECharacteristic::PROPERTY_WRITE
                                       );
  pCharacteristic->setCallbacks(new ProvisioningCallbacks());
  pService->start();
  
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  BLEDevice::startAdvertising();
  
  // FALLBACK: Also start Wi-Fi AP Mode so the user can provision via HTTP!
  WiFi.mode(WIFI_AP);
  WiFi.softAP(bleName.c_str());
  Serial.printf("[eagle-delta] Wi-Fi AP Provisioning started at IP: 192.168.4.1\n");

  server.on("/provision", HTTP_POST, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    String payload = server.arg("plain");
    
    if (payload.length() == 0) {
        // Fallback for some clients
        for (uint8_t i = 0; i < server.args(); i++) {
            if (server.argName(i) == "plain") {
                payload = server.arg(i);
            }
        }
    }

    Serial.println("[eagle-delta] Received HTTP provisioning payload: " + payload);

    int ssidStart = payload.indexOf("\"ssid\":\"");
    if (ssidStart == -1) {
      server.send(400, "application/json", "{\"error\":\"Missing ssid\"}");
      return;
    }
    ssidStart += 8;
    int ssidEnd = payload.indexOf("\"", ssidStart);
    String newSsid = payload.substring(ssidStart, ssidEnd);

    int passStart = payload.indexOf("\"password\":\"");
    if (passStart == -1) {
      server.send(400, "application/json", "{\"error\":\"Missing password\"}");
      return;
    }
    passStart += 12;
    int passEnd = payload.indexOf("\"", passStart);
    String newPass = payload.substring(passStart, passEnd);

    if (newSsid.length() > 0) {
      preferences.begin("netra32_v2", false);
      preferences.putString("ssid", newSsid);
      preferences.putString("password", newPass);
      preferences.end();
      
      server.send(200, "application/json", "{\"ok\":true}");
      Serial.println("[eagle-delta] HTTP Credentials saved. Rebooting in 2s...");
      delay(2000);
      ESP.restart();
    } else {
      server.send(400, "application/json", "{\"error\":\"Invalid payload\"}");
    }
  });
  
  server.on("/identify", HTTP_OPTIONS, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    server.send(204);
  });

  server.on("/provision", HTTP_OPTIONS, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.sendHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
    server.send(204);
  });

  server.begin();
  
  Serial.println("[eagle-delta] BLE Provisioning started as " + bleName);
}

void setupWebServer() {
  
  server.on("/identify", HTTP_POST, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "application/json", "{\"ok\":true}");
    Serial.println("[eagle-delta] Identify triggered. Blinking LED...");
    // Blink onboard LED (usually GPIO 2) for 5 seconds
    pinMode(2, OUTPUT);
    for (int i = 0; i < 25; i++) {
      digitalWrite(2, HIGH);
      delay(100);
      digitalWrite(2, LOW);
      delay(100);
    }
  });

  server.on("/health", HTTP_GET, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    unsigned long uptime = millis();
    int rssi = WiFi.RSSI();
    uint32_t free_heap = ESP.getFreeHeap();
    String version = "1.0.0-arduino";
    
    String json = "{";
    json += "\"uptime_ms\":" + String(uptime) + ",";
    json += "\"rssi\":" + String(rssi) + ",";
    json += "\"free_heap_bytes\":" + String(free_heap) + ",";
    json += "\"firmware_version\":\"" + version + "\",";
    json += "\"packets_sent\":" + String(packets_sent);
    json += "}";
    
    server.send(200, "application/json", json);
  });
  
  server.begin();
}

// ---------------------------------------------------------------------
// ESP32 CSI Callback
// ---------------------------------------------------------------------
void csi_rx_cb(void *ctx, wifi_csi_info_t *info) {
  if (!info || !info->buf || info->len == 0 || db_ready || is_provisioning) return;

  int8_t* csi_data = (int8_t*)info->buf;
  int subcarrier_count = min((int)(info->len / 2), CSI_SUBCARRIERS);

  for (int i = 0; i < subcarrier_count; i++) {
    int8_t real = csi_data[2*i];
    int8_t imag = csi_data[2*i+1];
    csi_matrix[csi_sample_count][i] = sqrt((float)(real * real + imag * imag));
  }
  
  for (int i = subcarrier_count; i < CSI_SUBCARRIERS; i++) {
    csi_matrix[csi_sample_count][i] = 0.0f;
  }

  csi_sample_count++;
  if (csi_sample_count >= BATCH_SIZE) {
    portENTER_CRITICAL_ISR(&csi_spinlock);
    memcpy(double_buffer, csi_matrix, sizeof(csi_matrix));
    db_ready = true;
    csi_sample_count = 0;
    portEXIT_CRITICAL_ISR(&csi_spinlock);
  }
}

// ---------------------------------------------------------------------
// Telemetry
// ---------------------------------------------------------------------
void verifyWifiConnection() {
  if (is_provisioning || wifi_ssid.length() == 0) return;
  
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\n[eagle-delta] WiFi disconnected! Reconnecting...");
    WiFi.disconnect();
    WiFi.begin(wifi_ssid.c_str(), wifi_password.c_str());
    
    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 5000) {
      delay(500);
      Serial.print(".");
    }
    Serial.println();
    if (WiFi.status() == WL_CONNECTED) {
      Serial.printf("[eagle-delta] Reconnected! IP: %s\n", WiFi.localIP().toString().c_str());
    }
  }
}

String buildTelemetryJson(float matrix[BATCH_SIZE][CSI_SUBCARRIERS], unsigned long seq, uint64_t ts_us) {
  int offset = snprintf(json_buffer, sizeof(json_buffer), 
    "{\"node_key\":\"%s\",\"label\":\"%s\",\"room\":\"%s\",\"sample_rate_hz\":20.0,\"sequence\":%lu,\"timestamp_us\":%llu,\"csi_matrix\":[",
    node_key.c_str(), node_label.c_str(), node_room.c_str(), seq, ts_us);
    
  for (int i = 0; i < BATCH_SIZE; i++) {
    if (offset >= sizeof(json_buffer) - 10) break;
    json_buffer[offset++] = '[';
    for (int j = 0; j < CSI_SUBCARRIERS; j++) {
      int written = snprintf(json_buffer + offset, sizeof(json_buffer) - offset, "%.2f", matrix[i][j]);
      offset += written;
      if (j < CSI_SUBCARRIERS - 1) {
        if (offset >= sizeof(json_buffer) - 5) break;
        json_buffer[offset++] = ',';
      }
    }
    if (offset >= sizeof(json_buffer) - 5) break;
    json_buffer[offset++] = ']';
    if (i < BATCH_SIZE - 1) {
      if (offset >= sizeof(json_buffer) - 5) break;
      json_buffer[offset++] = ',';
    }
  }
  
  if (offset < sizeof(json_buffer) - 3) {
    json_buffer[offset++] = ']';
    json_buffer[offset++] = '}';
  }
  json_buffer[offset] = '\0';
  
  return String(json_buffer);
}

void postTelemetry(const String& jsonPayload) {
  if (WiFi.status() != WL_CONNECTED || backend_host.length() == 0) return;

  HTTPClient http;
  String url = String("http://") + backend_host + ":" + String(backend_port) + TELEMETRY_PATH;

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000); 

  int statusCode = http.POST(jsonPayload);
  if (statusCode > 0) {
    Serial.printf("[eagle-delta] POST %d -> batch sent\n", statusCode);
  } else {
    Serial.printf("[eagle-delta] POST failed: %s\n", http.errorToString(statusCode).c_str());
  }
  http.end();
}

// ---------------------------------------------------------------------
// Arduino lifecycle
// ---------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("[eagle-delta] EAGLE\u2206 edge node booting...");

  // Factory Reset Check (Hold BOOT button on startup to clear credentials)
  pinMode(0, INPUT_PULLUP);
  delay(100);
  if (digitalRead(0) == LOW) {
    Serial.println("[eagle-delta] BOOT button detected on startup! Clearing Wi-Fi credentials...");
    preferences.begin("netra32", false);
    preferences.clear();
    preferences.end();
    
    // Blink LED (GPIO 2) rapidly to confirm reset
    pinMode(2, OUTPUT);
    for (int i = 0; i < 15; i++) {
      digitalWrite(2, HIGH);
      delay(50);
      digitalWrite(2, LOW);
      delay(50);
    }
    Serial.println("[eagle-delta] Reset complete. Rebooting...");
    ESP.restart();
  }

  connectOrFallback();
}

void loop() {
  server.handleClient();
  
  verifyWifiConnection();

  if (!is_provisioning && db_ready) {
    float local_matrix[BATCH_SIZE][CSI_SUBCARRIERS];
    portENTER_CRITICAL(&csi_spinlock);
    memcpy(local_matrix, double_buffer, sizeof(double_buffer));
    db_ready = false;
    portEXIT_CRITICAL(&csi_spinlock);
    
    packet_sequence++;
    uint64_t timestamp_us = esp_timer_get_time();
    
    String payload = buildTelemetryJson(local_matrix, packet_sequence, timestamp_us);
    postTelemetry(payload);
    packets_sent++;
  }
}
