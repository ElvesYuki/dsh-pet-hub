#pragma once
#include "esp_err.h"

// Operates on the initialized board PMU, from the same worker as battery sampling.
esp_err_t round_power_key_init();
esp_err_t round_power_key_take_short_press(bool &pressed);
