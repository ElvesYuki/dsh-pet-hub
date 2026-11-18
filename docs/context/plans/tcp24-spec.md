# TCP24 Spec：触摸优先态对接与离线provider（实施前）

2026-11-06。只读核TCP23及终端control_bridge/transport，后者确有touch优先和EOF，但当前只传ACK/remote Presented。无子智能体，不改终端/设备/现有服务，不重复DSH适配。

方案A：继续host续租，完全靠端侧仲裁保护本地；touch期间BASE deferred，结束可回最新有效base。能满足画面不被抢，但改变TCP23停止hold/等待重新接管的语义，不能只写死priority=clear。因此本轮不选择A作为默认；可另行获得产品决定后审议。

方案B：保留停止策略，提出opt-in ptc1-priority-poll/1。HELLO原56B增加8B能力尾部（schema1/snapshot32B/max2Hz/reserved0），旧56B仅旧模式/priority unknown，不在旧连接探新type。QUERY type5空body共用原单在途/seq；SNAPSHOT type131 body32B，header.session/seq绑定查询，body带schema/mode/boot/local_epoch/revision及保留位。start/end/failure由端侧串行仲裁产生；local_epoch每次接纳touch增加，revision每次本地优先状态转换增加，饱和失败关闭不回绕。不是首帧/playing或认证。

本轮只实现纯payload codec、固定向量及无I/O provider，不接现有TCP parser/owner或启生产能力。provider绑定显式boot/session/connection对象，查询序号递增/单pending，250ms候选查询期限、1000ms候选快照年龄、500ms最小查询间隔。期限是待端侧资源确认参数，不称物理最坏上界。旧/错会话/重复/乱序不续新鲜度；当前连接坏数据、rollback、超时/断链unknown。首次有效clear快照才可clear；出现local/fault或任意priority revision/epoch变化则sticky停用，即使两次clear之间丢了完整周期也不自动恢复。新连接先unknown、新provider及新bridge由可信操作者重新取得控制，不能复活旧hold。

竞态：clear快照后与BASE之间仍可touch，网络不能撤已在途消息；端侧原仲裁必须始终优先，host最迟下一快照/查询期限收敛并尽力撤自身目标。不能承诺物理touch瞬间零在途BASE。本轮模型验证A/B行为差异、快照失序/重放/旧boot/重连、touch/续租与过期；保持event/hold/三期限/CAS/unknown不变。

真实来源：本轮优先明确运行证明最小方案，不再次靠磁盘SHA认定加载版本。公开/state缺加载身份则需实际运行宿主所有者提供加载时常量/loader记录绑定host实例/插件注册代；不读取凭据、进程内存或改现有进程。自然观察最多一次10秒，只GET过滤state/counter；无迁移如实待验，不造任务、不改pet。

验收：offline payload/provider与genuine临时IPC/TCP模型测试；必要check/test及两候选build；标准wire/owner保持不变。资源合同含静态状态/单query/带宽，端侧实际RAM/栈/关闭由终端另验。回退不装配provider保持unknown；profile省略维持旧模式，停止自有fixture/bridge，清临时目录。终端实现/联合字节对拍/真机均待，报告分层更新上下文并归档旧缺口。

评审补充：新网络priority profile须使用既有shared autoRecover:false，避免重连快照前恢复旧hold；不改变旧配置/owner。实施状态：离线payload/provider与17专项已完成，check/1865全量及候选构建证据见报告；正式transport/终端/C++对拍待联合实现。
