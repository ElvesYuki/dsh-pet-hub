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

## USB 换钥匙

USB `BindingStatus` 的 capability bit 4 表示已绑定设备支持换钥匙。每条报文以 LF 结束，请求 ID 是 8 个小写十六进制字符。

```text
BINDKEY 1 <id> BEGIN
@BINDKEY 1 <id> challenge <boot_u64_decimal> <reference_u32_decimal> <nonce_hex>
BINDKEY 1 <id> COMMIT <canonical_base64>
@BINDKEY 1 <id> <committed|denied|busy|expired|storage_fault>
```

nonce 是 32 字节，十六进制小写。COMMIT 解码为 197 字节，顺序为引用号 `u32le`、新 SEC1 公钥 65 字节、原密钥签名 64 字节、新密钥签名 64 字节。签名为 ECDSA P-256 SHA-256 的 P1363 `r || s`。两份签名的原文依次拼接域字符串 `BINDKEY/old/v1` 或 `BINDKEY/new/v1`、旧绑定的 device／controller／binding 16 字节标识、epoch 与 boot `u64le`、引用号 `u32le`、32 字节 nonce 及新公钥。域字符串无 NUL。challenge 10 秒内有效，消费后不能重放，已有 USB Fence 或拔线也会清理 challenge。

固件核对双签名后撤销旧运行期 LAN 控制，再把公钥和递增后的 epoch 提交为原 NVS 绑定记录。Hub 保留两个本地索引，完整 Fence 验证后确认新索引。旧 epoch 的 LAN pin 随绑定失效。换钥匙保留固定地址与发现指令的原语义。[Spec／Diff 与现场入口](../../context/plans/device-key-rotation.md)

## USB 开通局域网发现

固定地址 ARM 使用上述原契约。发现候选通过同一已绑定 USB 在 ARM 后单独开通。命令以 LF 结束，`id` 为 8 个小写十六进制字符。

```text
VPCNET1 DISCOVERY <id> ENABLE <64 lowercase hex SHA-256 of SEC1 device public key>
VPCNET1 DISCOVERY <id> DISABLE
@VP8_VPCNET1 DISCOVERY id=<id> status=<enabled|disabled|unavailable|storage_failed|invalid|busy>
```

Hub 先持久保存 ARM 回送的设备公钥，再发送 ENABLE。设备确认当前绑定和原设备签名公钥，持久写入 65 字节记录。记录由 1 字节版本、32 字节绑定范围摘要、32 字节设备公钥摘要组成。Host 只在匹配 `enabled` 后落盘确认。只有已确认、仍匹配绑定和预选 USB 身份的私有 pin 可在 Host 重启后自动启动发现。原公钥不接受广播或网络替换。请求超时后保留准备记录，重新挂载时通过同一可信 USB 补做。板端 DISABLE 清除授权并读回，Hub 随后撤下确认标记。ARM 和 DISARM 仍只改变运行期选择。

发现公告使用 `_dsh-pet-hub._tcp.local.`、DNS-SD 地址及端口和唯一 TXT `version=1`。圆屏接受当前 Wi-Fi 接口内的 RFC 1918 IPv4，有效地址及端口去重。一轮最多八个候选，PTR 查询使用 1.2 秒 SDK 超时，TCP 建连最多 4 秒，VPL1 握手沿用原期限。尝试候选间隔 200 ms，无候选或用尽后按 3–30 秒退避。通过 VPL1 后清除未尝试的地址。重连候选在同一绑定和链路内允许对最后一次实际认证的端点重拨一次，失败后按原规则重新查找。该地址只存在运行内存，连接仍需完整 VPL1 认证。`0.1.42` 固件每次断线后重新查找。组播受阻时可以用 USB 读状态，必要时恢复固定地址 ARM。[Spec／Diff 与回退](../../context/plans/device-lan-discovery.md)

`0.1.44` 增加缺失 IPv4 时的 DNS-SD 地址补查。只有通过接口、TTL、TXT 及 SRV 端口筛选的记录可以查询其 SRV 主机名。每轮最多两次 A 补查，单次 SDK 超时 600 ms，回复继续核对原主机名、当前接口和同链路 IPv4。路由失效或绑定变化时丢弃结果。`DIAGNOSTICS` 的查询和完成计数仍按 PTR 查询轮次统计。局域网公告与 VPL1 字节保持原契约。

重连诊断候选在实体 USB 提供只读 `VPCNET1 DIAGNOSTICS <id>`，ID 为八位小写十六进制。回复使用同一 ID 和独立版本字段。

```text
@VP8_VPCNET1 DIAGNOSTICS id=<id> version=1 queries=<n> completed=<n> errors=<n> hits=<n> dials=<n> cached=<n> tcp=<n> authenticated=<n>
```

计数为本次启动的无符号 32 位十进制值，仅统计发现模式。`queries` 和 `completed` 分别为开始和结束的查询，`errors` 为查询错误，`hits` 为筛选后含候选的查询。`dials` 为发起拨号，`cached` 为其中使用已认证端点的重拨，`tcp` 为 TCP 建连成功，`authenticated` 为 VPL1 握手完成。计数由当前任务独立采样，不作为连接或身份的证明。

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
