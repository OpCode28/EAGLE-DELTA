
#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include &lt;stdbool.h&gt;
#include "esp_event.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Initialize WiFi in station mode
 * 
 * @param ssid WiFi SSID to connect to
 * @param password WiFi password
 * @return esp_err_t ESP_OK on success, error code otherwise
 */
esp_err_t wifi_manager_init(const char* ssid, const char* password);

/**
 * @brief Check if WiFi is connected
 * 
 * @return true if connected, false otherwise
 */
bool wifi_manager_is_connected(void);

/**
 * @brief Wait for WiFi connection with timeout
 * 
 * @param timeout_ms Timeout in milliseconds
 * @return true if connected within timeout, false otherwise
 */
bool wifi_manager_wait_for_connection(uint32_t timeout_ms);

#ifdef __cplusplus
}
#endif

#endif // WIFI_MANAGER_H

