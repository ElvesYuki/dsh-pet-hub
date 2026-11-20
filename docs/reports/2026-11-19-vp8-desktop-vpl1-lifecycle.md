# DSH TCP 与 USB 主动状态候选

2026-11-19。Hub 已构建与圆屏 `0.1.33` 配套的 rc.5 单包。日常 DSH 已换装独立验收的设置页布局，板上继续留驻 `0.1.32`，日常状态继续通过既有 USB STATUS3 获取。主动状态候选与固件候选均未部署。[Spec 与 Diff](../context/plans/vp8-desktop-vpl1-lifecycle.md) · [日常布局换装](2026-11-19-vp8-desktop-device-layout.md)

## 入口和行为

- 通过 rc.5 宿主已有登记 owner 和托管免码 query 装配。打开主动状态要同时具备 `vp8StatusV2` 和 `vp8StatusPush`。TCP 另需显式 `vp8Lan.enabled`，以及指向本机私有 IPv4 的 `vp8Lan.address` 和十进制字符串 `vp8Lan.port`。主动状态模式和监听默认关闭。
- 候选等已登记 USB 目标可用，再绑定显式私有 IPv4。监听就绪后用同一 USB 完成 Fence／ARM，沿用 Keychain 和设备公钥核对。端口冲突、地址或目标不匹配、信任不可读时回 USB。
- TCP 使用 DeviceHello `0x04` 和 HubAuth mode 3。设备首报后每 3 秒主动发送 Status v2。首报立即 ACK，后续约每 9 秒确认最新序号。6 秒失去状态新鲜度即回 USB，9 秒关闭 TCP，设备 15 秒控制租约由新 ACK 或新 Play 续期。VPC1 Play 及 Accepted／Presented 回执共用连接并维持独立序号。
- USB 在插件运行期间自动监测已登记设备附着，无需打开设置页。新附着先收一条状态。TCP 新鲜时退订 USB 周期上报。TCP 失效时用同一 USB 的 `STATUS3_SUB` 获取状态，约每 9 秒以同一 ID 续订。查询、配网、天气、素材和 OTA 等显式操作优先使用串口，收尾后按需继续订阅。

## 隔离验证

`npm run check`、`npm test`、rc.5 单包构建和 `git diff --check` 通过。全量 2129 项，2128 通过，1 项独立 macOS Keychain 签名专项未运行。测试使用临时信任存储和测试签名器。隔离 rc.5 宿主验证默认关闭和无效端点回退。

TCP 使用实际本机 socket 和固件 C++ 对端，覆盖 mode 3 协商、旧 mode 2 拒绝、状态与 Play 同连接、认证及退出后释放。共用向量验证状态、ACK 与 USB 命令。可控时钟和合成串口分别核对 6／9 秒边界、USB 新附着、同 ID 续租、TCP 恢复后退订、foreground 实际释放串口句柄再交接。C++ Presented 证明宿主回执链，现有 `0.1.32` 的真机首帧另见原验证报告。[Status v2 证据](2026-11-19-vp8-status-v2-hub.md)

固件任务已有 C++ 可执行文件时，可在 Hub 仓库执行以下入口。变量分别指向固件只读仓库根和已构建的主动状态宿主对端。可选提供 `ROUND_PET_VPL1_V2_PEER_BIN` 复验拒绝旧 mode 2。

```sh
ROUND_PET_VPL1_PEER_ROOT="$firmware_repo" \
ROUND_PET_VPL1_PUSH_PEER_BIN="$firmware_push_peer" \
node --test tests/vp8-vpl1.test.mjs tests/vp8-usb-status-push.test.mjs
node scripts/build-dsh022.mjs --host-version 0.2.2-rc.5 --combined
```

候选留档于本机忽略的 `.cache/vp8-active-status-candidate/dsh-pet-hub-0.0.8-active-status-candidate.tgz`。SHA-256 为 `ae0ac96ff1e20acfa975c91c107266958f0f1b09e869d2df9923a5f6c72aab1b`。

## 真机入口与回退

- 配套候选先在隔离环境核对 USB 实体插拔、纯电池 TCP、AP 断开、重连恢复及关闭页面后的串口占用。分别记录 Hub 重启和固件重启，因为两端的运行期 ARM 或 pin 需重新建立。DSH 状态到 VPC1 动作映射仍待实现。
- 退出任一个 owner 都撤销本次认证、关闭监听与 socket，并等待在途签名、ARM 和串口关闭。ARM 结果未知时停在回退路径。必要时按固件方案用同一可信 USB 核对及 DISARM。候选关闭本身不发送 DISARM。
- 将联调 profile 的 `vp8Lan.enabled` 和 `vp8StatusPush` 关闭可回显式 USB STATUS3。需要恢复包时用之前的界面包，配套板上固件回退到已验收的 `0.1.32`。该板在 `ota_1` 另保留 `0.1.30` 的兼容 USB 回退。[界面包回退](2026-11-19-vp8-desktop-device-layout.md#日常换装)
