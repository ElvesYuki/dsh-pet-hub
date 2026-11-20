# 1.75C 引脚与最小显示配置

更新：2026-10-29。状态：厂家源码交叉核验，自研显示／触摸及原生360已有真机记录；实物SKU已确认1.75C-EN，PCB批次待记录。本轮仅修正文档状态，无引脚／电气变更。此表只适用于1.75C，不适用于1.75-B或旧1.28板。

来源：

- [官方原理图](https://www.waveshare.net/w/upload/8/83/ESP32-S3-Touch-AMOLED-1.75C-schematic.pdf)，本地SHA256 `7bcc0a3a9dc02893741e1e555b203a17055b5cc9cce3b5c548e160e21683900d`。
- [厂家产品源码](https://github.com/waveshareteam/ESP32-S3-Touch-AMOLED-1.75C/tree/4bfdc80eedbf95031e384610796bed15e0240312)，`examples/arduino/libraries/board_config/pin_config.h`。
- [BSP 3.0.0精确源码](https://github.com/waveshareteam/Waveshare-ESP32-components/tree/010c5fb39ea7f0e996efd1f8e162cc70e569e57f/bsp/esp32_s3_touch_amoled_1_75c)，`include/bsp/esp32_s3_touch_amoled_1_75c.h`的GPIO宏及`.c`的`bsp_display_new`/`bsp_touch_new`/`lcd_init_cmds`。

| 信号 | GPIO/配置 | 来源与状态 |
|---|---|---|
| AMOLED QSPI CLK / CS | 38 / 12 | 上述两个厂家代码源一致；自研BSP显示真机通过 |
| QSPI D0 / D1 / D2 / D3 | 4 / 5 / 6 / 7 | 同上 |
| LCD RESET | 1，低有效 | BSP/产品宏；独立于触摸复位；既有显示／触摸启动已通过 |
| I²C SDA / SCL | 15 / 14，I2C0，400kHz | BSP/产品宏，PMU和触摸共用一个主机总线 |
| Touch RESET / INT | 2 / 11，低有效 | BSP/产品宏；不采纳BSP中“shared LCD reset”的矛盾注释 |
| 触摸地址 / 方向 | CST9217 0x5A；不交换XY，mirror X/Y=true | 锁定驱动头/BSP默认值，既有点击交互／方向已确认，非完整精度测试 |
| AMOLED格式 / gap | 466×466 RGB565，RGB，(6,0) | BSP；项目当前原生360画布居中 |
| QSPI频率 / TE | 40MHz；不使用TE同步 | CO5300驱动QSPI默认值，已有画面与有限窗口性能验证，非最终DMA时序验收 |
| 亮度 | 无背光GPIO；QSPI命令0x02005100，首版60% | BSP亮度函数；检查IO错误，不直接发普通8位0x51 |
| AXP2101 | I²C 0x34，0x03芯片ID期望0x4A | 官方PMU代码；项目仅只读ID，不写输出轨/充电寄存器 |
| USB / BOOT | 首版不在GPIO驱动中定义或改写 | 原生USB出厂备份可用；强制下载/恢复另待用户确认 |
| 音频 / IMU / RTC | 首版不初始化 | 出厂基础反馈不等于本项目固件支持 |

最小电源安全审查：官方HelloWorld与BSP显示入口没有PMU输出轨配置；不调用会关停多路LDO/DC的AXP电源示例，不改充电、电池、休眠或唤醒。若实机显示必须配置电源轨，停止并补充原理图与PMU依据。初始化序列采用上述精确BSP的表（包含600ms等待），保留来源与Apache-2.0许可。显示及触摸初始化失败明确报错，无猜测GPIO的回退路径。

实测来源：[原生360迁移](../../apps/round-pet/reports/2026-10-29-native360-device.md)、[切换优化及用户反馈](../../apps/round-pet/reports/2026-10-29-native360-local-switch.md)。精确应用版本见[当前矩阵](../../docs/context/current-status.md)。
