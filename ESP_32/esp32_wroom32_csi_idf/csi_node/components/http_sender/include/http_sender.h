
#ifndef HTTP_SENDER_H
#define HTTP_SENDER_H

#include <stdint.h>
#include "csi_manager.h"
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

#define BATCH_SIZE 20
#define CSI_MAX_SUBCARRIERS 64
#define HTTP_SENDER_TASK_STACK_SIZE 8192
#define HTTP_SENDER_TASK_PRIORITY 5

/**
 * @brief Initialize HTTP sender
 * 
 * @param node_id Unique node identifier
 * @param backend_host Backend server hostname/IP
 * @param backend_port Backend server port
 * @param backend_path Telemetry endpoint path
 * @return esp_err_t ESP_OK on success, error code otherwise
 */
esp_err_t http_sender_init(uint8_t node_id, const char* backend_host, uint16_t backend_port, const char* backend_path);

/**
 * @brief Start HTTP sender task
 * 
 * @return esp_err_t ESP_OK on success, error code otherwise
 */
esp_err_t http_sender_start_task(void);

#ifdef __cplusplus
}
#endif

#endif /* HTTP_SENDER_H */
