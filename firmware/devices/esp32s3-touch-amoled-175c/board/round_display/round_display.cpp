#if ROUND_TOUCH_RAW_OBSERVATION
#include "touch_raw_sdk.h"
#endif
#include "round_display.h"
#include "driver/i2c_master.h"
#include "driver/spi_master.h"
#include "esp_check.h"
#include "esp_lcd_co5300.h"
#include "esp_lcd_panel_ops.h"
#include "esp_lcd_touch_cst9217.h"
#include "esp_lvgl_port.h"
#include "panel_init.inc"
#include "round_touch.h"
#if ROUND_TOUCH_EVENT_READY
#include "touch_event_sdk.h"
#endif
#include "pmu_probe.h"
#if ROUND_DISPLAY_OBSERVATION
#include "display_observation_sdk.h"
#include "round_display_observation.h"
#endif
// GPIO source and pending device checks: ../../pinout.md. No PMU writes.
static const char *TAG = "round_175c";
static i2c_master_bus_handle_t bus = nullptr;
static esp_lcd_panel_io_handle_t panel_io = nullptr;
static esp_lcd_touch_handle_t touch = nullptr;
esp_err_t round_display_backlight(bool enabled) {
  return round_display_brightness(enabled ? round_display_normal_brightness : 0);
}
esp_err_t round_display_brightness(uint8_t level) {
  return panel_io ? esp_lcd_panel_io_tx_param(panel_io, 0x02005100, &level, 1)
                  : ESP_ERR_INVALID_STATE;
}
esp_err_t round_display_init(lv_display_t **out) {
  return round_display_init_on_core(out, -1);
}
static esp_err_t init_panel(esp_lcd_panel_handle_t &panel) {
  i2c_master_bus_config_t bc{};
  bc.i2c_port = I2C_NUM_0;
  bc.sda_io_num = GPIO_NUM_15;
  bc.scl_io_num = GPIO_NUM_14;
  bc.clk_source = I2C_CLK_SRC_DEFAULT;
  bc.glitch_ignore_cnt = 7;
  bc.flags.enable_internal_pullup = true;
  ESP_RETURN_ON_ERROR(i2c_new_master_bus(&bc, &bus), TAG, "I2C init");
  ESP_RETURN_ON_ERROR(round_175c_probe_pmu(bus, bc.sda_io_num, bc.scl_io_num),
                      TAG, "PMU identity verification failed");
  spi_bus_config_t sc{};
  sc.sclk_io_num = 38;
  sc.data0_io_num = 4;
  sc.data1_io_num = 5;
  sc.data2_io_num = 6;
  sc.data3_io_num = 7;
  sc.max_transfer_sz = 466 * 20 * 2;
  ESP_RETURN_ON_ERROR(spi_bus_initialize(SPI2_HOST, &sc, SPI_DMA_CH_AUTO), TAG,
                      "QSPI bus");
  esp_lcd_panel_io_spi_config_t ic{};
  ic.cs_gpio_num = GPIO_NUM_12;
  ic.dc_gpio_num = GPIO_NUM_NC;
  ic.lcd_cmd_bits = 32;
  ic.lcd_param_bits = 8;
  ic.flags.quad_mode = true;
  ic.pclk_hz = 40 * 1000 * 1000;
  ic.trans_queue_depth = 4;
  ESP_RETURN_ON_ERROR(esp_lcd_new_panel_io_spi(SPI2_HOST, &ic, &panel_io), TAG,
                      "QSPI IO");
  co5300_vendor_config_t vc{};
  vc.init_cmds = lcd_init_cmds;
  vc.init_cmds_size = sizeof(lcd_init_cmds) / sizeof(lcd_init_cmds[0]);
  vc.flags.use_qspi_interface = 1;
  esp_lcd_panel_dev_config_t pc{};
  pc.reset_gpio_num = GPIO_NUM_1;
  pc.rgb_ele_order = LCD_RGB_ELEMENT_ORDER_RGB;
  pc.bits_per_pixel = 16;
  pc.vendor_config = &vc;
  ESP_RETURN_ON_ERROR(esp_lcd_new_panel_co5300(panel_io, &pc, &panel), TAG,
                      "CO5300");
  ESP_RETURN_ON_ERROR(esp_lcd_panel_reset(panel), TAG, "panel reset");
  ESP_RETURN_ON_ERROR(esp_lcd_panel_init(panel), TAG, "panel init");
  ESP_RETURN_ON_ERROR(esp_lcd_panel_set_gap(panel, 6, 0), TAG, "panel gap");
  ESP_RETURN_ON_ERROR(round_display_backlight(false), TAG, "brightness off");
  ESP_RETURN_ON_ERROR(esp_lcd_panel_disp_on_off(panel, true), TAG, "panel on");
  return ESP_OK;
}
#if ROUND_DISPLAY_PROBE
esp_err_t round_display_probe_init(esp_lcd_panel_io_handle_t *io, esp_lcd_panel_handle_t *panel) {
  if (!io || !panel) return ESP_ERR_INVALID_ARG;
  *io = nullptr;
  *panel = nullptr;
  const auto result = init_panel(*panel);
  if (result == ESP_OK) *io = panel_io;
  return result;
}
#endif
esp_err_t round_display_init_on_core(lv_display_t **out, int core) {
  ESP_RETURN_ON_FALSE(out, ESP_ERR_INVALID_ARG, TAG, "null display");
  ESP_RETURN_ON_FALSE(core >= -1 && core < portNUM_PROCESSORS,
                      ESP_ERR_INVALID_ARG, TAG, "invalid LVGL task core");
  *out = nullptr;
  esp_lcd_panel_handle_t panel = nullptr;
  ESP_RETURN_ON_ERROR(init_panel(panel), TAG, "panel init");
  lvgl_port_cfg_t lc = ESP_LVGL_PORT_INIT_CONFIG();
  lc.task_affinity = core;
  ESP_RETURN_ON_ERROR(lvgl_port_init(&lc), TAG, "LVGL init");
  lvgl_port_display_cfg_t dc{};
  dc.io_handle = panel_io;
  dc.panel_handle = panel;
  dc.buffer_size = 466 * 20;
  dc.double_buffer = true;
  dc.hres = 466;
  dc.vres = 466;
  dc.color_format = LV_COLOR_FORMAT_RGB565;
  dc.flags.buff_dma = true;
  dc.flags.swap_bytes = true;
#if ROUND_DISPLAY_OBSERVATION
  ESP_RETURN_ON_ERROR(round_observation_bind(panel_io, panel), TAG, "observation bind");
#endif
  *out = lvgl_port_add_disp(&dc);
  ESP_RETURN_ON_FALSE(*out, ESP_ERR_NO_MEM, TAG, "LVGL display");
  if (!lvgl_port_lock(1000))
    return ESP_ERR_TIMEOUT;
#if ROUND_DISPLAY_OBSERVATION
  const auto observation = round_observation_attach(*out);
  if (observation != ESP_OK) {
    lvgl_port_unlock();
    ESP_RETURN_ON_ERROR(observation, TAG, "observation events");
  }
#endif
  // CO5300 requires even starts and odd ends, including centered 240px image.
  lv_display_add_event_cb(
      *out,
      [](lv_event_t *e) {
        auto a = static_cast<lv_area_t *>(lv_event_get_param(e));
        a->x1 &= ~1;
        a->y1 &= ~1;
        a->x2 |= 1;
        a->y2 |= 1;
      },
      LV_EVENT_INVALIDATE_AREA, nullptr);
  lvgl_port_unlock();
  return ESP_OK;
}
esp_err_t round_touch_init() {
  ESP_RETURN_ON_FALSE(bus, ESP_ERR_INVALID_STATE, TAG, "I2C not ready");
  esp_lcd_panel_io_i2c_config_t io{};
  io.dev_addr = ESP_LCD_TOUCH_IO_I2C_CST9217_ADDRESS;
  io.control_phase_bytes = 1;
  io.lcd_cmd_bits = 8;
  io.flags.disable_control_phase = true;
  io.scl_speed_hz = 400000;
  esp_lcd_panel_io_handle_t th = nullptr;
  ESP_RETURN_ON_ERROR(esp_lcd_new_panel_io_i2c(bus, &io, &th), TAG, "touch IO");
  esp_lcd_touch_config_t tc{};
  tc.x_max = 466;
  tc.y_max = 466;
  tc.rst_gpio_num = GPIO_NUM_2;
  tc.int_gpio_num = GPIO_NUM_11;
  tc.flags.mirror_x = true;
  tc.flags.mirror_y = true;
#if ROUND_TOUCH_RAW_OBSERVATION
  const auto result=esp_lcd_touch_new_i2c_cst9217(th,&tc,&touch);
  if(result==ESP_OK)round_touch_raw_bind(th,touch);
#if ROUND_TOUCH_EVENT_READY
  if(result==ESP_OK)return round_touch_event_bind(touch);
#endif
  return result;
#else
  return esp_lcd_touch_new_i2c_cst9217(th, &tc, &touch);
#endif
}
#if ROUND_TOUCH_EVENT_READY
RoundTouch round_touch_event_sample(esp_err_t &error) {
  RoundTouch r{}; r.valid = false;
  error = touch ? esp_lcd_touch_read_data(touch) : ESP_ERR_INVALID_STATE;
  unsigned stage = 1;
  esp_lcd_touch_point_data_t point{};
  uint8_t count = 0;
  if (error == ESP_OK) {
    stage = 2; error = esp_lcd_touch_get_data(touch, &point, &count, 1);
  }
  round_observation::touch(error == ESP_OK, count > 0, error, error ? stage : 0);
  if (error == ESP_OK) { r.valid = true; r.pressed = count > 0; r.x = point.x; r.y = point.y; }
  return r;
}
#endif
RoundTouch round_touch_read() {
#if ROUND_TOUCH_EVENT_READY
  return round_touch_event_read();
#else
  RoundTouch r{};
  r.valid = false;
  esp_err_t read_error = ESP_ERR_INVALID_STATE;
  if (!touch || (read_error = esp_lcd_touch_read_data(touch)) != ESP_OK) {
#if ROUND_DISPLAY_OBSERVATION
    round_observation::touch(false, false, read_error, 1);
#endif
    return r;
  }
  esp_lcd_touch_point_data_t point{};
  uint8_t count = 0;
  const auto get_error = esp_lcd_touch_get_data(touch, &point, &count, 1);
  if (get_error != ESP_OK) {
#if ROUND_DISPLAY_OBSERVATION
    round_observation::touch(false, false, get_error, 2);
#endif
    return r;
  }
  r.pressed = count > 0;
  r.x = point.x;
  r.y = point.y;
  r.valid = true;
#if ROUND_DISPLAY_OBSERVATION
  round_observation::touch(true, r.pressed, ESP_OK, 0);
#endif
  return r;
#endif
}
void round_touch_probe() {
  ESP_LOGI(TAG, "CST9217 uses shared I2C; direction pending device validation");
}
void round_imu_probe() { ESP_LOGW(TAG, "IMU not enabled in this profile"); }
