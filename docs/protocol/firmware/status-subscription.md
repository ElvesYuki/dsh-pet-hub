# round-pet 主动状态协议

适用固件 `0.1.33-l-battery-usb-pair-test` 候选和配套 DSH Hub。两条链路都使用 [Status v2 公共载荷](device-status.md)。`STATUS3` 继续用于显式查询。绑定、配网、动作、素材下载及 OTA 保持原命令。

## TCP

VPL1 帧头、握手和认证使用[原算法](tcp-session.md#认证字节)。DeviceHello 最后一个字节为 `0x04`，HubAuth 的 byte 97 为 `0x03`。后者选择主动上报模式，内部状态版本仍为 2，旧 TCP 模式不协商。`Ready` 后设备立即发送首条状态，再每 3000 ms 发送最新快照；调度延迟时不补发。所有多字节整数为小端。

| 类型 | 方向 | 认证明文 | VPL1 头的长度字段 |
| --- | --- | --- | --- |
| 17 | 双向 | 24 字节 VPC1 Play 或其动作回执 | 60 |
| 18 | 设备 → Hub | `session u32 || status sequence u32 || Status v2` | 50–112 |
| 19 | Hub → 设备 | `session u32 || last status sequence u32` | 44 |

类型 18 的状态序号每会话从 1 递增，独立于 Play 序号和认证记录计数。Hub 核对认证、当前连接、会话及下一个预期状态序号后才更新新鲜度。Hub 在首条状态后立即确认，后续约每 9 秒确认最近收到的新状态。不发送 VPC1 Ping/Pong。设备收到新的有效 ACK 或新的有效 Play 时续期 15 秒控制租约。已确认序号的重复或迟到 ACK 不续租，错会话、零序号或尚未发送的序号关闭连接。重复认证记录计数仍按原协议拒绝。Hub 断线即清除 TCP 状态，连续 6 秒无有效状态时切到 USB，9 秒关闭会话。

## USB

```text
STATUS3_SUB 4a01c0de\n
@VP8_STATUS3_PUSH id=4a01c0de seq=1 data=<base64>\n
STATUS3_UNSUB 4a01c0de\n
```

已登记设备附着后，Hub 自动订阅读取首条。TCP 有效后暂停 USB 周期上报，TCP 失效且 USB 仍可用时重新订阅。订阅随插件生命周期维护，显示页面只读 Hub 的状态投影。显式串口事务可以临时暂停订阅，结束后按当前状态来源恢复。

ID 为 8 位小写十六进制。订阅首条尽快发送，再每 3000 ms 发送。USB 序号为十进制非零 u32，从 1 开始，允许因串口或维护错过消息。Hub 约每 9 秒续发同 ID 的 SUB，将租约延至设备收到命令后 15 秒，不重置序号和节拍。更换 ID 创建新订阅；UNSUB 只释放匹配 ID。USB Base64 使用公共载荷和原 STATUS3 编码。接受原串口的 LF 或 CRLF 行尾。

[Node／C++ 字节向量](../vectors/device-status-push.json) · [Hub 集成与回退](../../context/plans/vp8-0133-live-acceptance.md)
