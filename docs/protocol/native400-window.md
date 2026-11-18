# 400-02 纯core帧窗口与完整性（本地review API）

2026-11-02。[Spec](../context/plans/native400-02-spec.md)/[Diff](../context/plans/native400-02-diff.md)、[报告](../reports/2026-11-02-native400-02.md)、[原创审阅向量](vectors/native400-02-window-review-v1.json)。源码packages/core/native400-window.mjs，无Node/DSH/DOM/网络/持久化依赖。此处schema3/profile只在显式离线actor内有效，尚非双方同意的设备能力或新wire。旧通用schema1/2/Native360/R3–R7均不放宽。

## 身份、能力与工作集

构造Native400WindowModel({metadata, hashFactory, clock, policy?, capabilities?})。metadata为400-01 native400Metadata的结果，重新核P/M/N_offline、源摘要与调用方独立批准；不读取真实素材或生成许可。仅78原ID，42=118、其余241，24fps、400²→466²中心33。persistent固定null，不输出saved/offline_available。输入必须由后续装配绑定真实session/guard；本地session字符串/期限和不可序列化token不是认证。

native400WindowCapabilities只接受闭合round-pet-native400-window-review/1：max file5865472B，与1MiB compressed window独立；3RGB每帧320000B（总960000B，前瞻已包含），history160000B、tile8000B、packed scratch8064B、raw PET4头表最多2464B、逐帧SHA收据最多7712B。每连续min(24,remaining)帧payload必须≤1MiB，单帧最大160981B。400-01/通用decoder容许的文件并非必然能进该窗口。

模型实际常驻typed arrays固定2184640B，241帧加头表2464＋收据7712＝2194816B；118帧加1480＋3776＝2189896B。第三RGB为预留池，当前只准备一个ready帧，不实现额外worker前瞻调度。ledger不含400-01完整78元数据/JS对象、输入/调用者输出、瞬时32B摘要、SHA内部状态、VM/GC/RSS和系统栈。close后模型引用归零不保证RSS立即下降。该账本不是固件PSRAM2322168B声明，也不指定每块内存所在区域；固件还须报IO/read-ahead、实际table/对齐/分配器、栈/网络/TLS及持久化预算。新增收据是相对于逐帧CRC方案的**额外**成本，不能藏在旧资源数字内。

hashFactory是调用方可信、同步、标准SHA256增量工厂，每次返回新{update(bytes),digest():Uint8Array(32)}。update必须立即消费且不修改/保留输入视图；clock返回安全整数单调毫秒，无I/O或副作用。model不验证注入算法本身；宿主使用Node内置crypto。倒退/溢出边界失败关闭。

## 两种策略

| 路径 | 首帧资格 | 完整性与成本 |
| --- | --- | --- |
| verified-replay（默认） | 第一遍全验结束，显式startReplay，再逐帧与已验压缩SHA收据相等，prepare＋submit | 第一遍无显示；F＋index＋RGB SHA及全部CRC/extra成功才verified。初始播放至少两遍读取/解码和帧SHA；每次loop显式重读，不保留整文件。原始SHA证明不会自动授权变化后的重读 |
| progressive-review（显式离线） | 当前帧CRC正确、预缓冲够，可在全F前prepare＋submit | 显示pending，完整性要到finish才verified；任何后续F/index/RGB/extra失败停止源，held front标failed。CRC不是来源认证；不准用此本地开关自动开放生产未缓存渐进播放 |

两个策略的integrity与actual分开。全验/网络完成/ready不产生actual；submitFrame是宿主模型的软件显示提交边界，**不能当ESP首帧DMA/物理扫描证据**。default重读失败不撤销旧已验证画面的历史事实，但本次源phase/integrity失败，不能再继续发布；progressive未验证画面失效保留，不承诺有第四RGB可恢复旧验证画面。

## 调用顺序、时钟与失效

1. beginSession(localSession,{deadline})建立本地一次执行上下文；deadline为当前单调时钟后≤1小时的绝对值。没有续租API/自动重试，不延长既有guard期限；未来outer guard裁定实际认证租约。
2. request({command_id,revision,action_id,mode})返回opaque ticket，revision使用uint64十进制字符串。当前相同命令幂等、同ID不同内容冲突、其他命令须更高revision。mode只接受loop/once_hold；once_idle/触摸/latest base仲裁由后续调度切片实现，不自行推导。
3. begin(ticket,headerAndTables)：只接532＋4×(2×frames＋1)字节，检查几何/头CRC/严格offset/文件长度/24帧窗口。整文件作为metadata拒绝，不分配full encoded。palette保留在头表中；tag0全帧、tag1 XOR，周期12必须tag0，其他帧允许额外tag0。
4. append(ticket,payloadRelativeOffset,bytes)严格连续，单段1–32768B。credit受ring实际空闲和含ready的36帧高水位限制；超credit/错offset在写前拒绝且可按正确参数继续。无网络队列/端口/异步请求。先填ring，再decodeNext逐帧消费；不足一帧返回false，至多一ready，不能覆盖front或跳帧。
5. finish必须已接收并解完全部实际帧，核全F/index/RGB/extra。verified-replay第一遍结束才可startReplay；重读复用私有头表/收据、清ring游标/history/摘要、从payload offset0开始。后续loop要上一遍全验、末帧提交且尾帧间隔满足才开启。
6. prepareFrame需要min(24,remaining)初始/欠载重填，未到帧due返回null，成功只给opaque token。submitFrame一次消费。首帧提交才开始动画时间；due=ceil(f×1000/24)。显式tick识别欠载、保front并暂停时钟；补够后提交恢复。迟到提交平移时钟，防止赶帧或尾帧零停留。42末帧117/时长ceil(118000/24)=4917ms，其余末帧240/10042ms；等待不作动画elapsed。调用方须在调度点调用tick，不存在后台定时器。
7. cancel、新request/session、disconnect、suspend、期限或时钟失败清候选/ready/收据/摘要引用，历史front保留且不作为新会话active。恢复需新会话/请求；旧ticket/复制token/迟到frame不能提交。copyFrontInto只复制到调用方320000B输出，不暴露内部buffer。
8. close可重复，无Promise/异步I/O。同步hash回调重入时，禁止换owner/再次执行，disconnect/close立即禁止发布；直到外层同步调用实际退出才回收buffer。resources返回typed-array账本与busy/closed。snapshot是只读观察，不驱动时间/过期；任何实际操作/显式tick仍重新检查deadline。

失败码包括pet4_*、lz4_*、window_admission、window_backpressure、segment_offset、file/index/rgb_integrity_failed、replay_integrity_failed、keyframe_count_failed、window_deadline、clock_failed、stale_window_ticket、stale_frame_token、window_busy、window_closed。内容失败保留failure诊断与历史front，新更高revision才能换源；输入参数拒绝不冒充内容失败。输出仅本地观察，400-03再设计公共wire的限长错误/状态字段。

## 给固件的决定与待确认

管理端离线默认采用全验后重读＋帧SHA收据，显式渐进只作风险对照；这不是共同生产决定。请逐项答复：是否接受两遍初始延迟/每loop重读、7712B收据及SHA成本；若生产选渐进，如何认证头表/逐帧来源并投影pending/failed；末尾失败/取消保front与下次恢复的证据；新cap schema实际memory区域/IO/栈/TLS/Flash和单owner退出；新N/持久化是否仍null。现有USB ACK V2、无Wi-Fi帧率或旧360合同均不作为答复。

400-03先写独立400 wire/hello/完整性与维护字段、78分页/118尾帧/Range及双语言宿主向量，语义未签核部分明确review；400-04才接session/guard/A2/A3/A4/A8/R7的默认OFF临时链。真实用途批准、N/Store、24fps/G1/G2/可信时间/凭据/物理退出仍待固件。本轮无真实媒体导入、Flash/触摸/seek/RTOS/网络或设备验证。
