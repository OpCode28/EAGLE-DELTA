#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "esp_wifi.h"
#include "esp_log.h"
#include "esp_event.h"
#include "nvs_flash.h"
#include "wifi_manager.h"
#include "ble_provisioning.h"

#define TAG "WIFI_MGR"

static char saved_ssid[32] = {0};
static char saved_pass[64] = {0};
static bool has_creds = false;

static void wifi_event_handler(void* arg, esp_event_base_t event_base,
                               int32_t event_id, void* event_data) {
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        ESP_LOGW(TAG, "Disconnected from Wi-Fi. Reconnecting...");
        esp_wifi_connect();
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t* event = (ip_event_got_ip_t*) event_data;
        ESP_LOGI(TAG, "Connected! IP: " IPSTR, IP2STR(&event->ip_info.ip));
    }
}

void wifi_manager_init(void) {
    esp_netif_init();
    esp_event_loop_create_default();
    esp_netif_create_default_wifi_sta();
    
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    esp_wifi_init(&cfg);

    esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL, NULL);
    esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL, NULL);

    nvs_handle_t my_handle;
    if (nvs_open("netra32", NVS_READONLY, &my_handle) == ESP_OK) {
        size_t len = sizeof(saved_ssid);
        if (nvs_get_str(my_handle, "ssid", saved_ssid, &len) == ESP_OK) {
            len = sizeof(saved_pass);
            nvs_get_str(my_handle, "password", saved_pass, &len);
            has_creds = true;
        }
        nvs_close(my_handle);
    }
}

bool wifi_manager_has_credentials(void) {
    return has_creds;
}

void wifi_manager_connect(void) {
    if (!has_creds) {
        ESP_LOGI(TAG, "No credentials found. Start BLE.");
        ble_provisioning_start();
        return;
    }
    
    ESP_LOGI(TAG, "Connecting to %s", saved_ssid);
    
    wifi_config_t wifi_config = {0};
    strncpy((char*)wifi_config.sta.ssid, saved_ssid, sizeof(wifi_config.sta.ssid));
    strncpy((char*)wifi_config.sta.password, saved_pass, sizeof(wifi_config.sta.password));
    
    esp_wifi_set_mode(WIFI_MODE_STA);
    esp_wifi_set_config(WIFI_IF_STA, &wifi_config);
    esp_wifi_start();
}
