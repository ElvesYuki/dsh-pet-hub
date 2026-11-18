# TCP-14：子进程consumer与LAN服务退出屏障

2026-11-05。[Spec](../context/plans/tcp14-spec.md)/[Diff](../context/plans/tcp14-diff.md)/[报告](../reports/2026-11-05-tcp14.md)。入口默认关闭，仅可信本地调用；本轮真实进程均为原创Node fixture，未运行终端Python/串口工具或设备。

TCP17范围收敛：[纯Node控制窗口](native400-node-control-window.md)为后续管理端启动方向，不要求Python。本文已有USB进程/通用快照或加载审计保留为显式可选开发能力；涉及Python/serial环境的历史下一入口不再是管理端默认前置，只有选择该外部工具时才单独核定。

后续[TCP15显式代码快照](native400-execution-snapshot.md)提供可选副本consumer和运行lease；本页原接口保留，完整动态/解释器依赖仍另核。

## 显式进程适配器

`createNative400UsbProcessConsumer({enabled=false,executable,script,scriptSha256,port,holdSeconds=0,graceMs=1000})` 返回TCP13 consumer。enabled必须true、POSIX平台；executable/script为规范绝对路径，port为明确/dev/路径（不探测是否存在），holdSeconds为0–120，graceMs为10–5000。构造不读文件/开端口/启动子进程。

run前核config文件为current-user普通私有单链接、canonical路径、1–16384B；不读/hash其正文。script以O_NOFOLLOW/O_NONBLOCK打开，current-user普通单链接/无组其他写、≤256KiB，固定size+1读取核独立SHA和fd/path前后指纹。只pin入口文件，**不冻结解释器、serial库或全部导入闭包，也不抵抗恶意同用户换盘**。真实窗口必须另封存实际执行闭包，不能从前后两摘要猜加载版本。

固定argv为script/--config/file/--apply/--port/port/--hold-seconds/N，shell=false、stdin忽略、stdout/stderr受控pipe、独立POSIX进程组。环境仅固定PATH/LANG及PYTHONNOUSERSITE/PYTHONDONTWRITEBYTECODE，不继承PYTHONPATH/NODE_OPTIONS等注入项。没有shell命令字符串/凭据argv、扫描或自动重试；未来调用现工具仍可能因USB open/close复位，不能保证RAM配置跨串口生命周期保存。

run至多一次；close-before-run禁止后来spawn，预aborted不spawn。close/abort发送一次SIGTERM，宽限后SIGKILL自有组，直到child的**close事件**（直接子进程及stdio退出）才resolve；不以exit事件或kill返回替代。清timer/外部signal监听。该观察不证明脱管后代或设备STA退出，脚本必须不派生脱管任务。发送信号不等设备stop命令，本模块不另开串口查询cleanup。

## 输出转换与证据等级

严格UTF-8/JSON、重复键和额外字段拒绝，stdout总128KiB/行2KiB，stderr16KiB只计数丢弃；非法输出/超限即取消进程，不记录正文/路径/错误异常。接受现工具三类消息：

| 消息 | 校验/处理 |
| --- | --- |
| queued-not-connected-or-presented | 仅result字段，最多一次，记录queued_seen历史 |
| status | result/phase/cleanup_complete闭合，queued之后、phase整数0–6、clean为bool；不输出设备原始状态 |
| failed-or-unconfirmed | result/automatic_retry=false/可选有界reason，转安全失败并停止，不保reason正文 |

只有child最终exit0、完整合法输出、见queued且未取消/失败才run返回queued；其余返回unknown，不自动再run。bad输入/入口SHA/缺exe也是安全unknown。stdout/stderr异常及consumer错误不会带凭据内容进入公共异常或snapshot。

snapshot仅started/exited/closed/queued_seen/protocol_valid/outcome/稳定error和device_evidence=false/device_cleanup=unknown。queued_seen是工具历史报告，不等LAN/TCP OPEN/ACK/PRESENTED或持续显示；早期queued后最终失败仍可保queued_seen=true而outcome=unknown。resources只child_running/streams_open/timers，未给PID/命令/路径或凭据。

## 单session owner与服务屏障

TCP13内部claimNative400PrivateConfigSession只领取真实task一次，捕获原ready/close/resources/snapshot。公开方法替换不能伪造归零；这是所有权移交，不是素材/网络授权。新createNative400ConfigOwner单活/一个pending：受控同步factory先登记reservation，再创建真实task；fence期间待注册任务也会被取消并等待。普通失败但资源已归零可回收容量，cleanup_unknown保持拥有，不自动retryCleanup/run。

只有startOrAttach的LAN **UDS赢家**创建此owner并返回本地lanConfig：

| 方法 | 语义 |
| --- | --- |
| adopt(task) | 可信调用方显式移交已有TCP13真实task；必须在service关闭前，失败仍由原调用方负责，不擅关未领取任务 |
| startReviewed(options) | service预登记后用TCP12真request/自身lanOwner构造TCP13；只允许request/wifi/directory/consumer/signal/timeoutMs/beforeConsume/fault，禁止换owner/config/guard |
| resources() | 仅本地fenced/sessions/pending；不进入IPC |

adopt适用于已有本地生命周期接线和离线组件验证，不证明材料/真实LAN准入。实际高层路径优先startReviewed，避免先启动再移交的所有权空档。内部factory必须同步返回真实TCP13 task，不得创建未报告的异步资源后抛错；产品入口只调用受控构造器。

服务close先同步fence TCP与配置owner，随后等待两者实际退出/FD、文件、锁、timer与consumer完成，再删descriptor/关UDS。未完成保持UDS和503；失败同样保留，**不能给另一个app抢占**。显式session.retryCleanup修复后才手动再close服务，不自动重发。附着者没有lanConfig句柄，close不影响赢家。默认非LAN模式lanConfig=null，IPC无新写路由/slot，deviceTransport仍false。

## 本轮验证与剩余

28专项使用原创Node child、真实临时文件/fd/进程/stdio与UDS，覆盖坏输出/单次run/入口pin、TERM/强制终止、主进程exit但继承stdio未关、pending登记竞态、公开方法篡改、附着无权、服务持UDS到实际退出、cleanup_unknown保UDS及明确手动恢复。部分业务结果来自fake consumer，只验证该组件退出契约。新高层startReviewed仍仅拒绝边界，真实LAN成功分支未执行。

终端最新独立窗口已验证USB Ready/Queued/关联/DHCP/停止清理，但旧peer不符未OPEN；第二窗PMU读取失败后恢复f553。该职责合同已明确完整78 raw index由可信本地提供者pin、现固件不独立compiled pin。本轮未重跑这些设备/固件验证，不把上游有限样本当业务RAM/最坏延迟/400@24通过。

终端收尾最新只读复核：PMU只读诊断/最多3次有界重试与严格启动采集适配已完成宿主/构建，default20f4af21…、statione2a66c0c…均未上板，设备仍f553。尚无真实esp_err/故障恢复/物理根因证据，不能把候选通过写成设备已修复；下一先验证实际启动，再进行TCP业务窗口。

下一先验证端侧PMU新候选实际启动；恢复后实屏/触摸已确认，再冻结当前管理端与Python执行闭包、绑定当次精确peer和显式独立用途/窗口记录，准备授权TCP业务短窗。本模块不提升白名单、不续TTL或重发未知配置。真实Python/串口运行、当前复合高层LAN路径和设备ACK/PRESENTED/取消/业务资源仍待。

回退fence并await session/consumer/TCP实际退出；unknown保私有锁/UDS检查，明确cleanup后手动close，不强抢。host进程关闭不替代设备stop/STA cleanup_complete或固件恢复，设备任务负责精确f553/缓存分区保护。无生产profile/服务迁移，省略新API保持旧默认；STATE/媒体流/保存/V3后置。
