# 设备代码命名整理评审

2026-11-20。业务代码按职责命名，协议代号、版本区别和对应关系集中在协议文档。整理前 `apps`、`packages`、`scripts`、`tests` 共发现 90 个文件名含 `vp8`，其中 `packages` 有 46 个。`VP8` 横跨 USB 协议、TCP 会话、UI、DSH 入口及测试，`rc3`、`rc5` 同时出现在宿主源码和打包逻辑。下文记录改名前后的职责映射。

## 建议名称

| 当前文件 | 建议名称 | 职责 |
| --- | --- | --- |
| `packages/runtime/vp8-desktop-status.mjs` | `device-status-sources.mjs` | 选择 TCP 或 USB 状态 |
| `packages/runtime/vp8-status-usb-push.mjs` | `usb-status-subscription.mjs` | USB 状态订阅、续订、退订 |
| `packages/runtime/vp8-vpl1-adapter.mjs` | `device-tcp-session.mjs` | 认证、连接生命周期、状态和操作分派 |
| `packages/runtime/vp8-desktop-network.mjs` | `usb-wifi-settings.mjs` | 通过 USB 读写 Wi-Fi 设置 |
| `packages/runtime/vp8-codex-hook-source.mjs` | `codex-hook-source.mjs` | 读取 Codex App 的本机任务状态 |
| `packages/core/vp8-task-motion.mjs` | `task-motion.mjs` | 将任务状态转换成播放意图 |
| `packages/ui/vp8-desktop-device-page.mjs` | `device-settings-page.mjs` | 共享设备设置页 |
| `apps/dsh-plugin/host-desktop-combined-rc5.mjs` | `desktop-host.mjs` | 当前 DSH 桌面宿主装配 |

目录沿用 core、runtime、UI 和宿主的职责边界。共享工具也使用职责名称。显示尺寸或协议代号只用于明确依赖它的编解码、素材格式、测试向量和历史记录。用户界面使用设备状态、Wi-Fi、动画联动等名称，真实固件版本和插件版本在详情中按需显示。

## 协议名称索引

| 业务职责 | 当前需要识别的名称 |
| --- | --- |
| USB 获取状态 | `STATUS3`、`STATUS3_SUB`、`STATUS3_UNSUB`，公共载荷为 Status v2 |
| TCP 设备会话 | `VPL1 mode 3`，携带主动状态与播放帧 |
| 动画播放 | `VPC1 Play`、`Accepted`、`Presented` |
| Wi-Fi 设置 | `DESKNET2` 为日常 Hub 现用命令；`DESKNET3` 为设备端的多 Wi-Fi 命令 |
| 登记与 TCP 授权 | `VP8PAIR1` 承载 PBP1，`VPCNET1 ARM` 授权连接 |
| 天气与维护 | `DESKWEATHER1`、`MEDIA2`、`OTA2` |

线协议字面量、数值枚举和编解码版本集中在传输边界。依赖、兼容和打包版本继续以 `package.json`、构建选项等可执行配置为准。文档解释它们的对应关系。[主动状态](../../reports/2026-11-19-vp8-desktop-vpl1-lifecycle.md) · [播放回执](../../protocol/vp8-vpc1-hub.md) · [配对协议](../../protocol/vp8-boot-usb-proposal.md)

## 实施顺序与兼容边界

1. 先选状态读取到设备设置页的一条链路，整理文件、内部函数和样式命名。同一次变更更新显式打包清单、import、测试引用和相关文档。线协议共享向量仍按原内容对拍。
2. 再整理宿主入口和打包脚本。当前 DSH 宿主的选择归入构建配置和最终包的依赖声明。产物入口必须同步核对 `main`、`exports`、构建目录引用和实际宿主加载。已发布包、回退包和历史构建记录保留原名。
3. 已部署的配置键、HTTP 路由和持久文件单独处理。例如 `vp8TaskMotion`、`/api/pet-hub-vp8-motion/` 和 `vp8-boot.json` 现有消费者及数据归属不同。需要改名时先验证旧 profile、已登记设备、冲突处理和回退，再确定兼容迁移。已绑定设备应能继续使用原登记和凭据。

每片用宿主测试、共享字节向量和打包加载核对。功能齐备后安排统一真机验收。

## 管理端实施 Spec 与 Diff

本次按用户决定直接切换管理端名称，源码、构建入口、配套测试及新增产物路径使用职责名称。范围是当前圆屏设备管理链路及同组 DSH 桌面宿主。独立的原生素材实验和历史协议继续按各自目录组织。过往报告和已发布包保留归档名称。

| 层 | Diff | 验收 |
| --- | --- | --- |
| 核心与运行层 | 播放、状态、登记、USB、Wi-Fi、维护和本机任务来源改为职责命名。同步内部导入、符号和宿主调用。 | 设备状态、任务来源、收据、关闭及并发的既有测试通过。 |
| 界面与宿主 | 清理文件、组件、类名、设置项及管理端路由。前端请求与后端路由同时切换，只提供一套名称。 | 宿主构建及隔离加载通过，设置页能用新入口。 |
| 包和存储 | 构建脚本、入口、产物目录及随包助手按职责命名。Hub 本地登记索引改用语义文件名。发布前可离线备份并组织原数据；本轮保持当前日常 profile 和旧包。 | 新产物路径、`main`、`exports` 和实际模块解析一致。隔离存储的 CAS、恢复、凭据核对和退出通过。 |
| 设备边界 | 原命令字面量、状态版本、帧类型、共享向量、动作编号、认证用途字符串和 Keychain 身份继续使用现有值。固件侧只交付命名建议及不变量。 | 字节对拍、离线候选和交接文档齐备。 |

源文件和本地调用只保留新名字，旧配置与旧路由不设双入口。日常部署留在后续统一验收，回退仍可使用当前包和独立备份。真机接入、烧录、改固件和主动调整 DSH 不在本轮实施。

## 新入口与日常部署边界

运行 `npm run build` 后可用 `node scripts/build-desktop-plugin.mjs` 构建 `dist-desktop/`。包入口为 `apps/dsh-plugin/desktop-host.mjs`，实际 DSH 依赖版本写在包清单里。`--target connection`、`legacy-connection`、`legacy-desktop` 用于现有独立的打包和宿主验证。原连接包的准入快照与历史哈希保留；新名字构建的连接包用新清单逐文件校验，原核心字节哈希继续核对。[连接包摘要](../../protocol/vectors/desktop-connection-artifacts.json)

| 旧配置键 | 新配置键 |
| --- | --- |
| `vp8StatusV2`／`vp8StatusPush` | `unifiedDeviceStatus`／`deviceStatusPush` |
| `vp8Lan`／`vp8TaskMotion`／`vp8Enrollment` | `deviceLan`／`taskMotion`／`deviceEnrollment` |
| `vp8DesktopQuery`／`vp8DesktopManaged`／`vp8DesktopNoCode` | `desktopDeviceQuery`／`managedDesktopDevice`／`desktopDeviceNoCode` |
| `vp8UpdateOrigin` | `deviceUpdateOrigin` |

应用内路径分别为 `/api/pet-hub-device/`、`/api/pet-hub-enrollment/`、`/api/pet-hub-task-source/` 和 `/api/pet-hub-update/`，本地 IPC 用 `/v1/device-update/`。设置客户端随包一起更新。新登记目录使用 `device-enrollment-<scope>`，索引是 `device-binding.json`，Keychain 账号和已绑定身份的 scope 保持原值。

未来切换日常包时，先保留原包和原 profile，离线复制登记资料到语义命名的新目录，原 scope 后缀必须完全相同。新目录使用配套新 Keychain 助手，先验证能读回原索引和原密钥并通过一次新鲜绑定核对，再启用。旧包继续读取旧路径作回退。本轮未做实体登记和在用 Keychain 的迁移。[固件交接](../../protocol/device-naming-firmware-handoff.md)

## 本轮验证

已核对 95 个文件的新旧路径、客户端和后端接口、正式桌面候选入口以及新连接候选摘要。真实 DSH 随包 Electron 运行隔离宿主夹具，Node 与固件 C++ 通过实际 loopback 核对播放命令和回执。Objective-C 助手语法检查通过。`npm run check`、`npm test`、桌面候选构建及 `git diff --check` 通过。2130 项通过、0 项失败，9 项需要独立 Keychain 或外置向量及 VPL1 对端的测试跳过。日常包来源保持原状态。

离线候选 `dsh-pet-hub-desktop-candidate.tgz` 的 SHA-256 为 `c1b03e1db709d4c0a6982832d2e41df30d98b010bd9284a0271c325ed4ee1a33`。
