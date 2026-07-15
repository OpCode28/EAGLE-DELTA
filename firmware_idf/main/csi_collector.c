#include <stdio.h>
#include <string.h>
#include <math.h>
#include "esp_wifi.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "csi_collector.h"

#define TAG "CSI_COLLECTOR"
#define BATCH_SIZE 20
#define SUBCARRIERS 64

static float csi_matrix[BATCH_SIZE][SUBCARRIERS];
static volatile int csi_idx = 0;
static volatile bool batch_ready = false;
static portMUX_TYPE csi_spinlock = portMUX_INITIALIZER_UNLOCKED;

static void wifi_csi_rx_cb(void *ctx, wifi_csi_info_t *info) {
    if (!info || !info->buf || info->len == 0) return;
    if (batch_ready) return;

    int8_t *csi_data = (int8_t *)info->buf;
    int subcarrier_count = (info->len / 2 > SUBCARRIERS) ? SUBCARRIERS : (info->len / 2);

    // Write to matrix slot (only csi_idx is shared, which we protect when incrementing)
    for (int i = 0; i < subcarrier_count; i++) {
        int8_t real = csi_data[2 * i];
        int8_t imag = csi_data[2 * i + 1];
        csi_matrix[csi_idx][i] = sqrt((float)(real * real + imag * imag));
    }
    for (int i = subcarrier_count; i < SUBCARRIERS; i++) {
        csi_matrix[csi_idx][i] = 0.0f;
    }

    portENTER_CRITICAL(&csi_spinlock);
    csi_idx++;
    if (csi_idx >= BATCH_SIZE) {
        batch_ready = true;
    }
    portEXIT_CRITICAL(&csi_spinlock);
}

void csi_collector_init(void) {
    ESP_ERROR_CHECK(esp_wifi_set_promiscuous(true));
    ESP_ERROR_CHECK(esp_wifi_set_csi_rx_cb(&wifi_csi_rx_cb, NULL));
    ESP_ERROR_CHECK(esp_wifi_set_csi_config(&(wifi_csi_config_t){
        .lltf_en = true,
        .htltf_en = true,
        .stbc_htltf2_en = true,
        .ltf_merge_en = true,
        .channel_filter_en = true,
        .manu_scale = false,
        .shift = false
    }));
    ESP_ERROR_CHECK(esp_wifi_set_csi(true));
    
    ESP_LOGI(TAG, "CSI collection initialized with spinlock.");
}

bool csi_collector_get_batch(float out_matrix[BATCH_SIZE][SUBCARRIERS]) {
    if (!batch_ready) return false;
    
    // Copy matrix safely while batch_ready prevents cb from writing
    memcpy(out_matrix, csi_matrix, sizeof(csi_matrix));
    
    portENTER_CRITICAL(&csi_spinlock);
    csi_idx = 0;
    batch_ready = false;
    portEXIT_CRITICAL(&csi_spinlock);
    
    return true;
}

