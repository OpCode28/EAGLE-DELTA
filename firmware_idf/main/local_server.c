#include "esp_http_server.h"
#include "esp_log.h"
#include "driver/gpio.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "local_server.h"

#define TAG "LOCAL_SERVER"
#define BLINK_GPIO 2

static esp_err_t identify_post_handler(httpd_req_t *req) {
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    httpd_resp_send(req, "{\"ok\":true}", HTTPD_RESP_USE_STRLEN);
    
    ESP_LOGI(TAG, "Identify triggered. Blinking LED...");
    gpio_reset_pin(BLINK_GPIO);
    gpio_set_direction(BLINK_GPIO, GPIO_MODE_OUTPUT);
    
    for (int i = 0; i < 25; i++) {
        gpio_set_level(BLINK_GPIO, 1);
        vTaskDelay(pdMS_TO_TICKS(100));
        gpio_set_level(BLINK_GPIO, 0);
        vTaskDelay(pdMS_TO_TICKS(100));
    }
    return ESP_OK;
}

static esp_err_t options_handler(httpd_req_t *req) {
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    httpd_resp_set_hdr(req, "Access-Control-Allow-Methods", "POST, OPTIONS");
    httpd_resp_set_hdr(req, "Access-Control-Allow-Headers", "Content-Type");
    httpd_resp_set_status(req, "204 No Content");
    httpd_resp_send(req, NULL, 0);
    return ESP_OK;
}

static const httpd_uri_t identify_uri = {
    .uri       = "/identify",
    .method    = HTTP_POST,
    .handler   = identify_post_handler,
    .user_ctx  = NULL
};

static const httpd_uri_t identify_opts = {
    .uri       = "/identify",
    .method    = HTTP_OPTIONS,
    .handler   = options_handler,
    .user_ctx  = NULL
};

void local_server_init(void) {
    httpd_handle_t server = NULL;
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();

    if (httpd_start(&server, &config) == ESP_OK) {
        httpd_register_uri_handler(server, &identify_uri);
        httpd_register_uri_handler(server, &identify_opts);
        ESP_LOGI(TAG, "Local server started on port %d", config.server_port);
    } else {
        ESP_LOGE(TAG, "Error starting local server");
    }
}
