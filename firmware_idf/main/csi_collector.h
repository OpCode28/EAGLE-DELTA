#pragma once
#include <stdbool.h>

void csi_collector_init(void);
bool csi_collector_get_batch(float matrix[20][64]);
