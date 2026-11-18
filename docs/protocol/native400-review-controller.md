# 400-13 内部操作控制器与同步授权检查

2026-11-03。[Spec](../context/plans/native400-13-spec.md)/[Diff](../context/plans/native400-13-diff.md)、[报告](../reports/2026-11-03-native400-13.md)、[原创证据](vectors/native400-13-controls-v1.json)。复用400-09 owner/journal和[400-12选择](native400-source-selection.md)，不另建reader/存储事务。新代码MIT；本页记录400-13内部API；[400-14](native400-interactive-host.md)已在显式临时profile/私有IPC/受信proxy/UI装配，默认服务与apply不启用。400-15已补共享UI真实浏览器与provider静态评审，真实DSH身份/native picker仍待接入。

## 创建和可信输入

`createNative400ReviewController({directory,create=false,package,catalog,approval,mappingApproval,serviceInstanceId,clock?,sessionMs=300000,jobMs=30000,sequenceFloor='0',timers?,beforeRead?,beforeCheck?,fault?})`同步创建并独占原owner。两份独立批准和package/catalog由可信调用者提供，校验/快照后固定inputs SHA；不能注入任意owner或从账本自授权。serviceInstanceId为调用者绑定的当前宿主实例，controller本身不做UDS选主，未来service必须仅赢家创建。

单调clock与timer源是可信运行层依赖，默认performance.now/setTimeout。sessionMs 1–300000、jobMs 1–30000；sequenceFloor为新会话请求拒绝下限（uint64字符串、缺省0），不是跨进程恢复或持久去重。beforeRead/beforeCheck/fault仅内部测试注入，不是页面输入。坏/反向/异步clock失败关闭，不接收网页时间或网络时间校正。

控制器自己拥有owner和全部选择/任务/timer；实际fd/read、metadata capture和CAS仍使用原实现。容量为1审阅会话、1选择（含捕获）、1在途任务、1最近终态、1最近受理ACK，无任务队列/历史ID集合。接口同步部分防重入；异步选择不持锁跨await，撤销/关闭可进入并失效旧结果。

## API

| 方法 | 当前实现 |
| --- | --- |
| `authorize()` | 可信宿主显式发放唯一opaque handle、reviewer_session_id、递增generation；现有活动会话冲突，先撤旧且等在途退出才可重新发放 |
| `choose(handle,{file,expectedRevision,sourceName?,minimumSequence?,lifetimeMs?})` | 可信内部显式路径选择，Promise等待原metadata短fd退出；返回仅私有channel可持有的selection_id/selection_seq/next_request_seq/批准输入摘要及安全名，非全局status |
| `start(handle,request)` | 同步受理ACK；保留任务/seq并消费选择后调用原owner，后台完整读/校验/提交；受理≠完成/current |
| `cancel(handle,request)` | 同步核实例/会话/job后定向取消；重复当前取消幂等，最近旧终态返回无操作，过旧/未知/跨scope拒绝 |
| `revokeSession(handle)` | 可信宿主撤授权，使未用选择失效并取消该会话在途任务，不停止其他共享服务 |
| `status(handle)` | 已授权审阅会话的安全控制状态；无凭证或路径 |
| `snapshot()` | 可信宿主内部诊断白名单，不发授权；可显示已撤销/关闭/unknown与仍未退出的任务 |
| `sourceSnapshot()` | 原来源审阅展示，保持sourceReview/1，不是控制权限或设备库存 |
| `tick()` | 受控clock/timer的显式期限收敛；真实默认timer亦会触发；状态轮询不延期限 |
| `idle()` / `close()` | 等真实capture/内容hook/fd退出；close幂等、返回前同步fence，清自有timer/选择/owner |
| `resources()` | 有界数量、实际open_files/busy/unknown，非RSS或硬退出预算 |

opaque handle不可JSON恢复，知道reviewer_session_id不授权限。跨控制器/新实例不能复用旧handle或选择。新授权清前会话ACK/终态；原source历史保持。HTTP断连/只读页面卸载未接入这些方法，不自动撤销共享任务；未来可信控制adapter销毁则须显式revoke/close。

选择输入在异步capture前快照，不允许原对象后改路径/revision/期限。控制器选择许可的60秒上限从开始capture计时（包括metadata耗时，采用保守截止），不比原selector就绪后TTL放宽；初始metadata若耗尽许可就不发选择引用。低层selector仍沿400-12的TTL语义。过期引用不自动重选/读源；已受理任务不因选择TTL经过中断，但仍受会话/任务截止和撤销。choose不执行内容校验或改用途批准。

## 请求、ACK与去重

start闭合body字段：`protocol,service_instance_id,reviewer_session_id,selection_id,request_seq,request_id,expected_revision,kind`；protocol固定native400-source-review-controls/1，kind只review/revalidate，随机ID为64小写hex，seq/revision规范uint64字符串，正文沿4KiB上限。拒绝path/file/fd/approval/策略/未知字段；sourceName/floor/timeout来源于可信选择/策略，不由start覆写。

验证顺序：真实handle/当前实例/会话→闭合schema/规范摘要→最近同seq去重→新seq/容量/unknown/选择检查→同步预留job/高水位/ACK并消费选择→启动实际owner。相同seq和完整body返回同ACK，选择已消费、正在busy或任务已失败/unknown也不重跑；同seq异body冲突，较旧/跳seq拒绝，耗尽不回绕。最近ACK覆盖后旧请求仍由高水位拒绝。

预受理拒绝不消费请求seq；受理后的真实CAS/源/授权失败仍消费，不能退回seq或恢复选择。owner负责权威journal读验/CAS；控制器的选择revision/内存snapshot不冒充跨进程原子盘视图。ACK只含accepted/job_id/request_seq，不是校验、设备受理或持久成功。任务结果另看active_job/last_job及原sourceSnapshot。

响应丢失只可同实例、同seq、同body重取ACK/查结果，不能换request_id盲重试。实例重启无旧ACK/选择恢复，新权限下先核历史；不提供跨重启exactly-once。grant和会话handle只存运行层内存，不进DOM/URL/全局status、journal或Git。

cancel闭合body为`protocol,service_instance_id,reviewer_session_id,job_id`，仍须真实handle。校验和原owner.cancel在同一同步栈无await；job_id单独不授权。旧终态job取消不会触碰当前新job；最近终态已替换后旧job拒绝。取消ACK的io_exited=false明确只是请求，直到原Promise/fd/hook退出才释放容量和选择保护。

## 时钟、同步gate及退出

新owner每任务可选`authorizationGate`严格同步Boolean。它参与任务准入、读后、原journal valid及发布检查，缺省不传保持旧语义。false为review_authorization_denied；异常/Promise/非Boolean/回调重入cancel/close/new review为review_authorization_invalid，失败关闭，不执行回调中的修改。完整源码/磁盘事务不是由gate重复实现。

controller gate直接核当前job/会话generation、撤销、单调clock与会话/任务截止。timer只唤醒取消，不代替同步write/fsync之后、rename之前再次读clock；没有投机续期。旧timer回调先核自身timer身份与对应会话/job，不能抹掉或取消新timer/任务。

操作期限与底层reader墙钟安全超时分开：controller用注入clock/timer核整个任务jobMs；reader仍有固定30秒墙钟安全上限。默认时钟下controller timer会按更短jobMs取消，同步gate也拒绝超期提交；虚拟clock测试不应把10毫秒逻辑截止误当真实28MiB读取只许10毫秒。未知I/O/event loop/同步fsync不可硬抢占，没有硬退出上界，也不改变400-07设备预算/TTL。

rename前失效保旧档；进入非抢占提交后跨截止可以留下新历史，最后gate拒绝current，不能说已回滚。rename后unknown优先于期限/取消/选择撤销，源view=uncertain、任务outcome_unknown，禁止新操作/授权直到可信close/reopen。相同已受理请求只重给ACK，不能据其accepted=true隐藏unknown。

撤销/close会同步abort对应任务并调用原cancel，等待钩子实际退出；cancelling/busy期间新任务/会话接管拒绝。metadata capture也受相同退出所有权，失败/取消结果由choose Promise和安全状态呈现，close不把正常取消当清理失败。已提交journal和源文件保留，unknown/坏档/残锁不自动删除/修复。

## 允许字段与验收边界

`publicNative400ControlsView`为无Node/DOM的独立白名单重建：phase、非秘密实例/审阅者ID与generation、请求高水位/选择seq、剩余时长/安全来源名/批准输入摘要、单active_job/最近last_job及枚举错误，device_evidence=false。选择引用/指纹/路径、handle、原批准正文、ACK缓存不暴露；错误不带cause私有内容。sourceReview/1和设备wire不扩控制字段。诊断只读view本身不授权限。

本片验证CTL内部请求/取消/期限/资源与旧持久边界；后续[400-14](native400-interactive-host.md)已验私有IPC/精确Origin/临时页面provider/共享UI与JS hook宿主。不能把内部handle或临时cookie等同真实浏览器/DSH用户身份，native picker仍未接。旧400-10 profile只读，无新CLI参数、生产listener或设备指令。

复现：`node scripts/verify-native400-13.mjs --output .cache/native400-13/results.json`，仅原创MIT临时fixture/受控timer/虚拟clock/实际source与CAS，无真实媒体/固件/现有服务。回退先撤会话并close等实际退出，保source/journal，可回400-12内部owner/400-10只读，无格式/配置迁移。400-14临时交互候选已离线完成，400-15已完成该评审与共享UI真实DOM验证，下一400-16可信本地broker交接先离线；真实用途/G0/设备库存/Flash writer/proof/TLS时间凭据/G1-G2/24fps仍独立，外部继续400-06快照。
