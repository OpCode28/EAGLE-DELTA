#include "nvs_flash.h"
#include "wifi_manager.h"
#include "csi_collector.h"
#include "telemetry_http.h"
#include "local_server.h"

void app_main(void) {
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
      ESP_ERROR_CHECK(nvs_flash_erase());
      ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    wifi_manager_init();
    
    wifi_manager_connect();
    
    if (wifi_manager_has_credentials()) {
        csi_collector_init();
        local_server_init();
        telemetry_http_init();
    }
}
