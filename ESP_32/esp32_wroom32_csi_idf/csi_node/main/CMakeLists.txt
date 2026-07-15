idf_component_register(SRCS "main.c"
                    INCLUDE_DIRS "."
                    REQUIRES wifi_manager csi_manager udp_sender http_sender nvs_flash)
