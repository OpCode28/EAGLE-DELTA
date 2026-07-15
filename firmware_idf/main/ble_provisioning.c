#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "esp_system.h"
#include "nvs_flash.h"
#include "esp_wifi.h"
#include "nimble/nimble_port.h"
#include "nimble/nimble_port_freertos.h"
#include "host/ble_hs.h"
#include "host/util/util.h"
#include "services/gap/ble_svc_gap.h"
#include "services/gatt/ble_svc_gatt.h"
#include "cJSON.h"

#define TAG "BLE_PROV"

static const ble_uuid128_t gatt_svr_svc_uuid =
    BLE_UUID128_INIT(0x4b, 0x91, 0x31, 0xc3, 0xc9, 0xc5, 0xcc, 0x8f, 0x9e, 0x45, 0xb5, 0x1f, 0x01, 0xc2, 0xaf, 0x4f);
    // 4fafc201-1fb5-459e-8fcc-c5c9c331914b in little-endian format
static const ble_uuid128_t gatt_svr_chr_uuid =
    BLE_UUID128_INIT(0xa8, 0x26, 0x1b, 0x36, 0x07, 0xea, 0xf5, 0xb7, 0x88, 0x46, 0xe1, 0x36, 0x3e, 0x48, 0xb5, 0xbe);
    // beb5483e-36e1-4688-b7f5-ea07361b26a8

static int gatt_svr_chr_access(uint16_t conn_handle, uint16_t attr_handle,
                               struct ble_gatt_access_ctxt *ctxt, void *arg);

static const struct ble_gatt_svc_def gatt_svr_svcs[] = {
    {
        .type = BLE_GATT_SVC_TYPE_PRIMARY,
        .uuid = &gatt_svr_svc_uuid.u,
        .characteristics = (struct ble_gatt_chr_def[])
        {
            {
                .uuid = &gatt_svr_chr_uuid.u,
                .access_cb = gatt_svr_chr_access,
                .flags = BLE_GATT_CHR_F_WRITE,
            },
            {
                0, 
            }
        },
    },
    {
        0, 
    },
};

static void ble_prov_save_credentials(const char *ssid, const char *password, const char *name) {
    nvs_handle_t my_handle;
    esp_err_t err = nvs_open("netra32", NVS_READWRITE, &my_handle);
    if (err == ESP_OK) {
        nvs_set_str(my_handle, "ssid", ssid);
        nvs_set_str(my_handle, "password", password);
        if (name) nvs_set_str(my_handle, "name", name);
        nvs_commit(my_handle);
        nvs_close(my_handle);
        ESP_LOGI(TAG, "Credentials saved! Rebooting...");
        vTaskDelay(2000 / portTICK_PERIOD_MS);
        esp_restart();
    }
}

static int gatt_svr_chr_access(uint16_t conn_handle, uint16_t attr_handle,
                               struct ble_gatt_access_ctxt *ctxt, void *arg) {
    if (ctxt->op == BLE_GATT_ACCESS_OP_WRITE_CHR) {
        char buf[256];
        int len = OS_MBUF_PKTLEN(ctxt->om);
        if (len >= sizeof(buf)) len = sizeof(buf) - 1;
        os_mbuf_copydata(ctxt->om, 0, len, buf);
        buf[len] = '\0';
        ESP_LOGI(TAG, "Received JSON: %s", buf);

        cJSON *json = cJSON_Parse(buf);
        if (json) {
            cJSON *ssid = cJSON_GetObjectItemCaseSensitive(json, "ssid");
            cJSON *password = cJSON_GetObjectItemCaseSensitive(json, "password");
            cJSON *name = cJSON_GetObjectItemCaseSensitive(json, "name");
            
            if (cJSON_IsString(ssid) && (ssid->valuestring != NULL) &&
                cJSON_IsString(password) && (password->valuestring != NULL)) {
                ble_prov_save_credentials(ssid->valuestring, password->valuestring, 
                                          (cJSON_IsString(name)) ? name->valuestring : "EAGLE Node");
            }
            cJSON_Delete(json);
        }
    }
    return 0;
}

static void ble_app_advertise(void) {
    struct ble_gap_adv_params adv_params;
    struct ble_hs_adv_fields fields;
    
    memset(&fields, 0, sizeof fields);
    fields.flags = BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP;
    fields.tx_pwr_lvl_is_present = 1;
    fields.tx_pwr_lvl = BLE_HS_ADV_TX_PWR_LVL_AUTO;

    uint8_t mac[6];
    esp_wifi_get_mac(WIFI_IF_STA, mac);
    char name[32];
    snprintf(name, sizeof(name), "EAGLE-%02x%02x", mac[4], mac[5]);
    
    fields.name = (uint8_t *)name;
    fields.name_len = strlen(name);
    fields.name_is_complete = 1;
    ble_gap_adv_set_fields(&fields);

    memset(&adv_params, 0, sizeof adv_params);
    adv_params.conn_mode = BLE_GAP_CONN_MODE_UND;
    adv_params.disc_mode = BLE_GAP_DISC_MODE_GEN;
    ble_gap_adv_start(BLE_OWN_ADDR_PUBLIC, NULL, BLE_HS_FOREVER, &adv_params, NULL, NULL);
}

static void ble_app_on_sync(void) {
    ble_hs_id_infer_auto(0, NULL);
    ble_app_advertise();
}

static void host_task(void *param) {
    nimble_port_run();
    nimble_port_freertos_deinit();
}

void ble_provisioning_start(void) {
    ESP_LOGI(TAG, "Starting BLE Provisioning server");
    esp_nimble_hci_and_controller_init();
    nimble_port_init();
    ble_svc_gap_device_name_set("EAGLE-SETUP");
    ble_svc_gap_init();
    ble_svc_gatt_init();
    ble_gatts_count_cfg(gatt_svr_svcs);
    ble_gatts_add_svcs(gatt_svr_svcs);
    ble_hs_cfg.sync_cb = ble_app_on_sync;
    nimble_port_freertos_init(host_task);
}
