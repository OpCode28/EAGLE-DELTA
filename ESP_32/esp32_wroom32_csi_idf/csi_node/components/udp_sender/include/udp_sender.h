
#ifndef UDP_SENDER_H
#define UDP_SENDER_H

#include &lt;stdint.h&gt;
#include "csi_manager.h"

#ifdef __cplusplus
extern "C" {
#endif

#define UDP_PAYLOAD_BUF_SIZE 1024

/**
 * @brief Initialize UDP sender
 * 
 * @param node_id Unique ID for this ESP32 node
 * @param dest_ip Destination IP address string
 * @param dest_port Destination UDP port
 * @return esp_err_t ESP_OK on success, error code otherwise
 */
esp_err_t udp_sender_init(uint8_t node_id, const char* dest_ip, uint16_t dest_port);

/**
 * @brief Send CSI data via UDP
 * 
 * @param data CSI data to send
 * @return esp_err_t ESP_OK on success, error code otherwise
 */
esp_err_t udp_sender_send_csi(csi_data_t* data);

/**
 * @brief Start UDP sender task
 * 
 * @return esp_err_t ESP_OK on success, error code otherwise
 */
esp_err_t udp_sender_start_task(void);

#ifdef __cplusplus
}
#endif

#endif // UDP_SENDER_H

