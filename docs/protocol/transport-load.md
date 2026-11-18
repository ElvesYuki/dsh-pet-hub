# 承载负载、控制排队与延迟评估

2026-10-30。本仓库宿主测量/离线参考契约，依据[Spec](../context/plans/transport-load-spec.md)/[Diff](../context/plans/transport-load-diff.md)，结果见[报告](../reports/2026-10-30-transport-load.md)。本阶段未装配生产控制队列或改分段/设备准入；后续默认scoped复验减量见[契约](verification-reduction.md)，历史full参考仍可重复。

## 可选测量与成本口径

`createLoadMetrics({now})`提供同步measure、异步measureAsync、直接record、add、reset和snapshot。时钟是受信单调毫秒函数，默认performance.now；measure用于同步工作，measureAsync等待真实工作结束。有效测量时钟下原返回值/原错误透传，失败另计数；时钟或指标名称错误直接失败，不把仪器错误降为业务成功。调用方显式把metrics传给证书profile、绑定store、mTLS auth和session runtime；默认不创建统计、不输出数据。

固定类别（full参考）为certificate_leaf、metadata_read/load、peer_binding、session_check、tls_handshake、segment_round_trip、control_round_trip、instrumentation/batch与lane_wait。每类只保存count/failed/total_ms/max_ms及固定15桶，不保留逐条样本；固定计数器为metadata_bytes、asset_write_bytes/calls。snapshot只含数值和固定字段，不含证书、指纹、路径、端口、上下文或报文。分位值是累计桶达到95%时的**样本桶上沿**，不是精确p95，更不是硬上界。数量/总时在当前有限探针窗口内有效，未作为多日统计系统。

full模式certificate_leaf包括DER解析、日期/曲线/签名/扩展/用途复验；scoped模式另拆certificate_static/validity，命中仅省静态部分，见减量契约。metadata_read只量readFileSync，metadata_load还包括私有目录/打开/属性、JSON/摘要/schema和关闭。metadata_bytes累计每次已核对文件大小，不代表物理磁盘流量或cache miss。peer_binding包含证书及指纹lookup，session_check再核对会话/代数/准入。**作用域嵌套，不能把这些total相加。** instrumentation_batch包含1000次空measure的完整调用/统计回写，instrumentation是其中空作用域，均不从业务样本中扣除。

full参考策略的成功session检查包含一次完整叶复验、3次metadata load；模型renew合计6次叶复验、19次load。当前[scoped减量](verification-reduction.md)将每个同步入口限定在同一完整验证revision视图：session 1次load、renew合计4次，缓存静态批准但保留6次动态日期/绑定检查。新请求/写块前仍新scope读盘；无跨请求文件缓存、默认4KiB不变。full负载CLI显式选择full，保留本阶段证据。

fixture默认32KiB Range/4KiB写块保持；16KiB写块、8KiB Range只是显式测量档位。写计数是提交res.write的字节，不等于对端已接收/安装。4KiB也不提供墙钟撤销上界：已写入TLS/TCP/对端的内容不能召回；较大写块扩大两次授权检查之间能写出的字节窗口。

## 离线参考lane

`createTransportLane({clock,control_ms,segment_ms,wait_ms,onFault,metrics})`仅在simulator中由测试使用。clock为非负安全整数毫秒，各预算1–30000ms；onFault是受信同步回调，必须不抛错。enqueue接受kind、bytes与异步run({signal})，返回真实工作完成后的Promise；控制载荷≤4096B、素材段≤32768B，控制等待≤8、素材等待≤1、实际在途≤1。达到容量拒绝，无逐出、合并或自动重试。

已在途工作不可抢占；边界处按控制FIFO优先，再取素材。持续控制到达时不保证素材公平性或完整包完成期限。开始核对排队等待，返回核对实际服务耗时与关闭状态；恰好预算允许，超过预算/时钟回退/工作失败则冻结并拒绝后续工作，通知owner失效。返回前没有定时抢占；同步CPU/文件读取阻塞时Node timer也不能抢占。晚返回不能回滚已经发生的远端效果。

close幂等地拒绝排队项、abort在途并等待实际run结束；忽略AbortSignal的工作仍占槽，不能因外层拒绝就另起请求。迟到结果不成功提交。实际I/O终止期限仍由承载owner提供，参考lane不是生产调度器，也不是取消上界证明。

## 条件预算与准入

若最多N个控制在目标前（**包括活动控制**），服务上界C，dispatch/jitter上界J，保守queue=J+N*C。容量8表示一个新入队控制最多有7个等待控制和1个活动控制在前；活动项若为素材，则收进残余segment项。示例统一额外收取一个完整segment，可能重复保守预留，但不会漏算活动控制。不能把“队列有界”直接换成100ms排队。

本轮沿用**假设**segment1000、poll500、network200、process100ms，J100ms，双端500ppm、TTL15000ms、margin10ms。B是各实时间项总和，RTT为host时钟上界；发送跨度从请求发送起算。见[lease预算](lease-budget.md)，示例输出见报告。若最坏RTT不小于发送跨度，最坏响应到达已无可保证的有效续租窗口；guard会安全拒绝，不能承诺可用性。

本轮没有真实poll等待或网络重传样本；不同方向的重试、同步盘卡顿、OS停顿、物理漂移、设备处理和屏幕首帧均无硬上界。TLS握手只测初次连接，不藏进已确认会话续租；断线必须新hello/acquire。单设备warm宿主样本不能消除这些未知，NO_GO_UNTIL_MEASURED保持。

## 独立执行、证据及回退

```sh
node scripts/verify-transport-load.mjs --output .cache/transport-load/results.json
```

监督自有POSIX测试进程组，30秒上限；私有临时PKI/元数据，literal loopback动态TLS端口、原创70001B合成字节、4档各4轮。模型租约回执不是真实设备指令。通过9项测试后，父进程只合并固定文件的去敏观察：普通文件/私有权限/当前uid/≤256KiB及严格数值schema；非法证据使整轮失败，不保存原输入。失败或取消不导出部分观察。进程组终止的非ESRCH错误记录termination_error并使整轮失败，不假报全部进程回收；仍有child时用已拥有句柄后备。目录删除独立执行，有限5次/20ms重试，不因信号错误跳过。正常/取消删除临时根，保存结果在Git忽略目录中。

回退关闭lane并await实际工作结束，关闭自有Agent/请求/socket/临时listener、会话和store，清自有子进程组与临时PKI。没有真实运行服务或配置迁移需要恢复；撤回metrics/参考lane不改变已存在hub-bindings/1格式、4KiB默认及正式deviceTransport=false。后续[复验减量](verification-reduction.md)已实现实例内静态批准/逐次动态日期和同步revision视图，保留新scope完整坏盘/锁检查；外部写入发现边界明确限定到下一scope，未把它宣称为跨进程事务。生产调度和物理准入仍待验。

## A9持久路径复评

[A9](round-pet-a9.md)另测显式v2 root profile，增加固定可选root scope/计数与四档同负载证据。原full/scoped样本与默认路径保持；新profile多出锁/写/同步/发布复验，嵌套scope不能相加，也不能把旧B1900假设视为新成本已包含。client1500/server2000/ack4000/lease15000分别约束。
