# 1.75C-EN OTA 与 VP8 候选维护接口

`0.1.32` 候选起，版本、槽位、忙碌和重启前选槽查询迁至 [USB Status v2](device-status.md#usb-串口)。下文中 `STATUS2` 和 `BATTERY1` 适用于较早镜像。OTA、素材和重启命令沿用原格式。

独立 `VP8_OTA` 构建。设备侧只有 USB 命令接收器。收到显式请求后，主动访问同网段 HTTP 端点。串口为 ASCII 命令加 LF，回执以 `@VP8_OTA ` 开头。一次最多一个维护任务。此接口供隔离宿主联调，现有 Hub 插件的 `STATUS1`／`UPDATE1` 仍对应旧单槽测试版。

```text
STATUS2
OTA2 <ipv4> <port> <bytes> <sha256-hex> <ssid-hex> <password-hex-or-dash>
MEDIA2 <ipv4> <port> <role> <action> <asset-version> <frames> <bytes> <sha256-hex> <ssid-hex> <password-hex-or-dash>
PLAY2 <role> <action>
WAVE
CANCEL2
REBOOT2
```

- `OTA2` 请求 `GET /firmware.bin`，两个 2 MiB 槽位交替。收到 `SELECTED` 表示已通过签名和目标项目校验，并设置下一次启动槽。通过 `REBOOT2` 或人工复位开始首启验证。启动后以 `CONFIRMED` 和 `STATUS2` 的版本及槽位核对结果。候选仅信任正在运行的初装签名镜像所携带的发布公钥。
- `STATUS2` 返回 `STATUS busy=<0|1> selected=<0|1> slot=<ota_0|ota_1> version=<version>`。槽位为当前运行槽，启动目标由设备计算。`selected=1` 表示下一启动槽已选定并等待重启。该查询只报告服务忙碌状态和应用信息。
- `BATTERY1` 在显式电池查询候选中返回 AXP2101 只读快照。消息和状态独立于 `STATUS2`。[USB 电池查询](../../reports/2026-11-18-vp8-desktop-battery.md)
- `WAVE` 触发当前固件预热的缓存动作 4，播完回到待机 0。桌面 Hub 的显式挥手测试模式先用 `STATUS2` 识别当前固件与可用状态，再由独占串口发送一次。板端无带请求 ID 的回执。历史 `0.1.4` 通过同一 USB 会话内 `@VP8_DAILY REQUEST source=usb`、`@VP8_FIRST 4-400`、动作 4 EOF 与 241 帧统计、`@VP8_FIRST 0-400` 确认一次手动播放和返回。缺少完整回执时结果保持未知。[近期 TCP 首帧验收](../../reports/2026-11-20-vp8-dsh-task-motion-live.md)
- `MEDIA2` 请求 `GET /asset.ivf`，接受 400×400 VP8 profile 1／IVF、24 fps 源速率、2–1450 帧，单内容对象上限 520,192 B。校验该身份后从 Flash 读回核对，再提交目录。返回 `MEDIA_SAVED` 或 `MEDIA_EXISTING`。同一角色与动作仅接受更高素材版本或全身份一致的重试。
- HTTP 需返回 200 和唯一、精确的 `Content-Length`。拒绝分块、非 identity 的内容编码和跨网段端点。Wi‑Fi 凭证仅在本次 USB 维护任务使用。
- `CANCEL2` 在写入切换状态前生效。若固件升级回执丢失，使用 `STATUS2` 查看实际版本和是否已选中下一槽。素材任务只有收到 `MEDIA_SAVED` 或 `MEDIA_EXISTING` 才显示已保存。素材回执丢失时结果为未知，可由用户用同一身份再发起一次，设备会查验已存对象。若已选中下一槽，后续维护请求需等重启完成。

首次迁移由独立受控 USB 窗口处理。证据和首刷备份步骤见候选报告。

独立 `VP8_BOOT_PAIRING` 构建的首绑扩展见[VP8 BOOT 持久回执](device-enrollment.md)。当前驻留 `0.1.4` 未启用此扩展。
