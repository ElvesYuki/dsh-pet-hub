#pragma once
#include "driver/gpio.h"
#include "driver/i2c_master.h"

// Startup only, before touch attaches to this bus. Pins are the actual bus pins
// from pinout.md; only their post-error input levels are sampled.
esp_err_t round_175c_probe_pmu(i2c_master_bus_handle_t bus,
                             gpio_num_t sda, gpio_num_t scl);
