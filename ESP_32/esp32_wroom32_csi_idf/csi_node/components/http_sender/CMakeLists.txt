
idf_component_register(
    SRCS "http_sender.c"
    INCLUDE_DIRS "include"
    REQUIRES esp_http_client csi_manager
)
