# dsh-pet-hub

DeepSeek Harness Desktop `0.2.2-rc.3` 的「设置 → 桌面宠物设备」已实测持久绑定核对和免码查询。归属待核对时，查询结果独立显示。显式 `start-wave` 仍使用原授权码。[实装验收与回退](docs/reports/2026-11-17-vp8-desktop-device-page.md)

VP8 真板已通过 CLI 一键 USB 首绑和拔插复验。未登记设备从设置页发起首次绑定仍待真机验证。现场 Keychain 继续使用原私有作用域；保留同一签名助手的本机长期副本与原路径恢复已通过合成 Keychain 验证。[首绑证据](docs/reports/2026-11-17-vp8-usb-desktop-hotload.md) · [凭据恢复](docs/reports/2026-11-17-vp8-keychain-continuity.md)

主包 `0.0.4` 已在签名 DSH `0.2.2-rc.3` 实装验收。1.75C-EN 电池读数在设备主卡自动更新，离开再进入会重新采样，离开后现场检查确认串口已释放。主包 `0.0.2` 已备份供回退。[电池现场验收与回退](docs/reports/2026-11-18-vp8-desktop-battery.md)

1.75C-EN 在独立 DSH `0.2.2-rc.3` 设置页完成一次正常 OTA，重连读到原生 400 VP8 固件 `0.1.4`／`ota_0`。固件侧独立验证升级后 57 个对象、动作 67 离线播放与故障恢复。日常 Launcher 的 rc.1 一键入口已在临时 profile 验证，迁移与可信发布材料仍待就绪。插件入口默认关闭，旧 `56644ffd` 动作 1 入口保留。[OTA 真机报告](docs/reports/2026-11-16-vp8-ota14-dsh.md) · [日常部署](docs/reports/2026-11-16-vp8-ota-daily.md)

400×400 离线素材库共有 **96 段**，包括原有 78 段和新补录的 18 段 VP8。当前 1.75C-EN 板上有 **57 段**可直接播放，新收录片段已通过宿主逐帧验证，待真机安装验证。原 PET4 compact78 保留作为兼容回退。[素材复查与补录](docs/reports/2026-11-18-native400-upstream-action-review.md) · [当前 400 基线](docs/context/native400-baseline.md)

PTC1 播放控制继续走原 shared owner。TCP29 已在隔离宿主验证原创 HTTP 来源、权限 IPC、TCP 控制和退出。真实 pet 身份及自然状态变化仍待验。 [TCP29 报告](docs/reports/2026-11-06-tcp29.md)

并行动画制作入口：[挥手过渡优化](docs/reports/2026-10-30-character-wave-contour.md)、[四态预览](docs/reports/2026-10-30-character-states.md)、[制作指南](docs/art/character-production-guide.md)。挥手过渡已改为单轮廓形状插值＋轮廓内颜色过渡，替代两张手臂直接淡化；袖口/手掌双轮廓明显减少，细部自然度待确认。360大小/原点、原素材及挥手时序保持，14段4046次身体覆盖/安全区采样候选为0，该预览阶段217测试通过；无设备适配，音频仍延后真机。

分层角色包：[真实导出](docs/reports/2026-10-30-layered-character-export.md)、[使用合同](docs/protocol/layered-character-export.md)、[行为参数](docs/reports/2026-10-30-character-behavior-parameters.md)、[L1校验](docs/reports/2026-10-30-layered-character-package-l1.md)。L2真实纯数据包已导出并独立L1复验：21主层、33张去重PNG、37文件、390634B（约381KiB），素材原字节/有效绑定与v4一致，两次包摘要/回执一致。L2[独立加载/首帧切换](docs/reports/2026-10-30-layered-character-loader.md)已完成：HTML目录选择、完整校验、取消/旧结果保护、失败保留和Bitmap释放均验证；14段4046次扫描与v4一致，该加载切片全套328项通过（含当时其他并行切片）。[使用/API](docs/protocol/layered-character-loader.md)；[L3宿主验收](docs/reports/2026-10-30-layered-character-l3.md)已通过：4046帧RGBA/姿态/语义零差异，复制包重开idle重建、失败/取消保留及重复换包回收均验证，L3阶段全套354项通过。当前[高分屏预览](docs/reports/2026-10-30-character-hidpi.md)入口.cache/layered-character/hidpi-preview-v1/index.html：DPR显示缓冲、2倍平滑/像素检查已实现，360大小/位置/素材与规范4046帧保持，该高分屏切片全套375项通过；生产接入、跨浏览器/设备、音频及长期性能仍待实施/验证。

与现有 DSH pet 插件共存的实体宠物设备管理项目。pet继续捕捉DSH任务状态；hub负责实体设备、独立动作映射、角色素材与连接。目标是BLE优先配网、Wi-Fi传动画/状态、热点备用、同网发现后确认绑定；这些无线能力目前尚未实现。

主要上游参考：[PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)。公开HTTP与Cordis契约、插件双端入口和生命周期以该项目为参考；[接口差异与固定提交](docs/reports/2026-10-29-upstream-reference.md)单独记录。

## 运行方案与可选工具

管理端采用共享 React 界面、Node.js 单实例服务和独立设备核心。VP8 安装通过独占 USB 发命令，由设备从同网段临时 HTTP 下载。旧 PET4 保留明文二进制 TCP。pet 提供只读任务状态，宿主 HTTP 权限与服务内部 UDS IPC 继续保留。管理端无需 Python 或 pyserial。

固件仓库的Python USB临时配网工具仅供开发人员按独立方案人工使用；本仓库已有默认关闭的工具适配器保留兼容，纯Node启动入口不调用它，也不接收Wi-Fi密码。产品USB/BLE配网另设计Node/原生辅助方案，当前未实现。

## 本地验证

使用Node **24.14.1**、npm **11.11.0**（见.node-version/package-lock.json），零第三方依赖，不需要安装：

```sh
npm run check
npm test
npm run build
```

测试使用临时Unix socket、临时loopback模拟pet与独立子进程，不连接现有DSH或设备。npm test会先构建dist候选。界面静态预览：npm run preview（退出按Ctrl-C），仅动态loopback端口，不接后台服务。

## 结构

| 路径 | 职责与当前状态 |
| --- | --- |
| packages/core | 与DSH/DOM无关的设备播放确认模型 |
| packages/source-pet | 公开HTTP/页面来源、串行轮询与页面租约，过滤为语义/counter |
| packages/runtime | Unix socket单实例、IPC客户端、配置CAS；BLE未实现 |
| packages/ui | 共享展示模型及React管理组件工厂 |
| apps/dsh-plugin | 宿主白名单IPC代理、客户端设置槽、bundle候选 |
| apps/service | 显式启动本地共享服务的CLI |
| docs/context | 长期事实、待办、决策、协议与计划 |
| docs/reports | 接口核验与测试证据 |

从[上下文索引](docs/context/index.md)和[P0调查报告](docs/reports/2026-10-29-p0.md)继续。未来独立应用复用核心与界面，通过单一辅助服务避免抢端口与重复下发；当前已验证同目录服务单实例，设备端fencing仍未实现。

本轮不改动固件仓库、运行桥接或DSH配置，不自动安装/启用插件，不烧录、不提交推送。任何真实集成先准备方案和回退。新代码MIT；上游与动画许可见[第三方边界](THIRD_PARTY.md)。不要提交素材、凭证或本机配置。

P1入口：[Spec](docs/context/plans/p1-spec.md)、[Diff](docs/context/plans/p1-diff.md)、[隔离集成与回退](docs/context/plans/p1-integration.md)、[验证报告](docs/reports/2026-10-29-p1.md)。启动服务必须显式提供私有runtime目录和来源模式；插件不会自动启动它。

当前：[0.2.2隔离DSH动态验证](docs/reports/2026-11-06-tcp22.md)。Config/React/设置槽/Connection已实测，真实pet仅空闲只读与无设备意图通过；旧rc.3加载记录见[历史报告](docs/reports/2026-10-29-isolated-host.md)。

设备管理闭环的设计依据：[设备协议Spec](docs/context/plans/device-protocol-spec.md)、[迁移与回退](docs/context/plans/legacy-v4-migration.md)、[模拟验收清单](docs/context/plans/device-simulator-acceptance.md)。目前是设计草案，S1模拟器已完成模型层验证，真实设备通信未实现。

S1离线验证：`npm run test:sim`（不创建socket），30项SIM+4补充通过；[逐项结果与限制](docs/reports/2026-10-29-s1.md)。`npm test`当前全套数量以[最新系统摘要](docs/context/current-system.md)为准（含临时IPC、S2及素材变体回归）。认证fixture排除在插件候选包外；S2已接入显式simulation服务/IPC/UI，默认模式不接设备。

S2历史模拟管理：`npm run preview:simulation`及materials/streaming/warehouse/roles/frames预览脚本的种子提取器只核过DSH rc.3，当前安装rc.5会按版本门禁拒绝；已有固定本地种子可显式用于隔离验证，禁止强行复用提取位置或自动更新依赖。新版本另验，不影响check/test/build。也可显式用`node apps/service/main.mjs --runtime-dir <新私有目录> --device-mode simulation`只启动UDS模拟服务。两设备和来源均为合成数据，虚拟时间需手动推进；重启即重置。S2完成时为60测试，[S2报告](docs/reports/2026-10-29-s2.md)。

历史承载路径的[承载/认证评审](docs/reports/2026-10-29-transport-auth-review.md)已完成当时文档：当时首选单连接HTTPS/mTLS；现设备主线已改LAN明文TCP，旧结果仅供历史参考，当前TCP资源/恢复门槛仍待验证，不连接实物。预算算术可离线运行`node scripts/check-transport-budget.mjs`；输出NO_GO_UNTIL_MEASURED不代表真实测量。

历史175C/360目标切换：[Spec](docs/context/plans/native360-baseline-spec.md)、[Diff](docs/context/plans/native360-baseline-diff.md)。S1/S2的240合成fixture不代表实体适配；现有预算命令仍按旧360输入，`--legacy-128`为历史128，均不能据此放行新400。当前目标与下一实现见[400基线](docs/context/native400-baseline.md)/[400-01至04](docs/context/plans/native400-manager-alignment-spec.md)。

新增[多设备素材变体离线核心](docs/protocol/material-variants.md)：支持按屏幕/呈现/编码/容量推荐与每设备确认；新增10项测试，全套70项。当前仅core元数据与内存分配，尚未接IPC/UI、持久化或设备安装；既有S1/S2仍为240 fixture。

[每设备素材选择与持久保存](docs/reports/2026-10-29-material-ui-storage.md)已在simulation模式接入UI/IPC（全套79测试）。默认不接设备；无导入模式只存偏好，不安装素材。同一私有测试runtime目录重启恢复选择，preview临时目录退出即清理。

[离线素材目录导入与每设备播放装配](docs/protocol/material-import.md)已支持SIM2合成文件的长度/SHA256/头校验及已保存变体模拟首帧。`npm run preview:materials`生成临时合成目录，A/B可分别选择360/240；全套88测试通过。此为初期SIM2范围；当前PET4进展见下节，动画画布与Flash安装仍未接入。

[真实PET4离线验证](docs/reports/2026-10-29-pet4-offline.md)已完成：严格解析、LZ4/XOR/CRC及RGB565解码；240/360各46动作全帧审计通过，两段真实待机验证每设备虚拟播放时钟。全套93测试；未接设备/Flash/浏览器动画画布，素材非商用许可独立于代码MIT。

[流式仓库与后台校验](docs/protocol/material-store.md)已支持显式`--material-mode streaming`，主线程提供进度，工作线程校验/解码，完整真实360库46动作约215MiB导入及待机/工作验证通过；全套102测试。`npm run preview:streaming`为原创合成包UI预览。旧snapshot 32MiB限制保持，streaming不保留全库字节，不代表进程总RAM≤32MiB；仍不接实物。

[仓库版本、配额与安全清理](docs/protocol/store-lifecycle.md)已接入：默认1GiB逻辑配额、导入前预留、版本审阅/确认清理，已选/播放/待提交及校验中素材受保护。`npm run preview:warehouse`用原创临时样本演示，完整360回归与全套112测试通过；无自动删除或实物操作。

[完整角色包与原子激活](docs/protocol/role-package.md)已接入显式simulation/streaming：8语义映射、逐动作帧率/帧数及三种循环规则，每设备后台复验与首帧后原子切换确认指针，支持取消候选、手动全部动作/回自动和独立缓存恢复。`npm run preview:roles`演示两规格、两版本原创包；[完整360验证与限制](docs/reports/2026-10-29-role-package.md)记录46动作全包、浏览器和全套125测试。此为宿主离线激活，无设备安装、Flash事务或动画画布。

[离线帧预览与资源恢复](docs/protocol/frame-preview.md)已支持当前PET4像素画布、校验/RPC期限、显式重验恢复和资源状态；`npm run preview:frames`生成原创彩色PET4预览，虚拟时间手动推进。全套137测试、50次换包/500次读帧及真实360像素核对通过；[报告](docs/reports/2026-10-29-frame-preview.md)记录约345MiB采样RSS峰值，尚无硬RAM或多日耐久保证。

[PET4内存与核心回执回收](docs/protocol/resource-replay.md)已接入：复用解码/校验缓冲，命令/意图窗口、单acquire回执、保护当前owner的session回收及有序触摸高水位。全套149测试、SIM-01–30及三天虚拟核心探针通过；[同参数报告](docs/reports/2026-10-29-resource-replay.md)记录RSS样本约334→231MiB，仍非硬内存或多日墙钟保证。旧无seq触摸仍有安全容量上限。

协作入口：[开发规范](docs/rules/development.md)、[上下文维护](docs/rules/context-maintenance.md)。最新能力与未完成工作以[当前系统](docs/context/current-system.md)、[待办](docs/context/current-todos.md)为准；上文按阶段列出的测试数量与限制对应各自报告，演进记录见[历史](docs/context/history/system-evolution.md)。

[独立双时钟与断线收敛](docs/protocol/dual-clock.md)已完成离线core切片：相对租约观察、迟到/重排拒绝及新会话最新目标收敛，全套207测试和SIM30+4通过。真实承载、漂移硬预算与墙钟耐久仍待验；[报告与后续测量方案](docs/reports/2026-10-30-dual-clock.md)。

[30分钟墙钟测量](docs/reports/2026-10-30-wall-memory.md)已在独立临时环境完成：1801样本、1770帧核对、59次换包，RSS峰值约180.5MiB、末值154.7MiB，全部资源已收尾。固定原创小PET4/1Hz负载，非硬RAM或多日保证；测量阶段check/test结果见报告，最新全套数量见当前系统摘要。执行入口见[测量契约](docs/protocol/wall-memory.md)。

[可信租约预算](docs/protocol/lease-budget.md)已完成离线core验证：默认拒绝的回执关联、漂移/命令延迟余量、序列防重排及预算外拒绝。该阶段全套257测试、768组参数/2368次速率边界检查通过，详见[报告](docs/reports/2026-10-30-lease-budget.md)。样例参数未实测，原合成proof不等于TLS；后续离线认证与TTL转换见下项，生产承载仍待验。

[离线认证映射与v5候选期限](docs/protocol/offline-auth-v5.md)已验证真实证书/私钥/报文、逐消息绑定与撤销检查、严格4KiB剩余TTL编码及轮询/素材分段预算。该离线阶段check与全套270测试通过；[报告](docs/reports/2026-10-30-offline-auth-v5.md)区分现行v5 Bearer整文件路径与管理候选。该离线工具未执行TLS握手，后续loopback结果见下项；仍无设备接入，设计延迟/漂移参数未实测。

[独立loopback mTLS互操作](docs/protocol/loopback-mtls.md)已完成真实peer→绑定→Registry/租约guard、撤销及32KiB素材分段正反例。该阶段check和全套308项通过，含TLS专项22项；[报告](docs/reports/2026-10-30-loopback-mtls.md)记录正常/取消清理。只用临时私有CA和本机动态端口，正式服务仍deviceTransport=false；ESP资源/可信时间/持久凭据及现行v5迁移仍待验。

[绑定权威与会话一致性](docs/protocol/session-consistency.md)已在临时存储/虚拟时钟/真实loopback TLS实现：单一元数据/CAS、hub挑战与新session、统一撤销/断线/休眠失效、旧结果保护及进程崩溃切点恢复。该阶段check与全套348项通过，会话切片28项；[报告](docs/reports/2026-10-30-session-consistency.md)区分提交失败/不确定、历史观测与新会话actual。后续服务装配/OS观察源见下项，系统密钥与设备接入仍待验，现有配置未改。

[服务装配、电源源与容量评审](docs/protocol/service-power-capacity.md)已在独立临时环境完成：UDS赢家独占owner/观察源、macOS IOKit真实注册/退出、受控休眠失效与320次TLS重连回收。check和全套376项通过，本切片17项；[报告](docs/reports/2026-10-30-service-power-capacity.md)明确未触发真实电脑睡眠，物理电源时序/签名和设备准入保持待验，宿主负载见后项。默认不启用，无设备listener，外部配置未改。

[承载负载与延迟](docs/protocol/transport-load.md)已完成4档真实loopback TLS固定负载、逐块证书/同步元数据计量及离线控制FIFO/超预算冻结验证；check和全套385项通过，[报告](docs/reports/2026-10-30-transport-load.md)记录成本、条件最坏预算反例及正常/取消清理。该full参考阶段未优化，4KiB写块保持；当前scoped减量见后项。未装配生产队列，本机样本不作为ESP/网络/磁盘最坏上界。执行入口：node scripts/verify-transport-load.mjs --output .cache/transport-load/results.json。

[重复复验减量](docs/protocol/verification-reduction.md)已完成实例内有界静态证书批准缓存、逐次动态日期/撤销检查及单次同步revision视图；新请求/每4KiB块前仍完整读盘，不跨await或使用mtime缓存。同负载64条绑定档load328→100、warm静态验证108→0，动态检查数保持，坏档/撤销/时间负例拒绝。check和全套399项通过，[报告](docs/reports/2026-10-30-verification-reduction.md)记录14专项/正常取消清理及外部变更发现边界；物理准入和生产调度仍待验。执行：node scripts/verify-verification-reduction.mjs --output .cache/verification-reduction/results.json。

[round-pet单设备G0](docs/context/round-pet-hub-baseline-alignment.md)已完成管理端文档审查；[Spec/Diff](docs/context/plans/round-pet-single-device-spec.md)列出schema2 Flash执行、三摘要适配、实体回执/维护状态及真实pull调度切片，不把解析器或PC预览当闭环。联合定版仍需[固件确认C01–C12](docs/context/plans/round-pet-g0-handoff.md)，G0阶段无生产代码/通道变更；[报告](docs/reports/2026-10-30-round-pet-g0.md)记录该阶段399项回归和10项recipe数学核对。A1后续进展见下项。

[A1纯core资源模型](docs/protocol/round-pet-a1.md)已完成单RAM＋4活跃/1暂存Flash、保护0/4、read lease与root恢复；35专项和全套434项通过，[报告](docs/reports/2026-10-30-round-pet-a1.md)区分模型首帧/保存事实与实体回执。旧schema1行为保持；后续A6已接隔离模型执行，实体runtime/设备与联合G0/G1/G2仍待验。独立入口：node scripts/verify-native360-a1.mjs --output .cache/native360-a1/results.json。

[A2三摘要与严格导入](docs/protocol/round-pet-a2.md)已离线完成：F/M/P与固定namespace分离、独立来源/许可批准、241帧全CRC/index SHA、流式CAS及独立provenance/重开。35专项与全套469项通过，见[报告](docs/reports/2026-10-30-round-pet-a2.md)；仅原创测试包，真实46包/许可联合核定与设备仍待完成；后续A3–A5候选进展见下项。执行：node scripts/verify-round-pet-a2.mjs --output .cache/round-pet-a2/results.json。

[A3设备观察与只读界面候选](docs/protocol/round-pet-a3.md)已离线完成：requested/sent与设备回执分离、实际画面/维护、保存历史/当前库存、迟到/查询/根一致性；内部显式临时UDS→宿主GET→共享只读展示，默认不启用。46专项与全套515项通过，见[报告](docs/reports/2026-10-30-round-pet-a3.md)；真实wire/实体仍待接入；A4/A5已另接loopback认证和默认OFF装配。执行：node scripts/verify-round-pet-a3.mjs --output .cache/round-pet-a3/results.json。

[A4主动拉取/分段候选](docs/protocol/round-pet-a4.md)已在独立loopback mTLS完成：两个HTTP周期控制/回执、单在途/有界latest、6页目录/逐段许可/32KiB Range、相对时长与本地截止、实际I/O退出、A3认证观察映射。48专项/全套563项通过，见[报告](docs/reports/2026-10-30-round-pet-a4.md)；无生产listener，不代表ESP时延/资源准入；后续A5显式候选见下项。执行：node scripts/verify-round-pet-a4.mjs --output .cache/round-pet-a4/results.json。

[A5默认关闭装配/恢复候选](docs/protocol/round-pet-a5.md)已离线完成：仅内部显式UDS赢家整合A2磁盘CAS、A3只读投影和A4临时mTLS；初始库存/verified/save门禁、保护0/4与显式victim、休眠保持OFF、退出持pin和无源重开已验。41专项/全套604项通过，见[报告](docs/reports/2026-10-30-round-pet-a5.md)。不创建生产listener、无页面启用/控制写路由，deviceTransport=false。共同wire/真实包/G1G2及设备仍待验。执行：node scripts/verify-round-pet-a5.mjs --output .cache/round-pet-a5/results.json。

[A6执行模型端到端对照](docs/protocol/round-pet-a6.md)已离线完成：A1 actor驱动库存/验证/首帧/root提交与淘汰，经A2磁盘CAS/A4临时TLS/A5→A3/status；payload/header/marker故障、未知保存/丢回执、回滚拒绝及退出已验。30专项/全套634项通过，见[报告](docs/reports/2026-10-30-round-pet-a6.md)。仅模型首帧/内存Flash，无生产listener；hub重启而设备不停机的revision与低root回滚维护仍待共同契约。执行：node scripts/verify-round-pet-a6.mjs --output .cache/round-pet-a6/results.json。

[A7会话/根维护候选](docs/protocol/round-pet-a7.md)已离线完成：同actor/boot跨新hub owner，revision按新context重置；显式检查点保留floor/完整根/未查询提交对象，低root及同seq冲突拒绝。24专项/全套658项通过，见[报告](docs/reports/2026-10-30-round-pet-a7.md)。仅受信临时文件交接，无生产自动持久化/防回滚/降floor或rebind入口；下一评审权威存储/崩溃恢复及共同契约。执行：node scripts/verify-round-pet-a7.mjs --output .cache/round-pet-a7/results.json。

[A8根权威持久化候选](docs/protocol/round-pet-a8.md)已离线实现：显式新profile把绑定/根放同一CAS文件，磁盘提交后才发布投影；旧v1不迁移。34专项/全套692通过，见[报告](docs/reports/2026-10-30-round-pet-a8.md)，含真实TLS/模型重开、SIGKILL切点。实例内可检旧revision，新进程无可信锚不能识别整盘旧文件回放；生产初始化/迁移/物理耐久与新增成本上界仍待验。执行：node scripts/verify-round-pet-a8.mjs --output .cache/round-pet-a8/results.json。

[A10不变根/摘要复用](docs/protocol/round-pet-a10.md)已完成：同次full/reduced对照中，64登记额外摘要315→0、编码624365→546431B；完整load/hash308次、动态检查和7次文件/目录同步保持。24专项/全套730通过，见[报告](docs/reports/2026-10-30-round-pet-a10.md)。锁内CAS/坏档/unknown/期限不放宽，full回退保留、格式无迁移，默认通道仍关闭。下一共同G0/真实包批准与实体资源门槛；不把宿主样本当上界。执行：node scripts/verify-round-pet-a10.mjs --output .cache/round-pet-a10/results.json。

[400原像素M0审阅](docs/reports/2026-10-30-native400-m0.md)：全部78动作HTML位于.cache/native400-m0-review-v1/index.html，400不缩放／无额外安全圆，人工裁切审核待完成；正式360与设备保持。

[400 M1小样与交接](docs/reports/2026-10-30-native400-m1.md)：6个最终HC12候选及编码前后完整动画已生成，1323帧离线校验通过，42保持118帧；正式导入／设备仍待适配。预览.cache/native400-m1-samples-v1/index.html，最终包.cache/native400-m1-hc12-v1；[设备侧合同](docs/protocol/native400-device-handoff.md)。

[400 M2宿主管理与预览](docs/reports/2026-10-30-native400-m2.md)：显式400导入／worker／8语义角色恢复及512KiB帧链路已验证，完整78候选库已生成；12动作超旧设备单文件cap，未自动扩大准入。报告含独立临时管理预览命令，正式360与设备保持。

[G0-R1共同契约/真实素材复核](docs/reports/2026-10-30-round-pet-g0-reconciliation.md)已完成本轮范围：真实360/46库全F/241帧CRC/index和46源视频固定上游blob一致，P/M/N分域确认；无独立素材approval或真实A2导入。首窗口设计选远端0/11+physical4、remote4暂禁；R2显式离线门禁/逻辑gate与恢复、R3独立wire提案/Node-C++宿主字节向量已交付；真实UI/固件适配与共同签核仍缺，联合G0未关闭。R1阶段check及746回归是历史证据，G1/G2/设备窗口继续独立。

[G0-R3协议提案与宿主对照](docs/reports/2026-11-02-round-pet-g0-r3.md)：独立round-pet-native360-wire/1闭合合同、错误/HTTP恢复表与纯core往返账本已完成；78正/62反向量经Node与原创C++17宿主对照，24专项、全套811/811及临时清理通过。未装配新hello/生产HTTP或设备；R4已另接临时adapter，独立许可批准及固件G1/G2仍待验。

[G0-R2首窗口/提交边界](docs/protocol/round-pet-g0-r2.md)已完成：显式first-window-review/1双重门禁/选主隔离、有界local4/latest模型、gate后取消不撤销saved、未知恢复不补成功/不降floor，35专项/全套784与check通过。[报告](docs/reports/2026-10-30-round-pet-g0-r2.md)区分临时真实TLS与逻辑Flash，缺省通用46候选、TTL/格式/生产OFF保持，正式UI/wire及固件G1/G2待验。执行：node scripts/verify-round-pet-g0-r2.mjs --output .cache/round-pet-g0-r2/results.json。

[400批准压缩版78库](docs/reports/2026-10-30-native400-merge.md)：用户已确认颜色，12项替换／其余66文件保持；全部18675帧重验通过，78文件均压在旧单文件cap以内。新完整库已通过旧sim_A cap下宿主激活、78动作及缓存恢复；新目录／SHA见报告和[设备交接](docs/protocol/native400-device-handoff.md)。旧库保留，设备适配和真实性能仍待验。

[400四动作三档压缩对照](docs/reports/2026-11-02-native400-preprocess.md)：HTML位于.cache/native400-preprocess-review-v1/index.html，待机／摇扇／荡秋千／星光粒子的12候选同步实际PET4预览，标明每档体积和正负收益。仅独立画质实验，原合并78库与设备侧输入保持，未批准替换。


[G0-R4默认OFF临时宿主adapter](docs/reports/2026-11-02-round-pet-g0-r4.md)：复用session/guard/A2/A3/R2/A8，验证新hello、schema2观察、取消与迟到、命中非saved、未知结果及持久后发布。30专项、全套844/844通过，正常/SIGTERM清理通过；修订2字节80正/62反Node-C++宿主对照通过。R4当时无新GET承载，后续已由R5接临时GET/分段，无生产入口/设备；共同签核/真实许可/G1/G2继续独立。


[G0-R5临时GET/分段承载](docs/reports/2026-11-02-round-pet-g0-r5.md)：A4与临时adapter共享读许可、Range/逐4KiB授权与实际退出，30专项通过；完整原创PET4分段/F/CRC/index、6页目录、取消/撤销/超期及忽略abort期间保槽/素材pin已验证。默认OFF/readBudget=null，R3修订2字节不变；全套见报告。R6已补A1 actor新wire全链，固件共同签核/真实许可/G1/G2仍待验。

[400全部78动作压缩优先](docs/reports/2026-11-02-native400-compact78.md)：HTML位于.cache/native400-compact78-review-v1/index.html，含同步原版／压缩版、逐动作体积／CSV及局部色差重点入口。总389.93→332.58MiB／省14.71%，78全变小且均在旧cap内；该批量阶段为独立候选；后续已按用户确认合并，最新交付见下方。

[最新400压缩版交付](docs/reports/2026-11-02-native400-compact-merge.md)：用户已确认全78版并合并，新库.cache/native400-compact78-v1／348737057B，完整78与八语义角色目录摘要均更新；全帧及宿主管理链路通过。旧库保留，设备按[交接](docs/protocol/native400-device-handoff.md)和[提示词](docs/protocol/native400-compact-device-prompt.md)继续既有验证，本轮未写设备／固件。


[G0-R6 A1 actor新wire闭环](docs/reports/2026-11-02-round-pet-g0-r6.md)：复用模型经真实临时mTLS/GET形成库存/下载/完整校验/独立首帧/保存/淘汰与重连证据，30专项、check及全套910/910/监督清理通过；缓存命中不伪造saved，unknown仅查询恢复，不重放旧目标。默认关闭、无设备或生产入口。R7已补同步模型gate失联/暂停收尾；共同签核/真实许可/G1/G2仍未完成。


[G0-R7 gate失联/暂停恢复](docs/reports/2026-11-02-round-pet-g0-r7.md)：已进入gate的一次本地完成能力保留，旧context/播放/outbox失效，新会话等待实际同步commit退出；unknown不重写，旧saved/playing拒绝，close不提前放claim。30专项、check及全套940/940通过，监督正常/取消清理通过。默认关闭，无设备/生产或外部配置变化；共同G0/许可/资源证据已完成本轮只读核定，当前下一入口已转400身份/窗口能力/完整性与新协议分片，固件资源另审，异步ESP时限仍待验。

[共同G0/真实许可/G1-G2证据核定](docs/reports/2026-11-02-round-pet-g0-closure-review.md)：正式360/46文件F及P/M/N/source保持；固定来源、原作者声明与CC官方条款已直读，非商业/署名/SA与代码MIT分开。内部offline-validation批准及固件修订2/GET签核仍缺，G1完整维护未过、G2无设备TLS证据；保持默认OFF，本轮check/全套940通过，无生产代码或外部服务变更。下一入口见[C01–C12交接](docs/context/plans/round-pet-g0-handoff.md)。

[管理端400规划对齐](docs/reports/2026-11-02-native400-manager-alignment.md)已核新素材F/源/I/M_host及42时序/额外tag0/窗口预算；共同G0以新400目标列缺口。400-01身份及400-02纯core窗口已离线完成；400-03独立review协议/向量已离线完成，400-04默认OFF临时装配已离线完成，400-05调度已离线完成；不以规划或旧940项推导400设备已支持。

[400-01离线身份与严格导入](docs/reports/2026-11-02-native400-01.md)：新400主入口、P/M/N_offline分域及独立用途批准、完整验证/缓存重开已实现；30专项/check/970回归通过，真实素材仅核候选身份，无真实批准/导入或设备变更。400-02进展见下；旧尺寸只保留备份回退。

[400-02帧窗口与完整性](docs/reports/2026-11-02-native400-02.md)：1MiB真实ring、三RGB、118/241帧时钟及首帧/取消/退出已离线验证，默认全验后重读＋帧SHA，显式渐进只作对照；48专项/独立CLI/check/全套1018通过。本地schema3不是共同wire或固件资源准入；400-03后续见下。

[400-03独立review协议与Node/C++向量](docs/reports/2026-11-02-native400-03.md)：固定全验重读、cap/状态新版本、local asset.verified与首帧关联、storage/inventory不支持明确为null；78目录4项20页，94正/116反双语言字节一致，36专项/独立CLI/check及全套1054通过。正式策略/namespace/持久化/TLS仍待[固件确认W01–W10](docs/protocol/native400-wire-review.md#交固件的决定待确认项尚未共同签核)；400-04进展见下，正式策略/准入仍待确认。

[400-04默认OFF临时链](docs/reports/2026-11-02-native400-04.md)：原session/guard＋A2 CAS/A4承载接400窗口actor，真实独立loopback mTLS验证20页/双遍/首帧/118短尾、local idle4证据、续租/重连与取消实际退出；37专项/监督CLI/check/全套1091通过。模块不创建listener，生产入口未接；无Flash或完整触摸抢占/回最新base。400-04阶段范围见[API/回退](docs/protocol/native400-host-review.md)，调度后续见下。

[400-05离线调度](docs/reports/2026-11-03-native400-05.md)：默认OFF候选显式local4优先/最新base、deferred、原截止/自动renew、loop/once_hold/欠载和在途退出；35专项/独立CLI/check/含构建1126项通过。复用单窗口，不改400-03固定字节；本地源不等于设备缓存/触摸，Flash、正式能力/策略与资源准入仍待共同G0。[API/回退](docs/protocol/native400-scheduling-review.md)。

[400-06策略与资源评审](docs/reports/2026-11-03-native400-06.md)已完成文档范围：已装N_boot与离线P/M/N分域，完整性/重复触摸/本地无限循环与有限remote目标仍有差异；新增预取和完整调度周期须另核预算。源代码保持、check/1126回归通过。400-07周期预算后续已实现，400-08只读来源映射已离线完成；[决定/回退前提](docs/protocol/native400-g0-review.md)。

[400-07完整周期预算](docs/reports/2026-11-03-native400-07.md)：提前续租/GET-only/完整exchange与源/累计compute预算、显式计划拒绝及170段原job到期已通过24专项/监督CLI/check/全套1150项。默认OFF，保原TTL/截止/固定wire，成本仍是离线声明。[API/回退](docs/protocol/native400-cycle-budget.md)。

[400-08 N_boot只读来源审阅](docs/reports/2026-11-03-native400-08.md)：独立批准/strict V2与候选P/M/N映射、私有28MiB流式SHA/逐物理payload/源变动与实际退出，44专项/监督CLI/check/全套1194项通过；只输出PC来源审阅，不做全媒体校验/设备事实。旧代码和固定wire保持；后续400-09见下。[API/回退](docs/protocol/native400-bootstrap-review.md)。

[400-09保存与可信重开](docs/reports/2026-11-03-native400-09.md)：私有有界CAS journal、重开历史与独立批准下的实际源复验、未知提交冻结、取消实际退出及共享只读槽已完成；43专项/监督CLI/check/含构建1237项通过。[API/回退](docs/protocol/native400-source-review-storage.md)，复现：`node scripts/verify-native400-09.mjs --output .cache/native400-09/results.json`（先`npm run build`）。无默认服务接线或设备事实；后续400-10装配见下。

[400-10临时宿主只读装配](docs/reports/2026-11-03-native400-10.md)：独立批准摘要身份、赢家专属400-09 owner、只读status/代理、构建JS宿主真实fetch与历史重开/退出等待已验；36专项/监督CLI/check/全套1273通过。[API/回退](docs/protocol/native400-source-review-host.md)。复现：先`npm run build`，再`node scripts/verify-native400-10.mjs --output .cache/native400-10/results.json`。无新CLI/config或自动启用；后续400-11评审见下。

[400-11操作入口评审](docs/reports/2026-11-03-native400-11.md)已收口选择绑定、独立批准/可信会话、请求去重/定向取消与同步授权gate设计；两项原创临时对照确认既有接线缺口，332条原源保持，check/全套1273通过。[拟定契约](docs/protocol/native400-source-review-controls.md)的CTL-01–40尚未执行，页面操作/原生选择器仍未实现。后续400-12选择绑定见下，原400-10只读入口保持。

[400-12内部选择绑定](docs/reports/2026-11-03-native400-12.md)：元数据选择不读内容、opaque引用/TTL/撤销、原reader打开后首读前指纹比较与manager提交前检查已实现；35专项/监督CLI/check/全套1308通过，原map/wire与默认路径接口保持。[API/回退](docs/protocol/native400-source-selection.md)，复现：`node scripts/verify-native400-12.mjs --output .cache/native400-12/results.json`。仅内部离线能力，无网页控制或真实源；后续400-13控制器见下。

[400-13内部操作控制器](docs/reports/2026-11-03-native400-13.md)：单可信会话/选择/任务、ACK去重/一次消费/定向取消、同步授权期限/提交检查和实际退出已验；45专项/监督CLI/check/全套1353通过。[API/回退](docs/protocol/native400-review-controller.md)，复现：`node scripts/verify-native400-13.mjs --output .cache/native400-13/results.json`。13阶段仅内部离线能力；后续400-14已另接显式临时交互候选，默认无provider仍只读，见下。

[400-14临时交互审阅候选](docs/protocol/native400-interactive-host.md)已离线验证：显式默认OFF profile、私有实例固定IPC、受信临时页面proxy与共享审阅/复验/取消UI，42专项/1395全套通过；丢响应手动确认原请求，取消等实际I/O退出。默认plugin apply无provider仍只读，候选未安装，无真实源/固件/设备/生产listener操作。仅构建JS hook宿主+临时HTTP/UDS，后续400-15已补共享UI真实浏览器与安装rc.5静态评审，DSH用户身份/native picker仍待接入。[报告](docs/reports/2026-11-03-native400-14.md)、[Spec/Diff](docs/context/plans/native400-14-spec.md)、[替代记录](docs/context/history/native400-14-evolution.md)。

[400-15 provider/原生选源评审与真实浏览器验证](docs/protocol/native400-provider-review.md)已完成本片范围：当前安装DSH rc.5与旧rc.3动态基线分开；原始路由鉴权、Desktop删Origin和可信单文件选源缺口已核，默认仍关闭。既有14链路在独立Chrome/React18.3.1真实DOM验证审阅/复验/取消待I/O/503原请求确认/刷新/代理重挂/unknown恢复；10专项/1405全套通过，344条原文件SHA保持，仅新增验证工具。真实DSH身份/native dialog/profile仍未验，下一400-16可信本地broker交接适配器先Spec/Diff/离线验证。[报告](docs/reports/2026-11-03-native400-15.md)、[替代记录](docs/context/history/native400-15-evolution.md)。
