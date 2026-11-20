#include "round_battery.h"
#include <algorithm>
#include "driver/i2c_master.h"

#include <cassert>
#include <cstdio>
#include <deque>
#include <vector>

namespace {
struct Transfer {
  uint8_t reg;
  std::vector<uint8_t> response;
  esp_err_t result = ESP_OK;
};
std::deque<Transfer> expected;
Bus bus;
Device device;
esp_err_t bus_result = ESP_OK, add_result = ESP_OK;
unsigned attachments;

void expect(std::initializer_list<Transfer> transactions) {
  assert(expected.empty());
  expected = transactions;
}

void verify_reads() {
  assert(!round_battery_read());
  bus_result = ESP_ERR_INVALID_STATE;
  assert(round_battery_init() == ESP_ERR_INVALID_STATE);
  bus_result = ESP_OK;
  add_result = ESP_ERR_NO_MEM;
  assert(round_battery_init() == ESP_ERR_NO_MEM && !round_battery_read());
  add_result = ESP_OK;
  assert(round_battery_init() == ESP_OK && round_battery_init() == ESP_OK && attachments == 2);

  expect({{0x00, {0x28}}, {0x00, {0x08}}, {0x00, {0x20}}, {0x00, {0}, ESP_ERR_TIMEOUT}});
  assert(round_battery_usb_power() == true);
  assert(round_battery_usb_power() == false);
  assert(!round_battery_usb_power());
  assert(!round_battery_usb_power());

  expect({{0x00, {0x20, 0x26}}});
  const auto absent = round_battery_read();
  assert(absent && !absent->present && absent->usb_power && !absent->percent && !absent->millivolts);

  expect({{0x00, {0x28, 0x23}}, {0xa4, {0}}, {0x30, {1}}, {0x34, {0xce, 0xd8}}});
  const auto charging = round_battery_read();
  assert(charging && charging->present && charging->usb_power && charging->percent == 0 &&
         charging->millivolts == 3800 && charging->flow == RoundBatteryFlow::charging &&
         charging->phase == RoundChargePhase::cv);

  expect({{0x00, {0x08, 0x45}}, {0xa4, {255}}, {0x30, {0xfe}}});
  const auto no_adc = round_battery_read();
  assert(no_adc && !no_adc->usb_power && !no_adc->percent && !no_adc->millivolts &&
         no_adc->flow == RoundBatteryFlow::discharging && no_adc->phase == RoundChargePhase::idle);

  expect({{0x00, {0x28, 0x04}}, {0xa4, {100}}, {0x30, {1}}, {0x34, {0x20, 0}}});
  const auto full = round_battery_read();
  assert(full && full->percent == 100 && !full->millivolts && full->phase == RoundChargePhase::full);

  expect({{0x00, {0x08, 0x67}}, {0xa4, {0}, ESP_ERR_TIMEOUT}, {0x30, {1}},
          {0x34, {0, 0}, ESP_ERR_TIMEOUT}});
  const auto partial = round_battery_read();
  assert(partial && !partial->percent && !partial->millivolts &&
         partial->flow == RoundBatteryFlow::unknown && partial->phase == RoundChargePhase::unknown);

  expect({{0x00, {0x28, 0x20}}, {0xa4, {9}}, {0x30, {1}, ESP_ERR_INVALID_RESPONSE}});
  const auto no_enable = round_battery_read();
  assert(no_enable && no_enable->percent == 9 && !no_enable->millivolts);

  expect({{0x00, {0, 0}, ESP_ERR_TIMEOUT}});
  assert(!round_battery_read());
  assert(expected.empty());
}

} // namespace

esp_err_t i2c_master_get_bus_handle(int port, i2c_master_bus_handle_t *handle) {
  assert(port == I2C_NUM_0);
  if (bus_result == ESP_OK) *handle = &bus;
  return bus_result;
}

esp_err_t i2c_master_bus_add_device(i2c_master_bus_handle_t handle, const i2c_device_config_t *config,
                                    i2c_master_dev_handle_t *result) {
  assert(handle == &bus && config->device_address == 0x34 && config->scl_speed_hz == 400000 &&
         config->dev_addr_length == I2C_ADDR_BIT_LEN_7);
  ++attachments;
  if (add_result == ESP_OK) *result = &device;
  return add_result;
}

esp_err_t i2c_master_transmit_receive(i2c_master_dev_handle_t handle, const uint8_t *reg, size_t write_size,
                                      uint8_t *data, size_t read_size, int timeout_ms) {
  assert(handle == &device && write_size == 1 && timeout_ms == 8 && !expected.empty());
  const auto &call = expected.front();
  assert(*reg == call.reg && read_size == call.response.size());
  const auto result = call.result;
  if (result == ESP_OK) std::copy(call.response.begin(), call.response.end(), data);
  expected.pop_front();
  return result;
}

int main() {
  verify_reads();
  std::puts("battery register access passed");
}
