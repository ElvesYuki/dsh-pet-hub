# VP8 LAN 控制与状态线协议 VPL1

下文的状态 v1 对应 `0.1.31` 历史候选。`0.1.32` 起按 [Status v2](device-status.md) 协商和封装状态，VPL1 握手算法、认证封包和 VPC1 控制沿用本页。本文的状态位和类型 18 长度以新版协议为准。

2026-11-19 · 固件离线候选。已有 VP8 管理端状态 owner 的 schema 1 是投影模型。局域网接线需受信的 VPL1 适配器。设备主动向现有 STA 同网段 IPv4 目标发起一条 TCP。消息有认证和完整性保护，局域网报文内容公开。

## 封包

所有整数为小端，公钥为 65 B SEC1 非压缩 P-256 点，P-256 签名为 64 B 的 P1363 `r || s`。8 B 头依次为 ASCII `VPL1`、封包版本 `1`（u8）、类型（u8）、紧随数据长度（u16）。解析器先验证类型和长度，再等待完整数据。最大完整帧 202 B，允许拆包和粘包。类型／版本／长度错误、半帧 EOF、MAC 错误、计数重复或跳变关闭 socket，清除旧状态及未呈现控制票据。

| 类型 | 方向 | 数据长度 | 数据 |
| --- | --- | --- | --- |
| 1 DeviceHello | D → H | 194 | 绑定范围 88 B，非零 boot u64，nonce 32 B，设备临时 ECDH 公钥 65 B，版本能力位图 u8 |
| 2 HubAuth | H → D | 162 | nonce 32 B，Hub 临时 ECDH 公钥 65 B，选择的状态版本 u8，控制者签名 64 B |
| 3 DeviceFinish | D → H | 100 | 非零 session u32，设备签名 64 B，设备密钥确认 32 B |
| 4 HubFinish | H → D | 32 | Hub 密钥确认 |
| 16 Ready | D → H | 40 | 认证封包，明文为 session u32 |
| 17 Control | 双向 | 60 | 认证封包，明文为原 VPC1 v1 的 24 B 帧 |
| 18 Status | D → H | 49–111 | 认证封包，明文为下表 13–75 B 的状态回执 |

绑定范围按顺序拼接 USB 首绑的 `device/controller/binding` 各 16 B、epoch u64、`SHA256(controller SEC1)` 32 B。Hub 从当前可信 USB 登记／Keychain 验证该范围，再取对此范围固定的板端签名公钥。设备校验签名使用已有持久绑定里的控制者 P-256 公钥。只有明确核验当前设备、绑定、已固定设备公钥、启动和握手后的适配器可以调用 `telemetry.attach`。同一设备的已认证新 boot 建立新的 session/显示序号范围。已认证旧 boot、旧绑定、非当前 socket 的回执不能接管。会话号由设备在同一 boot 内严格递增，允许因为认证未完成而跳号。耗尽时禁止回绕。

DeviceHello 的 bit 0 表示支持状态版本 1，其余位保留。Hub 选择 1 或 0。0 只启用认证后的控制，保留 USB 状态来源，不挂状态 owner。需要其他状态版本时通过后续协议扩展能力位。普通 VPC1 夹具仍可直接使用原 24 B 帧。

## 认证字节

标签为表中的 ASCII，省略 NUL。所有拼接为按列顺序的原始字节。每次连接重建随机数和临时 ECDH；无会话恢复。握手 9 秒无效关闭。两端核对 ECDH 输入点和 P-256 签名。

- `T = SHA256(DeviceHello 数据 || HubAuth 前 98 B)`。
- Hub 用 Keychain `signTranscript` 签名原文 `ASCII("VPL1/hub-auth") || T`，由 Keychain 使用 ECDSA SHA256 进行一次签名散列，输入 45 B。其产生的 P1363 签名对应同一 SHA256 摘要，设备用 PSA verify-hash 核验。
- `Kdh = HKDF-SHA256(ECDH 输出 32 B, salt=T, info="VPL1/device-to-hub", len=32)`。Hub 到设备的 `Khd` 使用 info `VPL1/hub-to-device`。
- DeviceFinish 的设备签名对应 `SHA256(ASCII("VPL1/device-auth") || T || session u32)`。设备确认 = `HMAC-SHA256(Kdh, ASCII("VPL1/device-finish") || T || session u32)`。Hub 验证公钥签名和确认后返回 `HMAC-SHA256(Khd, ASCII("VPL1/hub-finish") || T || session u32)`。
- 认证封包的数据是 `计数 u32 || 明文 || tag[32]`，tag = `HMAC-SHA256(方向密钥, ASCII("VPL1/record") || 8 B 原始头 || 计数 u32 || 明文)`。每个方向的首个计数为 1，仅接受下一计数。Ready 使用设备出站计数 1。Hub 收到并验证匹配的 Ready 后才可发控制或替换旧会话。计数与 VPC1 请求序号独立，达到上限关闭。
- 绑定核对和 pin 通过已有受控 USB 配对 proof/Fence 与同一个物理连接。将来正式配发所需的持久端点、设备密钥加密或硬件保护及 pin 更新仍需双方确认。当前候选用 `VPCNET1 ARM <IPv4> <port>` 走直连 USB，按当前绑定生成或读取设备签名身份，公钥在 `@VP8_VPCNET1 ARMED key=<130 小写十六进制>` 返回。USB 先返回 QUEUED，失败回 KEY_UNAVAILABLE。设备用独立 NVS `vp8_vpl1/identity_v1` 存储 scope 摘要和 32 B 私钥。端点只保存在 RAM，掉电后重启需重新 ARM。DISARM 清除 RAM 端点和控制会话，保留绑定及设备签名身份，USB 返 DISARMED。设备在发布路由时发现绑定范围变化即关闭并撤销当前 ARM，随后显式 ARM 新绑定会换签名身份；Hub 本地撤销立即停止旧适配器并注销 pin。USB 拔线不撤销。阶段内一律禁止从 TCP 配网或启用候选。

## 状态回执 v1

| 偏移 | 字段 | 约束 |
| --- | --- | --- |
| 0 | 状态版本 u8 | 1 |
| 1 | 启动槽 u8 | 0 为 ota_0，1 为 ota_1 |
| 2 | 存在位 u8 | bit 0 电池，bit 1 触摸，bit 2 IMU，其余 0 |
| 3 | 固件版本长度 u8 | 1–31 |
| 4 | session u32 | 当前认证会话 |
| 8 | ping sequence u32 | 当前探针对应原 VPC1 Ping 序号 |
| 12 | 固件版本字符串 | ASCII，首字符为字母或数字，其余字母数字或 `._+-`，无 NUL |
| 随后 | 电池 8 B，可选 | present u8、USB 供电 u8（均 0/1）、percent u8（0–100，255 缺失）、flow u8（0 standby、1 charging、2 discharging、3 unknown）、phase u8（0 trickle、1 precharge、2 cc、3 cv、4 full、5 idle、6 unknown）、保留 u8 为 0、mV u16（1–8191，0 缺失）。present 为 0 时 percent/flow/phase 为 255，mV 为 0。 |
| 随后 | 触摸 6 B，可选 | state u8（0 unknown、1 up、2 down）、保留 u8 为 0、x/y u16（0–465），未知坐标两个均为 65535。触摸状态超过 250 ms 读数为 unknown，最近有效触点仍可返回。 |
| 随后 | IMU 18 B，可选 | ax/ay/az i16，±4000 mg；gx/gy/gz i32，±256000 mdps。超过 160 ms 无现成样本则省略。 |

Hub 投影将版本和槽转为 `{schema:1,version,slot,battery,sensors}`。电池缺失时为 null，标量缺省映射为 null。“无电池”时仅供电和是否存在可用。触摸和 IMU 同时缺失时 sensors 为 null。仅 IMU 存在时 touch 为 `{state:"unknown",last:null}`。坐标固定一对，缺省映射为 null。电池采样超过 2 秒时不输出旧值。无固件起始时间或墙钟依赖。

## 一条心跳与失联

- 协商 v1 后使用管理端现有 telemetry owner 作为唯一的 3 秒调度器，attach 后立即探测。关闭以前控制夹具的 5 秒定时器。每个内部 probe 映射到严格递增的 VPC1 请求序号，与 Play 共用分配器。新 Ping 同时替换先前未决状态探针。校验当前 socket、boot、session、计数及 VPC1 Ping 序号，再把内部 probe ID 和数据交给 owner。重复、旧连接和晚来的状态不刷新状态。在独立测试里，owner 的真实 `receive` 验证该行为。
- 设备收到新有效 Ping，按顺序发原 Pong 和独立 Status。Play 仍走原控制状态机。匹配的普通 Pong 只确认控制探测。Pong、Duplicate、Accepted 和 Presented 都不刷新页面状态。设备控制租约为 15 秒，新解析通过的 Ping 或 Play 延期，最近请求的完全相同重发只回 Duplicate，不发状态，也不延期。
- 首条有效 Status 前可使用 USB。主机在连续满 6 秒无有效 Status 或 socket 断开时立即清除网络首选，仍在线的已登记 USB 可自动刷新。到 9 秒关闭这个 TCP 状态会话，也失去控制。来自旧连接的 close 回调只可停止旧实例。重新认证后的首条新状态使 USB 自动轮询和在途自动请求停止。USB 显式维护命令走既有入口。
- 板端路由更新、重配、维护、撤销、socket 错误、3 秒写阻塞或 8 条待发控制队列满时关闭，不阻止离线播放。失败后在有效路由上约 3 秒重拨。Hub 保留仍有效的目标截止，重新请求通过新票据。时间／天气由设备自取，TCP 写入需要后续能力、授权、配置修订及持久回执。

[向量](../vectors/device-tcp.json) · [原 VPC1](playback-control.md)
