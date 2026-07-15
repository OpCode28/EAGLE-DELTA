
#ifndef CSI_MANAGER_H
#define CSI_MANAGER_H

#include &lt;stdint.h&gt;
#include &lt;stdbool.h&gt;
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

#define CSI_MAX_LEN 512

/**
 * @brief CSI data structure
 */
typedef struct {
    uint32_t sequence_number;
    uint32_t timestamp_us;
    int8_t rssi;
    uint8_t channel;
    uint8_t sig_mode;
    uint8_t mcs;
    uint8_t cwb;
    uint8_t stbc;
    uint16_t len;
    int8_t data[CSI_MAX_LEN];
} csi_data_t;

/**
 * @brief CSI callback function type
 */
typedef void (*csi_data_callback_t)(csi_data_t* data);

/**
 * @brief Initialize CSI manager
 * 
 * @return esp_err_t ESP_OK on success, error code otherwise
 */
esp_err_t csi_manager_init(void);

/**
 * @brief Register callback for CSI data
 * 
 * @param callback Callback function pointer
 * @return esp_err_t ESP_OK on success, error code otherwise
 */
esp_err_t csi_manager_register_callback(csi_data_callback_t callback);

/**
 * @brief Start CSI capture
 * 
 * @return esp_err_t ESP_OK on success, error code otherwise
 */
esp_err_t csi_manager_start(void);

/**
 * @brief Stop CSI capture
 * 
 * @return esp_err_t ESP_OK on success, error code otherwise
 */
esp_err_t csi_manager_stop(void);

#ifdef __cplusplus
}
#endif

#endif // CSI_MANAGER_H

