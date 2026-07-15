
#include "csi_manager.h"
#include "esp_log.h"
#include "esp_wifi.h"
#include &lt;string.h&gt;

static const char* TAG = "csi_manager";

static csi_data_callback_t s_csi_callback = NULL;
static uint32_t s_csi_sequence = 0;
static bool s_initialized = false;
static bool s_csi_active = false;

/**
 * @brief CSI receive callback function
 * 
 * @param ctx User context (unused)
 * @param info CSI information from WiFi driver
 */
static void csi_rx_cb(void* ctx, wifi_csi_info_t* info)
{
    if (!info || !info-&gt;buf || info-&gt;len == 0) {
        return;
    }

    if (!s_csi_callback) {
        return;
    }

    csi_data_t csi_data;
    csi_data.sequence_number = s_csi_sequence++;
    csi_data.timestamp_us = info-&gt;rx_ctrl.timestamp;
    csi_data.rssi = info-&gt;rx_ctrl.rssi;
    csi_data.channel = info-&gt;rx_ctrl.channel;
    csi_data.sig_mode = info-&gt;rx_ctrl.sig_mode;
    csi_data.mcs = info-&gt;rx_ctrl.mcs;
    csi_data.cwb = info-&gt;rx_ctrl.cwb;
    csi_data.stbc = info-&gt;rx_ctrl.stbc;
    csi_data.len = (info-&gt;len &gt; CSI_MAX_LEN) ? CSI_MAX_LEN : info-&gt;len;
    memcpy(csi_data.data, info-&gt;buf, csi_data.len);

    s_csi_callback(&amp;csi_data);
}

esp_err_t csi_manager_init(void)
{
    if (s_initialized) {
        ESP_LOGW(TAG, "CSI manager already initialized");
        return ESP_OK;
    }

    ESP_LOGI(TAG, "Initializing CSI manager...");
    s_initialized = true;
    return ESP_OK;
}

esp_err_t csi_manager_register_callback(csi_data_callback_t callback)
{
    if (!callback) {
        ESP_LOGE(TAG, "Callback cannot be NULL");
        return ESP_ERR_INVALID_ARG;
    }

    s_csi_callback = callback;
    ESP_LOGI(TAG, "CSI callback registered");
    return ESP_OK;
}

esp_err_t csi_manager_start(void)
{
    if (!s_initialized) {
        ESP_LOGE(TAG, "CSI manager not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    if (s_csi_active) {
        ESP_LOGW(TAG, "CSI capture already active");
        return ESP_OK;
    }

    // Configure CSI
    wifi_csi_config_t csi_config = {
        .lltf_en = true,
        .htltf_en = true,
        .stbc_htltf2_en = true,
        .ltf_merge_en = true,
        .channel_filter_en = false,
        .manu_scale = false,
        .shift = 0,
        .dump_ack_en = false,
    };

    // Apply configuration
    ESP_ERROR_CHECK(esp_wifi_set_promiscuous(false));
    ESP_ERROR_CHECK(esp_wifi_set_csi_rx_cb(csi_rx_cb, NULL));
    ESP_ERROR_CHECK(esp_wifi_set_csi_config(&amp;csi_config));
    ESP_ERROR_CHECK(esp_wifi_set_csi(true));
    ESP_ERROR_CHECK(esp_wifi_set_promiscuous(true));

    s_csi_active = true;
    ESP_LOGI(TAG, "CSI capture started!");
    return ESP_OK;
}

esp_err_t csi_manager_stop(void)
{
    if (!s_csi_active) {
        ESP_LOGW(TAG, "CSI capture not active");
        return ESP_OK;
    }

    ESP_ERROR_CHECK(esp_wifi_set_csi(false));
    s_csi_active = false;
    ESP_LOGI(TAG, "CSI capture stopped");
    return ESP_OK;
}

