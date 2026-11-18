# TCP-06：单peer与网络epoch；LAN/STA执行回退方案

2026-11-05。[Spec](../context/plans/tcp06-spec.md)/[Diff](../context/plans/tcp06-diff.md)/[报告](../reports/2026-11-05-tcp06.md)。实现仅loopback；下面的真实窗口步骤是待实施方案。

## 本轮实现

pure core `createNative400TcpNetwork({peerAddress})` 固定可信本地选择的单个规范IPv4。允许入站标准`::ffff:IPv4`表示，拒绝DNS/CIDR/前导零/端口/IPv6别名/通配与组播；不做发现/解析。IP是选源限制，不是密码学认证，不代替HELLO mapping或实际Catalog核对。快照仅epoch/ready/peer_selected/authenticated=false，不输出地址。

TCP02 owner可选peerAddress后初始down，可信单发布者调用`networkLink(epoch,ready)`；非零u32单调，新epoch即使up/up也先失效当前会话并destroy旧socket。旧/同epoch忽略，不读clock、不改状态；UINT32_MAX作为耗尽哨兵强制down，不回绕，后续需关闭owner/重新建立可信实例。pause/resume不能覆盖down。未up/错地址在HELLO前拒绝，不能占用控制session、改重连floor或夺走当前连接。down拒绝base/reapply；重连新session，不重放旧BASE，显式reapply沿原剩余TTL。TCP05可选转交此策略，无UI/IPC/CLI配置入口。

默认不传peerAddress时原行为保持；未启策略的networkLink拒绝。监听仍强制127.0.0.1/port0，没有LAN开关。策略应在未来选定新的STA epoch时同步调用，不等轮询；它不是现已接入的OS/STA事件监听器，也不是当前设备身份或配对。

## 真实配置与LAN/STA实施方案（未执行）

| 阶段 | 具体工作与可审阅产物 | 停止/回退条件 |
| --- | --- | --- |
| R0 来源 | 明确实际批准的完整78原始index、manifest、N_boot、四F/bytes/frames；独立审阅设备缓存来源，不从文件存在推断库存。真实素材用途独立决定 | 缺许可/可信恢复来源或摘要换域即停止，不修改批准/缓存绕过 |
| R1 管理端入口 | 另写LAN profile Spec/Diff：可信代码显式选本机单IPv4接口、临时端口、单peer；沿单实例服务独占listener。禁止通配/自动发现/网页设置网络目标，保留DSH自身权限 | 当前TCP05仅offline-loopback，不能改usage字符串直接上线。新入口未实现，不运行示意命令 |
| R2 固件装配 | 固件任务等boot/Catalog就绪，以匹配身份调用firmware_arm；worker再核四对象并model-ready。复用已完成STA Relay，在STA启动前由可信调用方watch唯一netif；地址/路由有效才up，每次down/up/up-up变epoch | 不从网络调用configure，不存凭据/端点进Git；本仓库不改固件，不运行其脚本 |
| R3 先本地检查 | 确认精确候选SHA、固定SDK/分区、完整回退材料。记录启网络前当前/最低内部RAM≥48KiB、PSRAM≥1MiB/最大块≥512KiB、owner栈≥1KiB；2MiB app余量目标≥256KiB | 上游静态+15184B、显式9420B/8KiB栈非动态实测。原24fps未验收，不能将连通当性能通过 |
| R4 短窗 | 单设备先已缓存0/1/11，4物理触摸；以新session记录HELLO/OPEN/accepted与独立PRESENTED，current_display unknown/verified null。检查触摸期间最新base/取消，链路down-up及上游owner drain，旧source/旧close不复活 | 2秒hub ACK/端侧TX不等于有往返余量；分别量排队/worker/短写/往返，超期失败关闭，不延TTL。资源/校验异常立即停新动作 |
| R5 收尾 | 先管理端取消remote/close并等实际socket/timer退出；设备unwatch/down/disable由固件任务按授权执行；unwatch仅异步请求，必须另等owner关闭确认，再确认本地策略/触摸收尾。记录真实显示与软件回执分账 | 保front不表示持续播放，Completed不表示物理I/O退出；不确定结果不补成功或自动重试 |

执行前须有上述具体输入、候选/回退SHA、独立资源采集与窗口停止标准，以及相应真实网络/设备操作授权。这里不生成本机端点/凭据/生产配置，也不提供可误执行的启动命令。

回退优先停网络候选、关闭自有listener与会话，撤旧epoch；若固件需恢复，仅由固件任务按已有成套镜像/缓存恢复方案执行。板上f553及旧400/360备份本轮均不动；不回退现有pet/bridge/DSH服务，因为本轮未改变它们。

## 下一入口与证据范围

本轮12专项含纯策略、实际loopback准入/旧事件/up-up/重连/收尾与TCP05实际原创PC文件路径；没有新wire、真实LAN、STA、ESP或真实素材验证。收尾已补读终端STA Relay最新报告：178工具、默认/owner构建、fakeSDK/TSan等通过（非本轮重跑），均未部署。800f/b4be候选与板上f553分开，DRAM较默认共+15216B非动态通过；真实watch/arm/STA初始化及同步关闭确认仍未装配。不重复Relay/owner实现。下一实施R0/R1的可信真实输入与独立LAN profile评审，之后才按授权进入STA资源窗口；不重复终端Core/owner/Bridge。丰富STATE、媒体流、保存/V3继续后置。
