# 日常 DSH 的 VPL1 生命周期候选 Spec 与 Diff

固件协作切片。沿用 0.1.32 已验证的 USB Fence／ARM 和 VPL1 认证，主动上报对齐 0.1.33 固件候选。插件接线默认关闭。本切片的证据来自隔离宿主、真实 loopback TCP 和合成串口。

| 范围 | 方案与验收 |
| --- | --- |
| 接入 | rc.5 管理端仅在既有免码查询 owner、Status v2 与登记 owner 都具备时装配。复用原 USB owner 和 Keychain。两处 USB 目标必须一致。无 USB 等待可用，在通过 Fence 的同一串口主动 ARM 一次。 |
| 监听 | 按配置绑定主机的指定私有 IPv4 与 TCP 端口，拒绝其他网段、目标不符及 pin 尚未就绪的连接。端口冲突保留原 USB 查询。 |
| 认证与状态 | 沿用绑定版本检查。仅接受设备主动上报模式，状态每 3 秒更新，首条立即确认，随后约每 9 秒确认最新状态。6 秒 USB 回退、9 秒关闭连接、板端 15 秒控制租约。正常重连沿用本次已核对的身份。 |
| USB 状态 | 插件生命周期内自动收取每次新附着的首条。TCP 新鲜时收完首条即退订，TCP 失效时恢复同一登记设备的订阅。现有显式查询及写入任务优先使用串口。 |
| 重启与撤销 | 进程退出、插件停用、查询 owner 或登记 owner 离开都撤销 pin 并释放连接及监听。Hub 重启需重新 USB Fence／ARM。固件重启后 ARM 端点会清空。候选不自动重复 ARM，需显式重装配并接 USB。无 USB 无 pin 则等待。USB 断开不撤销已有认证。 |
| 失败与回退 | 已写 ARM 但结果未知时关闭候选并等待现场 USB 核对／DISARM。端口、身份错配、撤销或连接失败均保留原设备设置和 USB 回退。日常配置待跨线程协调后另启用。 |
| 测试 | 既有 USB 约束、装配次序、缺 USB、错身份、端口冲突、ARM 失败、阶段退出、重复启动、USB 拔插与真实回环状态交接。测试使用独立合成 USB/Keychain。 |

## 主动状态与装配差异

日常 TCP 只允许 DeviceHello 0x04 及 HubAuth mode 3，设备首条立即上报，随后每 3 秒推送 Status v2。Hub 核对连续状态序号，共用已认证记录，首条立即 ACK 后每约 9 秒确认更新状态。禁用 TCP Ping/Pong。6 秒降级、9 秒关闭与 15 秒设备租约沿用。

USB Status v2 主动候选另用 `vp8StatusPush` 显式开关，与新版固件配对。`STATUS3_SUB` 每 9 秒按同一 ID 续订，接受严格递增且允许间隔的序号。串口释放前尽力发送匹配 ID 的 `STATUS3_UNSUB`。显式 STATUS3 仍供查询、绑定核对、配网、天气及维护使用。USB 与 TCP 主动模式默认关闭，日常部署沿用 0.1.32 配对。

| 模块 | Diff |
| --- | --- |
| rc.5 宿主与 query owner | 增加 `vp8Lan`、`vp8StatusPush` 入口。登记和查询 owner 共用监听装配，任一退出都取消并等待释放。页面查询读状态投影。 |
| `vp8-desktop-lan`、`vp8-vpl1-wire`、`vp8-vpl1-adapter` | 使用 Fence 取得身份和 ARM，核对绑定和 Keychain，封装 type 18 状态及 type 19 确认。type 17 继续承载 Play 与回执。 |
| `vp8-status-usb-push`、`vp8-desktop-usb`、`vp8-desktop-telemetry` | 增加隔离订阅、只读来源切换、foreground 优先和退出后实际关闭。保留旧 STATUS3 显式读取。 |
| 回环与宿主夹具 | 使用固件共享字节向量、原生 C++ 对端、Node TCP、合成 TTY 和 rc.5 隔离加载，分别核对字节、生命周期、时钟边界及默认关闭行为。 |
