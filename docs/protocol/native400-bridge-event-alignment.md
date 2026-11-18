# TCP-04：播放 Bridge 事件对照与共同待定项

后续状态：TCP05已补[离线可信绑定与最新终端快照](native400-tcp-binding.md)。下文transport无运行证据为TCP04阶段语境；终端现已有完成Core报告与在建owner源码，内部事件事实仍有效。

2026-11-05。[Spec](../context/plans/tcp04-spec.md)／[Diff](../context/plans/tcp04-diff.md)／[报告](../reports/2026-11-05-tcp04.md)。本轮只读核对终端接口、实际 control_bridge.h 与最新报告；这是管理端内部审阅候选，不是双方已签核的网络协议。原七消息、PTC1、Node/C++字节向量和 TCP02 owner 保持。

## TCP04当时上游快照

端侧默认 OFF 的播放 Bridge 已接入 worker、完整文件 SHA、Source/元数据、frame0 CRC、View 完成回执与 EOF；不再把这些列为未实现。默认 f2cfaa4a…606752B、显式 adapter 9dc15171…625024B 都仅构建未部署，板上仍为用户确认正常的 f5538cb9。默认 demand/damage/poll/quiet；400² 在466屏(33,33)，三 RGB 帧＋1MiB 压缩环保持。已缓存0/4/1/11，remote仅0/1/11，4仅物理触摸，无运行期400持久写入。首段约23.94fps、连续23.74fps、暖切约104ms是此前真机报告，严格400@24与间歇静止根因仍未关闭。

输入8、输出16项 SPSC；可信本地 Config 一次 CAS 发布，worker 比较恢复 Catalog 的四个 action/SHA。无配置继续本地。Config 不是 HELLO/OPEN 可下发的对象，mapping 也不是认证或真实用途批准。候选静态控制状态3896B、整体 DRAM 比默认多3904B，显式 PSRAM4439288B不变；不能外推为联网动态内存/栈保证。另只读发现未接 app_main 的 control_transport.h 回调 Core 草稿：最多256B read、单 TX cursor/2秒写期限、5秒 OPEN 与15秒空闲、只序列化 v0 ACK/PRESENTED，忽略其余阶段事件；当前 status/Bridge 报告未给其构建或运行证据，本轮也未运行。不能重复称 transport 逻辑完全不存在，但实际 socket owner、断线持续 drain、Wi-Fi/lwIP、共同扩展 wire/身份及动态资源仍待完成/核对。

## 实际事件到管理端的边界

所有事件有外层 transport、reason、stamp、decision、reused_sha、at_ms、observed_ms。stamp 包含 intent(origin/action/session/request/token)、source、cycle、mail、action、transport。transport 是非零递增 u32，区别于 Control 内部 connection、u64 token/source/cycle；不把它们互相替代。下表的证据均为设备内部报告，LAN 明文传输不能成为密码学证明。

| 端侧实际事件 | 当前事实及管理端处理 | wire 状态 |
| --- | --- | --- |
| Connected / Ack | 连接/请求决定；stamp 可能不代表播放，绝不建立 SHA 或首帧 | 既有 ACK 的序列化仍须逐字段映射，不能直接内存拷贝 Event |
| WholeSha | 完整文件 SHA 流程或匹配的 immutable ready cache 通过；发生在 Source.bind 前，source/mail 可为0。reused_sha 区分证明复用与新扫描 | 新状态编码待共同定版；当前 Event 没有摘要字节，关联来自可信本地 Config/恢复资产，不能伪造网络 digest 字段 |
| FrameReady | Source/metadata、frame0 解码/CRC/release/schedule.prepare 已完成，此时绑定非零 source 与 mail；不等于显示 | 待共同表示 |
| Presented | 仅 Remote，View.show 返回且 DrawState.finish current，worker 再核完整 stamp 与当前期限。at_ms 为 View 完成，observed_ms 为 worker 观察，不能早于 decoded 或晚于观察 | v0 PRESENTED 无法承载全部 stamp/时间对/等级，不直接追加字段或探发未知 type |
| Completed | 完整帧数解码、Source.finish 整段 SHA、最后一帧当前显示 ACK 后，每 cycle 一次；远端继续循环，触摸随后选择最新有效 base | 周期完成，不是通用 EXIT/I/O 销毁；正式语义待定 |
| IntentInvalidated / Failure | 意图失效/播放错误，front 可能保留，只记历史，不推导实际 Flash/draw/socket 已退出 | 错误/失效表示待定 |
| ConnectionClosed | 连接失效，stamp 可空；不是 Touch 结束 | 新连接关闭范围待定 |
| ConfigRejected | 本地配置失败，可能 transport=0；本候选不把无连接的诊断套入某个新连接，应由未来可信本地诊断路径单独呈现 | 不作为远端配置能力 |

同一 Remote token 循环换 source/cycle，WholeSha、FrameReady、Presented 只每 intent 报告一次；Completed 每 cycle 报告。不要求每圈重发 proof，不从 Completed 制造新首帧。Touch 没有 Presented 事件，FrameReady 不能成为“触摸已显示”；Bridge 类允许 Local 周期 Completed 且抑制本地阶段报告；当前 app_main 在非 Local 分支调用 eof，未据此声称真实 worker 已报告 Local Completed。Completed 的后续圈不继承一份“当前全媒体前验”证明。

输出满必须独立读取 Ports.revoked_through() 并关闭受影响的真实 socket，不能只等 ConnectionClosed 入队。断线也持续 drain，旧 transport 事件/hint 不得撤销新代。本地 Touch 诊断允许抑制以免阻塞播放；管理端因此不能依靠完整事件流推断所有本地状态。维护“未知/历史”的展示仍必要。

## 管理端候选与接口

`packages/core/native400-bridge-events.mjs` 是纯 core、默认关闭的内部 Event 审阅器，没有 socket、计时器或 DSH 依赖。调用方显式传 `candidateEnabled:true` 与四对象 records；每个实例只属于调用方可信固定的同一 boot/mapping/恢复资产，不能跨启动复用。Event 本身不带 boot/mapping/完整摘要，不能自建可信 scope；未来 wire adapter 必须先核 HELLO/映射，再创建/销毁此 scope。本片没有提供生产装配。

- `begin(gen)`：可信选择新 transport，u32 非零严格递增；同 boot 的 token/cycle/时间高水位保持。
- `expectBase(session, request, action)`：固定本地已选目标，Remote 报告必须匹配；它不是 BASE 发送、ACK、期限控制或授权功能。切换目标先将旧stage/首帧转历史；失败/失效及触摸完成退役token，远端Completed仅退役该cycle，允许后续合法循环。目标/租约失效由未来 owner 同步关闭观察范围，本候选不能单独作持续 playing 状态源。
- `observe(event)`：严格封闭字段/u64字符串，分别保留 SHA 报告、FrameReady、首帧报告、周期完成与历史。旧 transport/token/cycle/Remote 目标先于时间判断隔离；坏当前事件失败关闭，不泄露原始输入。完整 source/mail/cycle/intent 关联拒绝迟到首帧。Presented 的完成时间不得早于 FrameReady 或晚于 worker 观察。
- `revokeThrough(gen)`：独立处理输出满 hint，旧 hint 无效；本函数只撤观察，**不负责**实际关闭 socket。
- `close()`：可重复关闭、当前仅转历史，拒绝后续事件；无存储/缓存迁移。

输出始终标明 `whole_media:false`、`physical_scan_complete:false`、`io_exited:false`、`wire_supported:false`、`device_evidence:false`。内部 fixture/宿主收到的 Presented 不冒充 ESP 已播放；不产出 saved/offline_available。状态有界，仅当前 stage、最近首帧/历史、完成与高水位，无事件积累队列。

## 与 TCP03 的差异及共同决定入口

TCP03 保留原候选和 renderer，不直接接此 Event。其 verified 要求非零 source、同 token 固定 source、Touch 完整状态与 report_seq，与现 Bridge 的 SHA-before-bind、同 token 多 cycle/source、Touch 无 Presented/输出可能抑制不一致。不能靠填0、复制旧 proof、合成 touch Presented 或 report_seq 就算对齐。

下一共同确认，仍在 PTC1 下协商可识别扩展，不另起协议：

1. HELLO 能力识别、type/固定长度和版本；事件序列是否独立、范围与重连 floor、丢事件后的完整状态收敛；当前 Bridge 无 report_seq。
2. source0 的文件验证阶段、后续绑定、reused_sha、cycle/mail、origin 和 View/worker 双时间是否进入 wire；实际摘要如何关联已审 mapping/四资产。保留完整 SHA/metadata/frame0 CRC 与 EOF 整段校验，明确它们不同于旧 hub whole-media 全帧前验。
3. Touch/Local 首帧是否增加独立观察；现有内部事件不能声称已覆盖。触摸完成与最新 base 返回、新旧连接及晚 source 的状态快照如何表达。
4. 周期 Completed、意图失效、连接关闭、保 front、真实 socket/I/O drain 分开；错误不填成成功，输出满独立 hint 和真实 owner 关闭顺序。
5. 可信本地 Config 的真实 namespace/index/mapping 来源与批准边界；网络不能触发 configure。动态内部 RAM/任务栈/吞吐与延迟待终端资源验证，不能用宿主样本延 TTL 放行。

先共同冻结，再做同协议 Node/C++ 字节向量和 TCP02 的默认 OFF 临时 adapter、独立 loopback。终端已有 worker/View 桥成果复用，实际网络 owner/资源与 ESP 窗口分别验收。当前仅内部合成事件与显式 C++ Bridge 宿主对照；本片未新增 wire/loopback，未触设备/固件/服务/profile。真实素材批准、媒体 TCP 流、长测、持久保存/掉电、400-L/V3保持后置。

回退：不创建/关闭此纯候选，继续保留 TCP01/02/03 默认关闭成果；没有 listener、持久格式、素材、运行配置或设备写入需恢复。本文是交接材料，未代替双方签核或对外发送。
