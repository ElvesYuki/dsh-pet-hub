#include "round_motion.h"
#include "driver/i2c_master.h"

namespace {
// QMI8658C Rev A, tables 7–8 and 21–24; Waveshare selects SA0 low.
constexpr uint8_t who = 0x00, ctrl1 = 0x02, ctrl7 = 0x08, status0 = 0x2e, ax_l = 0x35;
constexpr int timeout_ms = 3;
i2c_master_dev_handle_t motion{};
bool configured{};

bool read(uint8_t reg, uint8_t *bytes, size_t size) {
  return i2c_master_transmit_receive(motion, &reg, 1, bytes, size, timeout_ms) == ESP_OK;
}

bool write(const uint8_t *bytes, size_t size) {
  return i2c_master_transmit(motion, bytes, size, timeout_ms) == ESP_OK;
}

bool enable(uint8_t mask) {
  const uint8_t bytes[]{ctrl7, mask};
  return write(bytes, sizeof(bytes));
}

bool configure() {
  if (!motion) {
    i2c_master_bus_handle_t bus{};
    if (i2c_master_get_bus_handle(I2C_NUM_0, &bus) != ESP_OK) return false;
    i2c_device_config_t config{};
    config.dev_addr_length = I2C_ADDR_BIT_LEN_7;
    config.device_address = 0x6b;
    config.scl_speed_hz = 400000;
    if (i2c_master_bus_add_device(bus, &config, &motion) != ESP_OK) return false;
  }
  uint8_t id{};
  if (!read(who, &id, 1) || id != 0x05 || !enable(0)) return false;
  const uint8_t serial[]{ctrl1, 0x40}; // Auto-increment, little endian.
  const uint8_t rates[]{uint8_t(ctrl1 + 1), 0x16, 0x46}; // ±4 g, ±256 dps, 112.1 Hz 6-DoF.
  return write(serial, sizeof(serial)) && write(rates, sizeof(rates));
}

int32_t scaled(const uint8_t *axis, int32_t divisor) {
  const auto raw = uint32_t(axis[0]) | uint32_t(axis[1]) << 8;
  const int32_t value = raw < 0x8000 ? int32_t(raw) : int32_t(raw) - 65536;
  return value * 1000 / divisor;
}
}

bool round_motion_start() {
  if (!configured) configured = configure();
  return configured && enable(0x03);
}

std::optional<RoundMotion> round_motion_read() {
  uint8_t ready{}, bytes[12];
  if (!configured || !read(status0, &ready, 1) || (ready & 3) != 3 ||
      !read(ax_l, bytes, sizeof(bytes))) return {};
  RoundMotion result{};
  for (unsigned axis = 0; axis < 3; ++axis) {
    result.acceleration_mg[axis] = scaled(bytes + axis * 2, 8192);
    result.rotation_mdps[axis] = scaled(bytes + 6 + axis * 2, 128);
  }
  return result;
}

bool round_motion_stop() {
  if (!configured || enable(0)) return true;
  return enable(0);
}
