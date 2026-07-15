idf_component_register(SRCS "main.c" "wifi_manager.c" "ble_provisioning.c" "csi_collector.c" "telemetry_http.c" "local_server.c"
                       INCLUDE_DIRS "."
                       REQUIRES nvs_flash esp_wifi esp_http_client esp_http_server mdns bt nimblestack json esp_netif)
