# G0-R7 gate失联／暂停恢复一致性 Spec（实现前）

2026-11-02。已读AGENTS、README/当前上下文、开发/维护规则及R6 executor/A1 gate/Flash、R4/R5 session与资源边界。保留并行素材修改，不使用子智能体。不读固件/真实素材/运行配置，不接设备/生产listener，不烧录/安装插件/提交推送；只用原创PET4、私有CAS/绑定根/PKI、loopback TLS及双虚拟时钟。

## 根因与选择

R6 clear丢弃operation/work，而actor在gate后取消只停止播放、仍持有commit。失联导致完成能力丢失，下一beginSession只能commit_in_progress。R7复用既有actor/Flash，给显式新wire executor增加最多一个本地提交任务，捕获原context/control/target/operation/opaque work；不改A1核心、磁盘/namespace/协议合同，也不重写session/guard/root存储。

**gate仅授权一次本地收尾，不授予新网络控制或播放权限。** 已完整写完payload且通过原guard时才能取得不透明完成token。断线、lease过期、暂停或可信单调时钟失败，立即fence volatile/outbox/context/frame，但保留该任务及actor claim。新会话/新控制/新payload在任务未实际退出时拒绝。未进gate的staging沿原actor.cancel取消，不产生新root。

## 实施契约

1. 新wire gateSave返回本地opaque completion token；clone/伪造/旧任务token拒绝，不出wire/IPC。正常commitSave仍同步并沿R6报告行为；已失效任务仅finishCommit(token)完成，诊断结果不进入outbox，不补saved、不激活旧画面。终态保留一个只读结果槽，后续新gate替代它，重复完成不再写Flash；unknown禁止重试commit。
2. 提交中发生失效必须只fence协议状态，不能重入busy actor.cancel/close。同步actor.commit真正返回后才取消旧播放/释放任务；新open/setControl/request/reboot/恢复在运行中或pending时拒绝，不强清gate或释放medium claim。
3. 保存失败沿原A1分类：确证header/payload等失败→failed；marker尝试/读回不确定→outcome_unknown。unknown本地完成结果只能显式recoverCommit(token)重扫模型完整根；I/O失败保持unknown并可再读恢复，不能再写commit或降A8 floor。新会话只靠新库存对账，不回放旧终态。
4. 增显式suspend/resume/expire注入入口，仅新wire模式；暂停清当前协议会话，resume不恢复context/lease/outbox/目标。新hello/库存/acquire仍必需。gate任务的本地完成不依赖失效lease，但其来源门禁必须此前有效；过期前未gate不能新启动保存。
5. 等待预算仅诊断/准入，缺省4000ms（1..30000受信选项），不是设备硬时限。到期仍保留任务/claim，不能因timer结束就开新session；允许持原token本地完成已授权提交，结果不发旧会话。不延lease/ACK/TTL。单调时间异常不能制造新的权限。
6. close先fence。pending未运行gate在close时由同owner完成一次已授权收尾；若正在同步commit中重入close，返回等待Promise，直到实际actor调用退出才释放claim。重复close幂等，无新网络操作；旧默认executor close/语义保留。测试以Memory medium同步故障钩子在真实commit调用栈内注入断线/暂停/close/新session竞争，不称异步硬件I/O或物理Flash时限已验。

## 测试与资源

复用R6真实TLS/A2/A8 lab，增加beforeClose可信清理钩子，确保executor完成先于临时根删除；旧fixture默认保持。资源最多一pending/一终态结果、outbox16，无后台轮询/重连。actor/medium不换owner直到实际完成，旧context回执仍经现有ledger/A3/guard拒绝，不放宽宿主解析。

30专项：gate前后断线、完整本地完成/新库存、pre-gate取消、lease过期前后/renew边界、暂停与新控制、等待超期不放槽、旧token/重复完成、header/marker/读回失败和恢复I/O、迟到saved/playing拒绝、旧帧不复活、新会话竞争、实际commit中失效/close/reboot竞争、owner重建与A8 floor、旧A6/R6兼容与关闭清理。独立临时环境监督CLI正常/SIGTERM，npm run check（仅.mjs语法）及npm test（含构建）；不以loopback/模型样本当固件最坏上界。

更新当前摘要/交接/待办与历史，替代R6的gate失联未实现记录，保留真实G0共同签核/素材批准/固件G1/G2及设备窗口限制。

## 回退

关闭自有TLS/adapter，待HTTP和已授权本地commit实际退出后释放A2/medium、删除自有根；撤回新wire executor任务/注入方法及fixture扩展。无协议/格式/TTL迁移、生产入口或外部服务变化。同步设备模型不能证明物理电源中断/异步Flash取消清理上界；这些仍须固件独立验证，不清外部锁或恢复设备现场。

## 实施状态

2026-11-02已按本Spec实施于显式新wire模拟executor与测试fixture；30专项、check和全套940/940通过，独立监督正常/取消清理通过。[报告](../../reports/2026-11-02-round-pet-g0-r7.md)记录源码身份、故障分类及未覆盖边界；[旧缺口归档](../history/round-pet-g0-r7-evolution.md)。没有设备或生产准入；下一共同G0、真实素材许可及固件G1/G2证据核定。
