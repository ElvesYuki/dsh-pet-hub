# VP8 Status v2 管理端离线候选

2026-11-19。固件与 Hub 使用同一公共状态字节。保留 [Status v1 回环证据](2026-11-19-vp8-vpl1-hub.md) 和独立回退包。离线候选通过后，按用户授权换装日常 DSH 的 Hub。

[Spec](../context/plans/vp8-status-v2-hub-spec.md) · [Diff](../context/plans/vp8-status-v2-hub-diff.md)

## 接入范围

- 公共解码包含版本、当前槽、维护中、选槽待重启，以及可选电池、触摸和 IMU。USB 使用单条 STATUS3 并校验当前随机 ID 和规范 Base64。设置页按同一状态显示维护标志，缺省读数独立显示。
- VPL1 候选优先协商能力 0x02 和 Status 2。认证层核对当前会话、计数和 Ping 序号后调用公共解码器。3 秒共用 Ping、6 秒回退、9 秒关闭及 15 秒固件控制租约沿用。复用已登记的 USB 和 Keychain，再用同一 USB Fence 核对后获得的设备公钥验证身份。能力不匹配时协商仅控制。v1 专项可显式选 1。
- rc.5 隔离候选通过 `vp8StatusV2` 启用 USB v2。该标记默认关闭。USB 回退、手动查询、Wi-Fi／天气版本回查、挥手前置检查、素材维护和 OTA 复核共享解码器。现有配网、天气、绑定、维护命令与事务确认继续沿用。
- 桌面 CLI 保留旧入口并提供 `start-v2`、`start-wave-v2`。媒体与 OTA 的私有配置可分别指定 `statusV2` 和 `afterUpgradeStatusV2`。重启后优先按预设目标协议复核，确认是同一 USB 设备、目标版本、已切换槽且无维护或待重启标志，才确认成功并更新运行期状态查询模式。结果未知时按原门禁拒绝盲目重复升级。
- TCP listener 归隔离调用者所有，接现有 connectTelemetry。状态标记只选择协议。日常入口默认无设备 TCP listener。

## 验证与回退

- `npm run check`、`npm run build` 和 rc.5 单包构建通过。全量 2119 项通过，标准沙箱仅跳过真实文件 Keychain 一项，单独用临时 Keychain 执行已通过。离线包位于 `.cache/vp8-vpl1-status-v2-candidate/dsh-pet-hub-0.0.8-status-v2-candidate.tgz`。

- 直接读取固件共享向量 `docs/protocol/vectors/round-pet-vp8-status-v2.json`，SHA-256 `da0572f461d0e2101fb6f26334ee905ddcb5041e4bada0ec281057b5cfad4834`。Node 解码与 C++ 的公共载荷、USB 规范文本、TCP 明文、带 MAC 的外层记录、确认和密钥向量一致。验证非法维护位、截断、旧请求 ID 和非规范 Base64。C++ 对端在临时环境中的编译包含固件 `vp8_status.cpp`。
- 实际 Node/C++ TCP 以可控单调时钟验证同一连接共享 Ping 与 Play，状态层暂停交付期间仍接收 Pong，6 秒切 USB，9 秒断线，重连的首条 Status 取消在途 USB。设备公钥核对与真实临时 macOS Keychain 签名分别对拍。USB 实体连线未参与。
- PTY／串口夹具验证设置回查、先读维护状态再挥手、素材保存回执，以及 OTA 后旧版、同槽、换设备均不能完成，只有目标版本和新槽通过复核。
- 关闭隔离 listener 和适配器并撤销进程内 pin。若将来已在现场 ARM，用物理 USB DISARM。原旧板恢复使用默认 USB 路径，v1 离线包另存。同一真实板的 USB 拔插、AP 断网、DMA 首帧和 ESP 资源仍待隔离验收。

## 日常桌面换包

2026-11-19 获用户授权。先保留日常 profile 的私有快照，在临时 profile 用 DSH rc.5 自带 CLI 离线替换并确认原 Cordis patch 字节一致。随后用同一 CLI 替换日常 profile 的同名 Hub，包版本继续为 0.0.8。核对活动 profile 的 tarball 引用和安装文件与候选一致。预演与现场锁文件的相对路径随 profile 位置变化，候选完整性值一致。原登记配置、其他插件的依赖声明和清单保持一致。

未重启 DSH。在原窗口打开设置和「桌面宠物设备」，看到新版的「USB 状态」和本地已保存绑定。首次查看时页面报告 USB 忙，实体读回与拔插仍待专门验收。当前设备留驻 0.1.30，保持 USB 兼容模式，日常 profile 未配置 Status v2 开关，设备 TCP listener 保持默认关闭。

逐字节核对现场 203 个候选文件及私有快照的 196 个原包文件。安装后 `npm run check`、`npm test` 和 `git diff --check` 通过，2119 项通过，临时 Keychain 专项沿用先前独立通过记录。

回退使用换包前私有快照或原本地 tarball，由同一 CLI 重新安装后核对原设置入口。私有快照保留在本机 Git 忽略目录，原绑定和 Keychain 无需重建。[换包方案](../context/plans/vp8-status-v2-desktop-deploy.md)
