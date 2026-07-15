
#include <stdio.h>
#include "esp_log.h"
#include "nvs_flash.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "wifi_manager.h"
#include "csi_manager.h"
#include "udp_sender.h"
#include "http_sender.h"

// Configuration - these can be overridden via Kconfig (menuconfig)
#ifdef CONFIG_ESP_WIFI_SSID
#define WIFI_SSID CONFIG_ESP_WIFI_SSID
#else
#define WIFI_SSID "BAPU_07"
#endif

#ifdef CONFIG_ESP_WIFI_PASSWORD
#define WIFI_PASSWORD CONFIG_ESP_WIFI_PASSWORD
#else
#define WIFI_PASSWORD "Bapu@2005"
#endif

#ifdef CONFIG_ESP_CSI_NODE_ID
#define NODE_ID CONFIG_ESP_CSI_NODE_ID
#else
#define NODE_ID 3
#endif

#define UDP_DEST_PORT 3021
#define WIFI_CONNECT_TIMEOUT_MS 30000

// Backend configuration - these can be overridden via Kconfig (menuconfig)
#ifdef CONFIG_ESP_BACKEND_HOST
#define BACKEND_HOST CONFIG_ESP_BACKEND_HOST
#else
#define BACKEND_HOST "192.168.1.50"
#endif

#ifdef CONFIG_ESP_BACKEND_PORT
#define BACKEND_PORT CONFIG_ESP_BACKEND_PORT
#else
#define BACKEND_PORT 4032
#endif

#ifdef CONFIG_ESP_BACKEND_PATH
#define BACKEND_PATH CONFIG_ESP_BACKEND_PATH
#else
#define BACKEND_PATH "/api/netra32/telemetry"
#endif

static const char* TAG = "eagle_delta_main";

/**
 * @brief Application entry point
 */
void app_main(void)
{
    ESP_LOGI(TAG, "========================================");
    ESP_LOGI(TAG, "  EAGLE-Δ CSI Node Starting...");
    ESP_LOGI(TAG, "  Node ID: %d", NODE_ID);
    ESP_LOGI(TAG, "========================================");

    // Initialize NVS flash
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_LOGW(TAG, "Erasing NVS flash...");
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    // Initialize WiFi manager
    ESP_LOGI(TAG, "Initializing WiFi manager...");
    ESP_ERROR_CHECK(wifi_manager_init(WIFI_SSID, WIFI_PASSWORD));

    // Wait for WiFi connection
    ESP_LOGI(TAG, "Waiting for WiFi connection...");
    if (!wifi_manager_wait_for_connection(WIFI_CONNECT_TIMEOUT_MS)) {
        ESP_LOGE(TAG, "WiFi connection failed! Exiting...");
        return;
    }

    // Initialize CSI manager
    ESP_LOGI(TAG, "Initializing CSI manager...");
    ESP_ERROR_CHECK(csi_manager_init());

    // Initialize UDP sender
    ESP_LOGI(TAG, "Initializing UDP sender...");
    ESP_ERROR_CHECK(udp_sender_init(NODE_ID, NULL, UDP_DEST_PORT));

    // Start UDP sender task
    ESP_ERROR_CHECK(udp_sender_start_task());

    // Initialize HTTP sender
    ESP_LOGI(TAG, "Initializing HTTP sender...");
    ESP_ERROR_CHECK(http_sender_init(NODE_ID, BACKEND_HOST, BACKEND_PORT, BACKEND_PATH));

    // Start HTTP sender task
    ESP_ERROR_CHECK(http_sender_start_task());

    // Start CSI capture
    ESP_LOGI(TAG, "Starting CSI capture...");
    ESP_ERROR_CHECK(csi_manager_start());

    ESP_LOGI(TAG, "========================================");
    ESP_LOGI(TAG, "  EAGLE-Δ CSI Node is RUNNING!");
    ESP_LOGI(TAG, "========================================");

    // Main loop - just keep alive
    while (true) {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}

