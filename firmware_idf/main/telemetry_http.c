#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "esp_http_client.h"
#include "esp_mac.h"
#include "mdns.h"
#include "cJSON.h"
#include "csi_collector.h"
#include "wifi_manager.h"

#define TAG "TELEMETRY"
#define BATCH_SIZE 20
#define SUBCARRIERS 64

static char backend_ip[32] = "";
static int backend_port = 4032;
static char node_mac[18] = "";

static void resolve_mdns(void) {
    ESP_LOGI(TAG, "Resolving _eagle._tcp.local ...");
    esp_ip4_addr_t addr;
    addr.addr = 0;
    
    esp_err_t err = mdns_query_a("eagle", 2000,  &addr);
    if (err == ESP_OK) {
        sprintf(backend_ip, IPSTR, IP2STR(&addr));
        ESP_LOGI(TAG, "Backend found at %s:%d", backend_ip, backend_port);
    } else {
        ESP_LOGW(TAG, "mDNS resolution failed.");
    }
}

static void telemetry_task(void *pvParameters) {
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    sprintf(node_mac, "%02X:%02X:%02X:%02X:%02X:%02X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);

    mdns_init();
    
    float matrix[BATCH_SIZE][SUBCARRIERS];

    while (1) {
        if (wifi_manager_has_credentials() && csi_collector_get_batch(matrix)) {
            if (strlen(backend_ip) == 0) {
                resolve_mdns();
            }
            
            if (strlen(backend_ip) > 0) {
                cJSON *root = cJSON_CreateObject();
                cJSON_AddStringToObject(root, "node_key", node_mac);
                cJSON_AddStringToObject(root, "label", "EAGLE Node");
                cJSON_AddStringToObject(root, "room", "unassigned");
                cJSON_AddNumberToObject(root, "sample_rate_hz", 20.0);
                
                cJSON *csi_array = cJSON_CreateArray();
                for (int i = 0; i < BATCH_SIZE; i++) {
                    cJSON *row = cJSON_CreateArray();
                    for (int j = 0; j < SUBCARRIERS; j++) {
                        cJSON_AddItemToArray(row, cJSON_CreateNumber(matrix[i][j]));
                    }
                    cJSON_AddItemToArray(csi_array, row);
                }
                cJSON_AddItemToObject(root, "csi_matrix", csi_array);
                
                char *json_str = cJSON_PrintUnformatted(root);
                cJSON_Delete(root);
                
                char url[128];
                snprintf(url, sizeof(url), "http://%s:%d/api/netra32/telemetry", backend_ip, backend_port);
                
                esp_http_client_config_t config = {
                    .url = url,
                    .method = HTTP_METHOD_POST,
                    .timeout_ms = 5000,
                };
                esp_http_client_handle_t client = esp_http_client_init(&config);
                esp_http_client_set_header(client, "Content-Type", "application/json");
                esp_http_client_set_post_field(client, json_str, strlen(json_str));
                
                esp_err_t err = esp_http_client_perform(client);
                if (err == ESP_OK) {
                    ESP_LOGD(TAG, "Telemetry batch sent. Status: %d", esp_http_client_get_status_code(client));
                } else {
                    ESP_LOGW(TAG, "HTTP POST failed: %s", esp_err_to_name(err));
                    memset(backend_ip, 0, sizeof(backend_ip)); // Force mDNS re-resolve
                }
                
                esp_http_client_cleanup(client);
                free(json_str);
            }
        } else {
            vTaskDelay(pdMS_TO_TICKS(50));
        }
    }
}

void telemetry_http_init(void) {
    xTaskCreate(telemetry_task, "telemetry_task", 8192, NULL, 5, NULL);
}
