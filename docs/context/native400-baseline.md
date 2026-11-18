# 当前管理端目标：1.75C-EN／400×400

2026-11-18 真机使用 VP8 `0.1.6-battery-usb-pair-test`／`ota_0`，保留板上 `0.1.5-usb-pair-test`／`ota_1` 回退、57 个素材与持久绑定记录。DSH 已实测查询、绑定核对和 USB 电池。[当前实装](../reports/2026-11-18-vp8-desktop-battery.md)

离线素材目录登记 96 项，0–77 引用冻结的原 78 动作，78–95 为本次从上游复查选入的 VP8 补充候选。当前板上库存与验证口径见上一段。[114 段复查与 18 段补录](../reports/2026-11-18-native400-upstream-action-review.md)

2026-11-16 的 OTA 阶段，独立 DSH rc.3 从 `0.1.3`／`ota_1` 正常升级到 `0.1.4`／`ota_0`，固件任务验收了升级后 57 个对象、动作 67 离线播放、中断和掉电恢复。日常 rc.1 已完成宿主部署验证，实际迁移与可信发布材料待就绪。旧 `56644ffd` 固定动作 1 及 PET4 400×400／78 动作与 PMA1 保留兼容及回退证据。[OTA 真机报告](../reports/2026-11-16-vp8-ota14-dsh.md) · [日常部署](../reports/2026-11-16-vp8-ota-daily.md)

## PET4 历史与兼容

最新实测候选 `2ad12eb5` 通过持久首绑和跨软件复位续接。动作 1 全部 876 块获确认，备用槽载荷摘要匹配，完整提交未通过。设备最低内部 RAM 为 50,539 B，距底线 1,387 B。实测后已恢复备用槽、非活动根和 `2cc7060d`，应用逐字节读回、应用外 15 段和 241 帧待机通过，绑定记录保留。短时 STA 四阶段及先前 USB 异常证据仍保留。[最新实板结果](../reports/2026-11-13-native400-pma1-tail-timing.md) · [历史设备窗口](history/tcp-media-evolution.md)

当前主线保留 400×400 原像素居中、466×466 面板、compact78 动作 42 为 118 帧、其余 241 帧。TCP 维护首轮限定动作 1/11，沿用 V2 namespace、28 MiB 双根与 4 活跃＋1 备用槽，0/4 受保护。Node/C++ 真实 loopback 与宿主 NOR 已通过两动作，独立 LAN 入口已用于动作 1 的实板对照，常驻产品入口待接。f553 与旧 400、正式 360 继续作为回退版本。[宿主 NOR 报告](../reports/2026-11-11-native400-tcp-media-nor.md)

资源与验收目标仍为内部≥48KiB、PSRAM≥1MiB/最大块≥512KiB、main栈≥1KiB及2MiB app/≥256KiB余量；当前明文TCP须冻结Wi-Fi/lwIP、任务栈、队列、实际关闭/网络延迟短测门禁。旧TLS连续内存门禁只属历史候选，不再作设备TCP前置。上游静态+3904B不能替代动态实测；未定参数继续NO_GO，不延TTL、不降低校验或吞ACK故障。360历史G1失败仅作风险依据。

上述规划轮只改文档/证据；后续400-01/02新增离线实现，未迁移生产装配、namespace、分区/缓存/配置；不接设备、生产listener或现有pet/桥接/DSH。新素材许可与MIT分开，未新增真实A2批准或CAS导入。

外部旧0dcdf窗口执行中/360缓存快照已由400-06刷新并[归档](history/native400-06-evolution.md)。本轮仅读报告/源码，新prefetch工作树并发变化已重读；报告中的已测6882与当前源码分别绑定，不猜测未报告的设备更新。

400-01范围和真实候选精确值见[实现报告](../reports/2026-11-02-native400-01.md)/[API](../protocol/native400-identity.md)。候选N不是生产N，本阶段不改变旧V2缓存或真实用途批准。外部固件/窗口仍为此前读取快照，本轮未新读固件或设备。

400-02[离线模型报告](../reports/2026-11-02-native400-02.md)/[API](../protocol/native400-window.md)：逻辑typed-array最大2194816B（含新增帧SHA收据7712B），不等于固件预算。默认全验后重读；渐进仅显式离线比较，pending/failed与verified分开。48专项/check/独立CLI/全套1018通过，无真实媒体/设备或新固件读取；400-03离线合同/向量现已完成，正式策略/共同G0仍待完成。

400-03[合同/报告](../reports/2026-11-02-native400-03.md)/[字段与固件待确认](../protocol/native400-wire-review.md)：review-only、verified-replay固定、cap3/playback3/display3/storage0/inventory0/cancel2，local独立verification_seq/首帧关联；78目录4项20页，94正/116反Node-C++同字节、36专项/独立CLI/check/全套1054通过。后续400-04已接真实临时HTTP/TLS/actor；不把cap0库存null当已知空或saved。正式策略/N/持久化/资源签核另行。

400-04[报告](../reports/2026-11-02-native400-04.md)/[API](../protocol/native400-host-review.md)：默认OFF临时链实际借用原认证/guard/CAS/有界承载接400窗口；37专项/check/CLI/全套1091通过。每个executor仅一≤32KiB段＋≤2464B头，核心工作集不变；非RSS/ESP预算。local4仅idle原创源全验/首帧，Flash和完整touch/latest/自动调度未实现；400-05后续见下，W01–W10/G1-G2/真实用途/设备窗口继续待定。

400-05[报告](../reports/2026-11-03-native400-05.md)/[API](../protocol/native400-scheduling-review.md)：2026-11-03默认OFF代码选项的local4优先/最新有效base、loop/once_hold/欠载/renew与原截止、取消/迟到/实际退出35专项、监督CLI/check及1126回归通过。一个原池/显式本地原创源，无真实触摸或Flash库存；本轮未新读固件/媒体，正式能力/策略/双遍成本/N/TLS/G1-G2/24fps和用途批准仍待共同确认。

400-07[报告](../reports/2026-11-03-native400-07.md)/[API](../protocol/native400-cycle-budget.md)：旧漏窗实际复现/新链提前续租、完整exchange/GET-only/source/累计compute及计划预算拒绝、170段未全验先job到期已验。24专项/监督CLI/check/1150回归通过，原TTL/截止/actor/固定字节保持；无真实设备/媒体/固件新读取，不将声明成本当物理保证。

400-08[报告](../reports/2026-11-03-native400-08.md)/[API](../protocol/native400-bootstrap-review.md)：PC N_boot/V2来源审阅与候选P/M/N/独立用途已建严格映射；双根/floor/uint64、私有流式整SHA/逐F/文件稳定与实际退出44专项、监督CLI/check/1194回归通过。没有全媒体/真实cache/设备回执或安装、保存、库存事实；外部现场仍400-06快照，正式采纳/真实用途另审。

400-09[报告](../reports/2026-11-03-native400-09.md)/[API](../protocol/native400-source-review-storage.md)：43专项/监督CLI/check/1237回归已验私有有界journal、CAS与未知提交、重开仅历史/实际源复验、取消实际退出及只读槽。无默认IPC/服务接线、全媒体或设备确认；后续临时status装配已完成，外部固件/资源仍400-06快照。

400-10[报告](../reports/2026-11-03-native400-10.md)/[API](../protocol/native400-source-review-host.md)：36专项/监督CLI/check/1273全套通过赢家专属owner、只读status代理与构建JS宿主实际读取、双进程选主/半启动/挂起attach拒绝、历史重开/取消/unknown/坏档/实际退出。无生产或设备通道、真实DSH/browser加载和页面审阅操作；后续400-11评审已完成，400-12可选绑定已完成，400-13控制器与400-14临时交互已完成，最新范围见下。

400-11[报告](../reports/2026-11-03-native400-11.md)/[拟定契约](../protocol/native400-source-review-controls.md)：已完成文档评审和两项原创既有API对照，332条原源不变，check/1273回归通过。来源选择钉住/可信会话/去重/定向取消/同步授权gate均是后续设计，CTL-01–40未执行；当前仅400-10只读代码，后续400-12已实现内部绑定，仍不能据此开启网页写入或真实窗口。

400-12[报告](../reports/2026-11-03-native400-12.md)/[API](../protocol/native400-source-selection.md)：35专项/监督CLI/check/1308全套已验元数据选择与实际fd首读前钉住、撤销/TTL/时钟/资源及manager原valid门禁；只补内部选择，不改source-map/设备wire/只读service。400-13已补内部会话/一次选择/去重/定向取消与同步授权gate，400-14已接受信临时页面provider，实际浏览器/DSH身份/原生选择仍待验；外部仍400-06快照。

400-13[内部控制器](../protocol/native400-review-controller.md)与14[临时交互](../protocol/native400-interactive-host.md)继续有效；[400-15报告](../reports/2026-11-03-native400-15.md)/[provider决定](../protocol/native400-provider-review.md)：10专项/独立CLI/check/1405全套，以及独立浏览器真实React DOM/HTTP/UDS闭环已验。安装DSH新鲜核为rc.5、旧动态基线/peer仍rc.3；raw路由鉴权/原生选源/Origin转发差异明确，不能自动启用。共享DOM验收不等于DSH身份/native dialog；下一400-16可信本地broker离线交接适配器，外部仍400-06快照，无设备准入。
