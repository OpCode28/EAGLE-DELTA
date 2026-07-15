
#include "udp_sender.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "lwip/sockets.h"
#include "lwip/netdb.h"
#include &lt;string.h&gt;
#include &lt;inttypes.h&gt;
#include &lt;stdio.h&gt;

static const char* TAG = "udp_sender";

#define CSI_QUEUE_DEPTH 32
#define UDP_SENDER_TASK_STACK_SIZE 4096
#define UDP_SENDER_TASK_PRIORITY 5

static QueueHandle_t s_csi_queue = NULL;
static uint8_t s_node_id = 0;
static int s_sock = -1;
static struct sockaddr_in s_dest_addr;
static bool s_initialized = false;
static uint32_t s_csi_drop_count = 0;

/**
 * @brief UDP sender task
 * 
 * @param arg Task argument (unused)
 */
static void udp_sender_task(void* arg)
{
    ESP_LOGI(TAG, "UDP sender task started (Node ID: %d)", s_node_id);

    while (true) {
        csi_data_t data;
        if (xQueueReceive(s_csi_queue, &amp;data, pdMS_TO_TICKS(1000)) != pdTRUE) {
            continue;
        }

        // Format CSI data as string
        char payload[UDP_PAYLOAD_BUF_SIZE];
        int offset = 0;

        offset = snprintf(payload, UDP_PAYLOAD_BUF_SIZE,
                         "CSI_DATA,%d,%" PRIu32 ",%" PRIu32 ",%d,%d,%d,%d,%d,%d,[",
                         s_node_id,
                         data.sequence_number,
                         data.timestamp_us,
                         data.rssi,
                         data.channel,
                         data.sig_mode,
                         data.mcs,
                         data.cwb,
                         data.stbc,
                         data.len);

        if (offset &lt; 0 || offset &gt;= UDP_PAYLOAD_BUF_SIZE - 2) {
            ESP_LOGW(TAG, "Payload buffer full, skipping packet");
            continue;
        }

        // Append CSI data
        for (int i = 0; i &lt; data.len &amp;&amp; offset &lt; UDP_PAYLOAD_BUF_SIZE - 8; i++) {
            int written = snprintf(payload + offset, UDP_PAYLOAD_BUF_SIZE - offset, "%d", data.data[i]);
            if (written &lt; 0) {
                break;
            }
            offset += written;
            if (i + 1 &lt; data.len &amp;&amp; offset &lt; UDP_PAYLOAD_BUF_SIZE - 2) {
                payload[offset++] = ',';
            }
        }

        if (offset &lt; UDP_PAYLOAD_BUF_SIZE - 2) {
            payload[offset++] = ']';
            payload[offset++] = '\n';
            payload[offset] = '\0';
        }

        // Print to UART for debugging
        printf("%s", payload);

        // Send over UDP
        if (s_sock &gt;= 0) {
            int sent = sendto(s_sock, payload, offset, 0,
                            (struct sockaddr*)&amp;s_dest_addr, sizeof(s_dest_addr));
            if (sent &lt; 0) {
                ESP_LOGW(TAG, "Failed to send UDP packet: %d", errno);
            }
        }

        // Log drop count periodically
        if (s_csi_drop_count &gt; 0 &amp;&amp; s_csi_drop_count % 100 == 0) {
            ESP_LOGW(TAG, "Total CSI queue drops: %" PRIu32, s_csi_drop_count);
        }
    }

    // Cleanup (should never reach here)
    if (s_sock &gt;= 0) {
        close(s_sock);
    }
    vTaskDelete(NULL);
}

/**
 * @brief Callback to enqueue CSI data from csi_manager
 * 
 * @param data CSI data pointer
 */
static void udp_sender_csi_callback(csi_data_t* data)
{
    if (s_csi_queue == NULL || data == NULL) {
        return;
    }

    if (xQueueSend(s_csi_queue, data, 0) != pdTRUE) {
        s_csi_drop_count++;
    }
}

esp_err_t udp_sender_init(uint8_t node_id, const char* dest_ip, uint16_t dest_port)
{
    if (s_initialized) {
        ESP_LOGW(TAG, "UDP sender already initialized");
        return ESP_OK;
    }

    s_node_id = node_id;

    // Create queue
    s_csi_queue = xQueueCreate(CSI_QUEUE_DEPTH, sizeof(csi_data_t));
    if (s_csi_queue == NULL) {
        ESP_LOGE(TAG, "Failed to create CSI queue");
        return ESP_ERR_NO_MEM;
    }

    // Create UDP socket
    s_sock = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
    if (s_sock &lt; 0) {
        ESP_LOGE(TAG, "Failed to create UDP socket: %d", errno);
        vQueueDelete(s_csi_queue);
        s_csi_queue = NULL;
        return ESP_FAIL;
    }

    // Set up destination address
    memset(&amp;s_dest_addr, 0, sizeof(s_dest_addr));
    s_dest_addr.sin_family = AF_INET;
    s_dest_addr.sin_port = htons(dest_port);
    if (dest_ip != NULL) {
        s_dest_addr.sin_addr.s_addr = inet_addr(dest_ip);
    } else {
        // Default to broadcast
        s_dest_addr.sin_addr.s_addr = INADDR_BROADCAST;
        int broadcast_en = 1;
        setsockopt(s_sock, SOL_SOCKET, SO_BROADCAST, &amp;broadcast_en, sizeof(broadcast_en));
    }

    // Register callback with csi_manager
    ESP_ERROR_CHECK(csi_manager_register_callback(udp_sender_csi_callback));

    s_initialized = true;
    ESP_LOGI(TAG, "UDP sender initialized for Node %d, destination: %s:%d",
             node_id, dest_ip ? dest_ip : "255.255.255.255", dest_port);
    return ESP_OK;
}

esp_err_t udp_sender_send_csi(csi_data_t* data)
{
    if (!s_initialized || s_csi_queue == NULL || data == NULL) {
        return ESP_ERR_INVALID_STATE;
    }

    if (xQueueSend(s_csi_queue, data, pdMS_TO_TICKS(100)) != pdTRUE) {
        s_csi_drop_count++;
        return ESP_ERR_TIMEOUT;
    }

    return ESP_OK;
}

esp_err_t udp_sender_start_task(void)
{
    if (!s_initialized) {
        ESP_LOGE(TAG, "UDP sender not initialized");
        return ESP_ERR_INVALID_STATE;
    }

    BaseType_t ret = xTaskCreate(udp_sender_task,
                                 "udp_sender",
                                 UDP_SENDER_TASK_STACK_SIZE,
                                 NULL,
                                 UDP_SENDER_TASK_PRIORITY,
                                 NULL);
    if (ret != pdPASS) {
        ESP_LOGE(TAG, "Failed to create UDP sender task");
        return ESP_FAIL;
    }

    ESP_LOGI(TAG, "UDP sender task started");
    return ESP_OK;
}

