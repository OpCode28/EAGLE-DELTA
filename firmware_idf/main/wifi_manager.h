#pragma once
#include <stdbool.h>

void wifi_manager_init(void);
bool wifi_manager_has_credentials(void);
void wifi_manager_connect(void);
