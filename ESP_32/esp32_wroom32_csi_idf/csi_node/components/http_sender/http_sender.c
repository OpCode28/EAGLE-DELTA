
#include "http_sender.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "esp_http_client.h"
#include "cJSON.h"
#include <string.h>
#include <inttypes.h>

static const char* TAG = "http_sender";

static uint8_t s_node_id = 0;
static const char* s_backend_host = NULL;
static uint16_t s_backend_port = 0;
static const char* s_backend_path = NULL;

static QueueHandle_t s_csi_queue = NULL;
static TaskHandle_t s_http_task_handle = NULL;
static bool s_initialized = false;

// CSI batch buffer
static float s_csi_batch[BATCH_SIZE][CSI_MAX_SUBCARRIERS];
static volatile int s_csi_batch_count = 0;
static SemaphoreHandle_t s_batch_mutex = NULL;

/**
 * @brief CSI data callback to fill batch
 */
static void http_sender_csi_callback(csi_data_t* data)
{
    if (!s_initialized || s_batch_mutex == NULL || data == NULL) {
        return;
    }

    if (xSemaphoreTake(s_batch_mutex, pdMS_TO_TICKS(10)) != pdTRUE) {
        return;
    }

    // Extract real and imaginary parts, compute amplitude
    int subcarrier_count = (data->len / 2);
    if (subcarrier_count > CSI_MAX_SUBCARRIERS) {
        subcarrier_count = CSI_MAX_SUBCARRIERS;
    }

    for (int i = 0; i < subcarrier_count; i++) {
        int8_t real = data->data[2*i];
        int8_t imag = data->data[2*i+1];
        s_csi_batch[s_csi_batch_count][i] = sqrtf((float)(real*real) + (float)(imag*imag));
    }
    // Pad remaining subcarriers with 0
    for (int i = subcarrier_count; i < CSI_MAX_SUBCARRIERS; i++) {
        s_csi_batch[s_csi_batch_count][i] = 0.0f;
    }

    s_csi_batch_count++;

    if (s_csi_batch_count >= BATCH_SIZE) {
        // Send batch if queue available
        if (s_csi_queue != NULL) {
            // Copy batch to queue
            float (*batch_copy)[CSI_MAX_SUBCARRIERS] = pvPortMalloc(sizeof(float[BATCH_SIZE][CSI_MAX_SUBCARRIERS]));
            if (batch_copy != NULL) {
                memcpy(batch_copy, s_csi_batch, sizeof(float[BATCH_SIZE][CSI_MAX_SUBCARRIERS]));
                if (xQueueSend(s_csi_queue, &batch_copy, 0) != pdTRUE) {
                    vPortFree(batch_copy);
                    ESP_LOGW(TAG, "Queue full, dropping batch");
                }
            }
        }
        s_csi_batch_count = 0;
    }

    xSemaphoreGive(s_batch_mutex);
}

/**
 * @brief Build JSON payload for telemetry
 */
static char* build_telemetry_json(float (*batch)[CSI_MAX_SUBCARRIERS])
{
    cJSON* root = cJSON_CreateObject();
    if (!root) {
        ESP_LOGE(TAG, "Failed to create JSON root");
        return NULL;
    }

    // Node info
    cJSON_AddStringToObject(root, "node_key", "eagle-delta-node-esp-idf");
    char label[32];
    snprintf(label, sizeof(label), "ESP-IDF Node %" PRIu8, s_node_id);
    cJSON_AddStringToObject(root, "label", label);
    cJSON_AddStringToObject(root, "room", "esp_idf_room");
    cJSON_AddNumberToObject(root, "sample_rate_hz", 20.0);

    // CSI matrix
    cJSON* csi_matrix = cJSON_CreateArray();
    for (int i = 0; i < BATCH_SIZE; i++) {
        cJSON* subarray = cJSON_CreateArray();
        for (int j = 0; j < CSI_MAX_SUBCARRIERS; j++) {
            cJSON_AddItemToArray(subarray, cJSON_CreateNumber(batch[i][j]));
        }
        cJSON_AddItemToArray(csi_matrix, subarray);
    }
    cJSON_AddItemToObject(root, "csi_matrix", csi_matrix);

    char* json_str = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    return json_str;
}

/**
 * @brief HTTP client event handler
 */
static esp_err_t http_event_handler(esp_http_client_event_t* evt)
{
    switch (evt->event_id) {
        case HTTP_EVENT_ERROR:
            ESP_LOGW(TAG, "HTTP_EVENT_ERROR");
            break;
        case HTTP_EVENT_ON_CONNECTED:
            ESP_LOGD(TAG, "HTTP_EVENT_ON_CONNECTED");
            break;
        case HTTP_EVENT_HEADERS_SENT:
            ESP_LOGD(TAG, "HTTP_EVENT_HEADERS_SENT");
            break;
        case HTTP_EVENT_ON_DATA:
            ESP_LOGD(TAG, "HTTP_EVENT_ON_DATA, len=%d", evt->data_len);
            break;
        case HTTP_EVENT_ON_FINISH:
            ESP_LOGD(TAG, "HTTP_EVENT_ON_FINISH");
            break;
        case HTTP_EVENT_DISCONNECTED:
            ESP_LOGD(TAG, "HTTP_EVENT_DISCONNECTED");
            break;
        default:
            break;
    }
    return ESP_OK;
}

/**
 * @brief Send CSI batch to backend via HTTP POST
 */
static void send_csi_batch(float (*batch)[CSI_MAX_SUBCARRIERS])
{
    char* json_payload = build_telemetry_json(batch);
    if (!json_payload) {
        return;
    }

    // Build URL
    char url[128];
    snprintf(url, sizeof(url), "http://%s:%" PRIu16 "%s", s_backend_host, s_backend_port, s_backend_path);

    esp_http_client_config_t config = {
        .url = url,
        .method = HTTP_METHOD_POST,
        .event_handler = http_event_handler,
        .timeout_ms = 5000,
    };

    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (!client) {
        ESP_LOGE(TAG, "Failed to init HTTP client");
        cJSON_free(json_payload);
        return;
    }

    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_post_field(client, json_payload, strlen(json_payload));

    esp_err_t err = esp_http_client_perform(client);
    if (err == ESP_OK) {
        int status_code = esp_http_client_get_status_code(client);
        ESP_LOGI(TAG, "HTTP POST Status = %d", status_code);
    } else {
        ESP_LOGE(TAG, "HTTP POST request failed: %s", esp_err_to_name(err));
    }

    esp_http_client_cleanup(client);
    cJSON_free(json_payload);
}

/**
 * @brief HTTP sender task
 */
static void http_sender_task(void* arg)
{
    ESP_LOGI(TAG, "HTTP sender task started");

    while (true) {
        float (*batch)[CSI_MAX_SUBCARRIERS];
        if (xQueueReceive(s_csi_queue, &batch, pdMS_TO_TICKS(1000)) == pdTRUE) {
            send_csi_batch(batch);
            vPortFree(batch);
        }
    }
}

esp_err_t http_sender_init(uint8_t node_id, const char* backend_host, uint16_t backend_port, const char* backend_path)
{
    if (s_initialized) {
        ESP_LOGW(TAG, "HTTP sender already initialized");
        return ESP_OK;
    }

    s_node_id = node_id;
    s_backend_host = backend_host;
    s_backend_port = backend_port;
    s_backend_path = backend_path;

    // Create batch mutex
    s_batch_mutex = xSemaphoreCreateMutex();
    if (s_batch_mutex == NULL) {
        ESP_LOGE(TAG, "Failed to create batch mutex");
        return ESP_ERR_NO_MEM;
    }

    // Create queue
    s_csi_queue = xQueueCreate(4, sizeof(float (*)[CSI_MAX_SUBCARRIERS]));
    if (s_csi_queue == NULL) {
        ESP_LOGE(TAG, "Failed to create CSI queue");
        vSemaphoreDelete(s_batch_mutex);
        s_batch_mutex = NULL;
        return ESP_ERR_NO_MEM;
    }

    // Register callback
    ESP_ERROR_CHECK(csi_manager_register_callback(http_sender_csi_callback));

    s_initialized = true;
    ESP_LOGI(TAG, "HTTP sender initialized for node %" PRIu8, s_node_id);
    return ESP_OK;
}

esp_err_t http_sender_start_task(void)
{
    if (!s_initialized) {
        ESP_LOGE(TAG, "HTTP sender not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    BaseType_t ret = xTaskCreate(
        http_sender_task,
        "http_sender",
        HTTP_SENDER_TASK_STACK_SIZE,
        NULL,
        HTTP_SENDER_TASK_PRIORITY,
        &s_http_task_handle
    );
    if (ret != pdPASS) {
        ESP_LOGE(TAG, "Failed to create HTTP sender task");
        return ESP_FAIL;
    }

    ESP_LOGI(TAG, "HTTP sender task started");
    return ESP_OK;
}
