# TCP23：显式有界hold-state合同

2026-11-06。默认仍event，不自动启用hold、不扩来源/控制许可，不代表真实pet→ESP闭环。参考[Spec](../context/plans/tcp23-spec.md)/[报告](../reports/2026-11-06-tcp23.md)。

后续[TCP25](native400-endpoint-arbitrated-hold.md)已明确选择端侧仲裁A，新增显式arbitration参数；下文priority=clear的限制仍适用默认observed-local/B。三期限与有限续租保持；同动作保位续租已由[TCP26](native400-preserving-renewal.md)在终端候选/管理端oracle采纳，实屏尚待，禁止据宿主结果开启真实自动hold。TCP24 B草案保留可选历史，不作为A前置。

## 可信来源与分开的期限

`createNative400PetHoldSource({base,clock?,sourceMs=60000})`接受既有规则的显式loopback pet公开URL，只GET/state。sourceMs范围1–120000ms，为本次只读观察代的有限期限，clock为可信单调毫秒。返回opaque source，只公开close；WeakMap上下文/采样收据不可由JSON、clone、页面缓存或counter自行重建。

每次成功完整HTTP响应/parse后登记收据，时间取**请求开始**，而非慢响应抵达时。跨controls await后重新验收据<=1500ms、未关闭/回退/来源代到期。成功HTTP表明服务应答活性，不保证任务语义刚更新；裸getState缓存不具此活性证明，当前hold不接受它。source owner负责close；bridge.close不关闭其他消费者的source。

shared envelope保持native400-shared-control/1，新增可选`limits={profile:'shared-limits/1',source_window_ms:0..120000}`，直接取真正lane.window.remaining_ms；顶层remaining_ms仍是当前页面凭据权限寿命。旧无limits envelope仍可被event解析；hold缺此能力拒绝，不猜窗口。bridge从查询开始计单调往返耗时，再从页面权限与lane来源窗口余量扣除；观察source余量直接取当前时间。

## 装配与算法

可信本地显式构造`createNative400PetBridge({enabled:true,mode:'hold-state',source,priority,client,expectedRevision})`，ttlMs在此模式必须5000，默认pollMs500。client仍须genuine来源/用途/窗口及shared授权，不是issuer；原event模式及其自定义TTL保持。

priority为同步可信本地状态提供者，返回clear/local/unknown；缺省unknown失败关闭。当前wire无完整触摸状态，不能声称从TCP已实现真实触摸探测。无真实可信provider时不得启用设备hold；fixture从原设备模型取得touch。原设备触摸优先不变，不新增STATE/EXIT或修改固件。

每次串行poll：

1. 取得新HTTP响应收据，核状态/counter；rollback或同counter不同语义封锁来源代。仅ready-null→0、thinking→1、working→11；其他语义/失联撤自己的remote目标并停止hold，不伪装为idle。
2. 查询原私有controls，核shared、同实例/组、expectedRevision和唯一自身command_id。首次不得接管已存在的他人desired；人工race由原CAS拒绝。
3. 来源收据仍新鲜、priority=clear、网络ready/open，且观察source、真正lane来源窗口、页面控制权限的**各自**剩余都>7500ms（5000新目标＋2500发送预算）。这是保守宿主准入算术，不是ESP/网络最坏时延实测。
4. 仍有自己同action有效目标，剩余>2000ms只读不发；0<剩余<=2000ms才提交新的5000ms BASE。新请求使用新request_id/seq与原CAS/ACK，不篡改旧deadline，不借重复确认续期。新counter的不同支持语义可在上述门禁内替换自己的有效目标。
5. 自己目标已过期即停hold，不凭旧counter复活；重新取得控制需可信显式重建。人工修改/未知本地优先态、暂停/掉线、撤权、来源代失效、预算不足、关闭或时钟回退均停止并尽力只撤自己目标。撤销失败按最后有限TTL收敛，不取消他人或自助续权。

unknown冻结新读/命令，只有显式confirm确认原完整body。成功后重新核原收据、所有权与预算；陈旧则撤自己已确认目标，不换TTL/request_id重发。若人工已更新则保人工目标。确认不自动恢复停止的timer，可信owner可在状态ready后start或驱动poll。页面重挂/GET不会调用source/续租，不改变原共享组生命周期。

## 验证与回退

`node scripts/verify-native400-pet-hold.mjs --output .cache/tcp23/results.json`覆盖24项正负例：fresh同counter、慢HTTP/控制查询延迟、已过期不复活、CAS race、unknown确认/陈旧/人工覆盖、权限/观察/lane三预算、时钟/代/关闭/暂停/本地触摸、HTTP503、缺limits与多页重挂。原event/TCP19–22回归保留。

有界真实观察：`node scripts/observe-native400-pet.mjs --base <已明确的公开loopback pet URL> --seconds 15 --output .cache/tcp23/observation.json`，上限30秒，间隔500ms，HTTP单次沿原2秒超时。输出仅过滤state/counter/本次相对时序；不猜端口、不发任务/写接口，不读账号，网络失联只记unavailable。最后一次读取可延至单次HTTP期限；不是无限等待工具。

回退close bridge/source，await活动read/IPC后释放自己fixture/临时socket；unknown保现场，有限TTL，不抢锁。mode省略回event，旧raw/DSH候选仍不自动启用。真实DSH动态接入沿TCP22已验基线，本轮只更新构建；真实pet迁移/运行版本映射、实际触摸provider与ESP自动保持仍分别待验。
