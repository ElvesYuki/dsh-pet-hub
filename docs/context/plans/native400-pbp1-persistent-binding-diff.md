# 1.75C 持久绑定管理端 Diff

2026-11-13。管理端宿主切片接有界串口、显式首绑与续接、PTY 和既有 ARM 的回归。PMA1 sender 按现有 SHA-256 固定作实板对照。[线上帧评审](../../protocol/native400-pbp1-persistent-wire-review.md)

PTY 已复现设备旧草案在发送 6 后收到迟到 8 应答的情形。类型 129 无请求来源，无法证明该帧属于 6。两端当前源码采用 `132` 专用于 8，正文为原 84 B 状态加尾部 4 B 小端 reference 回显，能力位 1（掩码 `0x0002`）显式宣告。原向量保留，另补拆分向量。未宣告位 1 的候选可对拍已绑定续接，首绑入口在发 8 前关闭。

管理端复用独占串口、有界 framing 和旧 RAM 租用发布接口。6 的 Bound 只允许进入认证。首绑仅在相关 132 后轮询，任何结果未知都退出并交由显式只读核对或续接。9 成功回执须匹配本轮 transcript、PSK、proposal 和 fingerprint。迟到的旧 131 可跳过直至原事务截止，不续期。设备回执校验与实际 USB 关闭完成后才发布租用，取消或关闭失败都不发布。旧 ARM 调用保留单次提交和现有未知结果语义。此切片签名器和绑定意图由宿主注入，无 Keychain、索引自动写入、自动启用、真实设备或生产配置接线。回退停用新入口，旧临时入口及 PMA1 sender 继续按原范围使用。

| 范围 | 现状 | 后续切片和验收 |
| --- | --- | --- |
| `packages/core/native400-pbp1-wire.mjs` | 默认旧临时类型，显式模式接收类型 6–9／129–132 | 196 B 上限不变。已补拆分和旧草案公开向量，下一步对拍带拆分的设备候选产物。 |
| `packages/runtime/native400-pbp1-serial.mjs` 和 `native/native400-pbp1-tty.c` | 复用独占串口、有界接收、实际 I/O 退出 | PTY 验证旧 129 歧义、按类型和引用匹配、旧 131 丢弃、拆包及关闭。 |
| `packages/runtime/native400-pbp1-binding.mjs` 与 `native400-usb-pairing.mjs` | 显式持久流程复用原 RAM 租用发布 | PTY 验证作用域与 HMAC、关闭后发布和撤销。现有 PMA1 sender 取得同形状租用。重启时的持久索引与 Keychain 后续验证。 |
| runtime 绑定索引及 macOS 辅助进程 | 已有单实例和 CAS；无 PBP1 持久 key backend | 先用临时索引和模拟 signer 验证两边提交顺序、掉电、坏档、密钥缺失及解绑。签名辅助进程再单独验证签名身份、Keychain 锁定、升级访问、非导出接口和日志边界。 |
| 服务／共享 UI | 当前仅显式临时 CLI | 未来用既有 IPC 加配对、恢复状态和解绑入口。UI 只能操作有权限的单实例。验证 DSH 与独立应用共存时只签一次、只持一个 USB 租用，禁用后等待实际退出。 |
| 固件与真机 | 临时 PBP1 继续用于动作 1 对照 | 需要共同冻结 wire 与状态、核对 NVS、RAM、栈和播放停顿，独立实板确认冷启动、USB／网络断开、Flash 回退和丢钥匙恢复。 |

公开向量先覆盖首绑与续接签名、PSK 摘要、ACTIVE HMAC。反例包含旧 boot、换挑战、换元组、错 PSK、跨域签名及不合法的 `r/s`。状态机反例留在实现切片，包含消费后重放、并发第二 owner、断电提交未知、旧 I/O 未退出及旧回执。现有 PMA1 媒体 TCP、Wi-Fi RAM 引导、USB ARM、生产 listener 及设备状态不在此切片变更范围内。[Spec](native400-pbp1-persistent-binding-spec.md)
