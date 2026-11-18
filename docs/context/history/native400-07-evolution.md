# 400-07 周期预算条件算术的替代

2026-11-03。原400-06中的1490ms漏窗/170段是条件算术，现由[400-07报告](../../reports/2026-11-03-native400-07.md)/[当前API](../../protocol/native400-cycle-budget.md)补实际私有loopback/源/actor对照及必要修正。下面保留实施前摘要，链接已按归档位置重定位；不替代400-06外部固件快照/尚未关闭的共同G0或资源门禁。


## 原docs/context/index.md

管理端最新（2026-11-03）：[400-06 Spec](../plans/native400-06-spec.md)/[Diff](../plans/native400-06-diff.md)、[D01–D09决定/时间预算](../../protocol/native400-g0-review.md)、[只读核定报告](../../reports/2026-11-03-native400-06.md)/[35文件证据](../../protocol/vectors/native400-06-g0-review-v1.json)、[旧快照归档](native400-06-evolution.md)。固件报告已记400本地6882/N_boot四对象留驻/连续23.297fps，24fps和联网未验；工作树新增预取不沿用旧资源证据。400-05的35专项/默认OFF单窗口调度继续有效，本轮314条源SHA保持，check/含构建1126项通过，无新增行为/测试。下一400-07完整调度周期预算负例，再400-08 N_boot只读来源审阅；正式能力/策略/真实用途/Flash写/时间凭据/G1-G2仍待共同确认，不开设备通道。


## 原docs/context/current-system.md

2026-11-03 [400-06共同G0/策略资源评审](../../reports/2026-11-03-native400-06.md)已完成只读范围：固件35份引用SHA及当前400-05代码对照，确认已装N_boot与离线N/P/M分域、本地与remote寿命/触摸/完整性差异、预取源码新预算和单周期/170段时间缺口。[D01–D09决定](../../protocol/native400-g0-review.md)、[证据](../../protocol/vectors/native400-06-g0-review-v1.json)、[旧快照归档](native400-06-evolution.md)。314条既有源/fixture/脚本路径SHA全保持，无新增运行时代码/依赖或测试；check（仅语法）和含构建1126/1126通过。共同G0签核、真实用途和G1/G2仍未完成；下一400-07先Spec/Diff验证实际调度周期预算负例，400-08再做N_boot只读来源审阅。


## 原docs/context/current-todos.md

1. **400-07完整调度周期预算负例（下一入口）**：先Spec/Diff，基于[400-06 D07/预算](../../protocol/native400-g0-review.md)在现有loopback/双时钟/pump中验证本地read/同步工作/GET/控制flush/pending ACK对renew的影响、1490ms触发窗口条件和170段与120秒作业的准入。区分标量反例与实际trace；需要时修正控制让步/入口预算或明确拒绝范围，保原截止/失败关闭，不加TTL掩盖问题，不改固定wire/生产入口。


## 原docs/protocol/native400-g0-review.md

## 条件时间预算

调用关系以实际代码为准：remote driver的单source owner包住gateway.read；lab gateway.read内部仍有exchange/flush后才GET，读后又强制poll。每个exchange可能清lease/有界outbox，多次HTTP累积不是一次500ms的证明。driver只在显式pump检查poll，500ms为提供机会的目标；同步decode/供段、控制交换、本地read和RTOS/锁等待都可能增加无poll区间，未实现自主实时timer或CPU抢占。

| 量 | 当前离线参数/算术 | 未证明的部分 |
| --- | --- | --- |
| lease/host安全horizon | 15000ms；既有500/500ppm、command_delay1900、margin10，leaseSendBudget算13074ms | 不是ESP时钟/RTT实测，起点与grant/exchange都需真实关联 |
| 段准入 | 1000+500+100+10=1610ms；Range≤32768B、块≤4096B | 1000ms是单lane与source假设；本地read无该host段许可，完整gateway周期可能更长 |
| renew | 剩余≤6000ms排队，必须>4000+500+10=4510ms；阈值窗口宽1490ms | 不能保证每次在1490ms内再次检查；ACK尚在途、控制优先flags/本地读/同步decode均须进入预算 |
| 有条件漏窗算术 | 上次检查R=6001ms，之后499ms调度间隔+999ms不可抢占本地read，则下次R=4503ms，按现规则拒绝 | 只是显式假设的标量反例，未作为实际driver trace执行。本轮没有因此宣称宿主故障已复现；需要下一专项在真实pump/双时钟/I/O gate验证 |
| 最大动作首遍 | 67号5569645B，ceil(/32768)=170段；两遍11139290B | 每段接近1s时仅首遍就近170s>120s作业，目录20页/控制/验证/首帧另加；32KiB段上限不等于最低吞吐保证 |
| 连续loop/本地 | 120秒remote固定作业；241/24=10042ms、118/24=4917ms | 独立无限autoplay与有限远端意图不同；不能因为renew成功就假定loop永久运行 |

上述算术通过现有leaseSendBudget和标准整数运算核对，不新增运行时门禁/测试实现。短任务成功样本不证明最坏情况；段预算/校验/取消退出不足则拒绝准入。下一应为完整交换周期建立可测剩余预算，并在进入同步/本地IO前预留控制机会；需要协商job/读取策略时另立合同，不单靠延TTL或120秒值掩盖排队。



## 原docs/protocol/native400-scheduling-review.md

## 时间预算与边界

仍单TLS、单HTTP、单pending/一latest/一ordinary和有界flags。host自动renew走原queue/session/guard；当保守horizon剩余≤6000ms才排renew，且须剩余>ACK4000＋exchange500＋margin10ms，不足直接失败关闭。控制优先于下一段，不能在旧GET中插队；取消/撤销仍优先于renew。段1000/cleanup100ms等都是测试假设；物理GET/解码/Flash/TLS/RTOS等待仍须重新实测预算，不能拿本机样本/加TTL放行。

原始remote作业120000ms、local20000ms与可续lease独立，更新/取消/触摸等待/loop/重验/renew不能延长同一意图。超过阈值或失联后需fresh hello与显式新命令，不能自动重放旧意图。断线/休眠/撤销由原session所有者失效；driver不创建生产listener、OS事件源或任何pet监听。

实际ring1MiB、3RGB960000B、history160000B等核心工作集原字节保持；逻辑上限2194816B含7712B收据，executor另≤32768B段＋≤2464B头，观察proof≤4/outbox≤8。新调度仅有界元数据/一个异步IO所有者，不创建第二池/整文件缓存。fixture源、worker、OpenSSL/Node VM/RSS不在这项算术中，不外推为ESP资源上界。
