# round-pet Status v2

本协议定义 USB 与 VPL1 共用的状态字节。整数使用小端，公共载荷长度为 6–68 B。与 USB 请求 ID、TCP 会话号、Ping 序号无关。

`0.1.33` 主动上报候选沿用本文的公共载荷和显式 STATUS3。周期 USB 更新和 TCP 封装见[主动状态协议](status-subscription.md)。

| 偏移 | 字段 | 约束 |
| --- | --- | --- |
| 0 | 状态版本 u8 | 2 |
| 1 | 当前启动槽 u8 | 0 对应 `ota_0`，1 对应 `ota_1` |
| 2 | 字段存在位 u8 | bit 0 电池、bit 1 触摸、bit 2 IMU，其他位为零 |
| 3 | 固件版本长度 u8 | 1–31 |
| 4 | 维护状态 u8 | bit 0 `busy`，有维护任务执行中。bit 1 `selected`，下次启动槽已选定，等待重启。其他位为零。 |
| 5 | 固件版本字符串 | ASCII `[0-9A-Za-z][0-9A-Za-z._+-]{0,30}`，无 NUL |
| 随后 | 电池 8 B，可选 | present、usbPower、percent、flow、phase、保留 0、mV u16。present 和 usbPower 为 0/1。percent 为 0–100，255 缺省。flow 为 0 standby、1 charging、2 discharging、3 unknown。phase 为 0 trickle、1 precharge、2 cc、3 cv、4 full、5 idle、6 unknown。mV 为 1–8191，0 缺省。present 为 0 时 percent/flow/phase 为 255，mV 为 0。 |
| 随后 | 触摸 6 B，可选 | state u8（0 unknown、1 up、2 down）、保留 u8 为 0、x/y u16（0–465，缺省为两个 65535）。超过 250 ms 的状态为 unknown，可继续报告最近触点。 |
| 随后 | IMU 18 B，可选 | x/y/z 加速度 i16，单位 mg，±4000。x/y/z 角速度 i32，单位 mdps，±256000。超过 160 ms 的采样省略。 |

电池采样超过 2 秒省略。维护期间也返回固件版本、当前启动槽和维护标志，可省略不可用的传感器数据。设备基于现有快照编码。查询不触发传感器采样或 Flash 读取。

## USB 串口

```text
STATUS3 <id>\n
@VP8_STATUS3 id=<id> data=<base64>\n
```

`id` 恰好为 8 个小写十六进制字符。Base64 使用标准字母表及规范 `=` 填充，无空格。解码后即为上表载荷，最大 Base64 长 92 字符。忽略畸形请求。Hub 匹配当前串口请求 ID，可接收 LF 和 CRLF，丢弃旧请求回包。设备页每轮只发一次查询。版本检查、配网设置会话、素材管理、挥手测试、升级及升级后版本／槽复核使用同一解码器。新固件迁出 `STATUS2`、`BATTERY1`、`SENSORS1` 三个状态查询。USB 绑定、配网、天气及维护命令沿用原格式。

## VPL1

DeviceHello 的能力字节置 bit 1（`0x02`），表示支持 Status v2。HubAuth 选择状态版本 `2`，或 `0` 表示仅控制。现有 `VPC1 Play` 和 24 B `Ping/Pong` 沿用原字节。

外层类型 18 的认证明文为 `session u32 || ping sequence u32 || Status v2`，长度 14–76 B。加 VPL1 计数和 MAC 后，VPL1 头部声明数据长度 50–112 B，8 B 头另计。外层先认证并校验当前会话、Ping 及消息计数，再解码共用载荷。3／6／9 秒状态规则、15 秒控制租约和 `Play → Accepted → Presented` 保持原义。

[共享测试向量](../vectors/device-status.json) · [VPL1 认证](tcp-session.md)
