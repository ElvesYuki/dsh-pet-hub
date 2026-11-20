# 设备协议

本目录记录 Hub 与圆屏固件的共用线协议。每个消息的协议版本位于文档定义的载荷或固定帧头。

| 职责 | 协议与向量 |
| --- | --- |
| 状态载荷 | [设备状态](device-status.md) · [共享向量](../vectors/device-status.json) |
| USB 和 TCP 主动上报 | [状态订阅](status-subscription.md) · [共享向量](../vectors/device-status-push.json) |
| 设备认证 TCP | [TCP 会话](tcp-session.md) · [握手向量](../vectors/device-tcp.json) |
| 动作与实际出屏回执 | [播放控制](playback-control.md) |
| USB 登记 | [设备登记](device-enrollment.md) |
| Wi-Fi、校时和天气 | [桌面网络配置](desktop-network.md) |
| 维护 | [固件更新](firmware-update.md) · [早期素材更新](media-update.md) |

设备包与协议版本分别管理。现有帧魔数、版本位和签名上下文按当前格式使用。新二进制协议在固定帧头定义独立版本字段，按文档核对支持范围后再解析消息正文。跨版本更改须更新两端编解码和测试向量。
