#pragma once
#include "esp_err.h"
struct RoundTouch { bool pressed=false; int x=0; int y=0; bool valid=true; };
esp_err_t round_touch_init();
void round_touch_probe();
RoundTouch round_touch_read();
// Read-only board IMU identity probe on the already initialized shared I2C bus.
void round_imu_probe();
