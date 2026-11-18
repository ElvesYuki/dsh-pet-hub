# 400-07 完整周期预算与准入

2026-11-03。[Spec](../context/plans/native400-07-spec.md)/[Diff](../context/plans/native400-07-diff.md)、[报告](../reports/2026-11-03-native400-07.md)。只适用于默认OFF临时host的scheduling代码选项/显式模拟driver。未改变400-03固定wire、400-02 actor、原lease/作业寿命或生产入口；无设备/真实媒体/固件资源保证。

## 成本声明与续租

`native400CycleBudget({ackMs=4000,readBudget?})`为pure core可信代码入口，返回不可修改的离线声明；scheduling下ACK≤4000、readBudget各项不能超过本片固定上界。非scheduling缺省400-04仍用其原预算/无自动调度。peer报文字段不选择这些参数。

| 量 | 值与含义 |
| --- | --- |
| poll_ms | 500；调用方提供pump机会，不是自主后台timer或RTOS实时保证 |
| compute_ms | 100；单次pump内受控同步步骤累计，上界检查发生在返回后，不能抢占正在执行的代码 |
| exchange_ms | 500；**整个**gateway.exchange（含flush/控制回执），不是每个HTTP各500 |
| source_ms | 1000；一次GET-only或local4 read操作，须实际退出后才归还owner |
| cleanup_ms / margin_ms | 100 /10；声明保留值，未实测ESP/网络/文件系统最坏成本 |
| ACK/renew拒绝floor | 4000，floor=ACK＋exchange＋margin=4510；严格剩余>floor才排renew |
| silent_ms / renew触发 | poll＋compute＋exchange＋source＋cleanup=2200；floor＋silent＋margin=6720ms |

触发从6000提前至6720，授予lease仍15000ms/原guard安全horizon13074ms，remote独立120000ms/local20000ms不变。改变是更早处理续租和入操作前给控制机会，不能以续租为理由扩旧意图寿命。队列仍一pending/一latest/一ordinary/有界flags，取消/撤销优先、pending ACK到期仍拒绝，控制/permit互斥。

已在原400-05冻结源码/实际私有loopback和真实本地reader执行：R6001时touch交换尚不续，499ms后开始读，读中推进双时钟999ms；读后R4503，host拒绝，连接关闭。当前同输入在touch交换提前续租，读前再次交换，结果单socket/epoch不变、读成功，实际新剩余11576ms。只是注入虚拟成本的宿主因果对照，不是物理网络延迟测量。

## driver/gateway边界

`createNative400SchedulingDriver({...,pollMs=500,ioMs=1000})`目前要求pollMs≤500、ioMs≤1000。控制交换和源读取共享原createPullRequestOwner，始终至多一个异步操作；close继续等整个pump及实际操作退出。

- `gateway.exchange({signal,deadline})`完整处理串行控制/lease/outbox。调用者可将signal传给传输；即使下层忽略，也必须真实返回后才回收。owner为整个exchange设500ms相对本地截止和墙钟失效timer，不能把多条flush逐一重计为新预算。
- `gateway.read({signal,deadline})`只消费刚发出的permit执行一次GET，可在没有permit时返回control。**不得内部再做exchange/flush**；driver在读前强制poll、读后再次poll/核session/generation/pass/action/local，再把段给actor。临时lab已通过真实两次exchange＋一次GET检查边界。
- `localSource.read`显式逐段源与原工作池保持；读前控制机会也适用于本地，不靠没有网络段许可就忽略续租。普通touch/cancel等已接纳GET实际退出，旧段丢弃；auth/期限/撤销仍每块新scope失败关闭。
- `supply/decode/verify/replay/tick/prepare/submit/display/endTouch/demand`等受控步骤在pump中累计计算时间，超过100ms即fence。同步操作已返回后的超限无法撤销物理刷新，但禁止再向host发布该新actual；已知front保历史。VM/调度/控制认证成本仍需端侧独立预算，不把这项后验检查叫抢占保证。

exchange/source到截止点（包括恰等于500/1000ms）不能作为成功交给下一步；同步累计恰100ms可通过，101ms或两步60＋60拒绝。超成本清peer上下文/旧意图，source owner阻塞；caller随后按原所有权关闭借用TLS/adapter，使host也进入历史。内容失败可先走旧local收尾/有效base恢复，但若其恢复交换也超成本，仍清context并抛错，不能在catch中漏fence。没有自动重新hello/重试/第二HTTP。

## 计划预算必要条件

`native400JobBudget({bytes,frames,pages=20,jobMs=120000})`只作**声明计划预算必要条件**：frames必须118或241，bytes≤5865472、剩余pages0..20，jobMs不能超过现固定120秒。结果包括fits_declared_plan/required_ms、每遍段数/页数/计算步骤/播放时长、indefinite_loop=false。

当前估算：S=ceil(bytes/32768)，reads=pages＋2S，read-cycle=2×exchange＋source＋cleanup＋2×margin=2120ms；compute-steps=4×frames＋2S＋6；required=reads×2120＋steps×100＋ceil(frames×1000/24)。覆盖首遍/重读/同步计划与首个完整播放；不能借此保证未建模的总wall、泵频率/欠载等待、触摸打断、RTOS/网络/文件系统上界，后续仍受逐操作/原job失败关闭。不是接纳后必完成的实时承诺。

内部`adapter.manual(action,queueDeadline,{mode,requireBudget:true})`在改revision/desired/queue/许可前执行此评估，超出报job_budget_exceeded，保留旧会话/画面/队列；未启scheduling拒绝此选项。选项只在可信代码，不进入wire/IPC/插件/运行配置，也不向peer传新deadline。review默认requireBudget=false继续尽力执行并在原截止失败；正式策略/能力尚未协商，不能以默认路径宣称全部真实400已获时间准入。

在当前保守声明下短118原创样本可通过；241帧常用动作与大文件可能全部被严格模式拒绝，这是预算不足的结果，需要实测/策略决定后另审，不降低校验/自动加TTL。fits不代替独立全验/首帧；base_loop也不保证无限运行。

## 170段与独立截止

真实compact最大67号5569645B算170段、两遍11139290B，400-06当时只是条件算术。本片生成**原创**5564915B/241帧PET4（170段、非零XOR/extra/F/index/RGB正确），A2先完整验证入私有CAS，再由真实TLS/原actor逐段拉取；每段首4KiB处推进双时钟999ms。尚未凑齐170段/整文件全验就触及原120秒，actor failed/deadline，actual保持null；合法续租/单socket仍在，不可把有lease误作完成作业。该原创数据不是原角色或实际文件重编码。

strict选项会在任何命令/副作用前拒绝此计划；默认review路径则明确不能保证在该声明负载下完成。两条路径均不放宽deadline。旧small/large fixture原字节和metadata在新增denseAction模式后已逐字节对照保持，原actor/工作集不改，无第二窗口或base整文件保留。

## 退出、回退与下一入口

停自有pump→driver.close先失效并等source/exchange实际返回（忽略abort则等）→adapter.disable/close等HTTP/read/worker→caller关自有TLS/client/server/session/store→清临时根。新owner/连接不能抢占未退出slot，关闭可重复；无N/分区/缓存或现有服务配置迁移。

回退预算helper/临时host显式选项/driver及lab至400-05（精确原文件备份在忽略.cache），wire/旧尺寸/认证减量保持。原400-05关闭控制交换测试现接收被owner拒绝的终止结果，同时继续检查资源实际退出，没有放宽等待断言。

下一400-08先Spec/Diff做N_boot/V2元数据到候选P/M及独立用途的只读审阅。400-06外部固件/预取/6882证据本轮未重读；正式完整性/local自主/重复touch/能力/时间/凭据/TLS/G1-G2/24fps仍待共同签核和实测，不能从本片检查推导设备准入。
