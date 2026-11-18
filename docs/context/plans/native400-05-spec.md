# 400-05 local4／最新base与播放调度 Spec（实现前）

2026-11-02。读AGENTS、README/current摘要/待办/规则、400-02/03/04 actor、观察投影/host/临时lab；保留已有修改、不用子智能体。仅原创源、私有临时store/PKI、虚拟双时钟和loopback TLS。不接设备/固件/真实媒体、生产listener/插件/DSH/pet/bridge配置或现有服务，无烧录/提交推送。

## 契约审查与范围决定

400-03 revision1已有touch.started/ended、base_target、accepted/deferred_local/ready、asset.verified及验证/显示关联；它足以表达**显式设备本地local4源＋远端顺序重读**。本片不从网络下载local4，不要求任意read-request，不改表/profile/golden或persistent=null。主机和模拟peer都通过可信代码选项显式开启scheduling review，缺省400-04路径不启调度；hello字节本身不宣称固件支持该策略/本地源，正式能力协商仍待W01–W10。

本地源必须调用方显式提供、与独立批准metadata对应、逐段读取并经同一个窗口actor全F/CRC/index/RGB/extra验证。不存在就拒绝触摸而不停止base，不自批库存/ROM/Flash。模块不监听真实触摸/pet或创建定时轮询/设备通道。

## 实施不变量

- 新纯core有界调度状态：至多一最新远端意图（target/control/mode/原始作业截止/终态）、一触摸周期。接受新revision才替换latest；取消清latest、迟到旧命令不得复活；once_hold已完成/失败/作业到期不可因touch回放。独立原始作业截止在touch等待/重新全验/loop/renew中不延长。
- touch请求立即fence旧帧token/解码工作、保最后有效front；**不取消可正常结束的单个TLS GET**，等待它实际结束再发touch.started/读local4，旧段数据按generation丢弃。避免原request owner abort后强制断TLS再假装同session可继续。超期/断线/撤销仍由原owner失败关闭，退出未结束不让新工作抢slot。
- local4用同一ring/3RGB/有界头/单32KiB段，不保base encoded/receipt副本；base恢复必须从0重新全验和重读。重复触摸不扩队列/重置期限。local任务用自己固定截止；remote cancel不打断已经开始的local4，但取消旧base；失效的session/lease则清两者，保历史front，fresh hello后不自动恢复旧意图。
- 触摸期间新remote命令只accepted/deferred_local，不改local actor；local结束先touch.ended，再对当前仍有效latest发unsolicited accepted/ready＋verifying，最后再全验/重读/独立提交。base_target仅诊断，不从peer事件反写host desired。对相同命令的明确touch恢复允许新的接纳周期，不能泛化为任意phase回退。host原Registry保同command已观察最高阶段，当前调度/实际画面以新投影为准，不放宽通用Registry。
- host暂停remote许可直到local结束且精确latest再次ready；清未用permit，GET成功退出后才推进旧cursor，再在touch协议点重置asset0。新manual/latest或取消不能在local运行时错误标成remote actual；必须靠新verified引用及软件提交切换。
- local4内容失败不造verified/playing，结束本触摸并在权威/原意图截止仍有效时恢复最新base；auth/时钟/IO期限未知则失败关闭，不猜测物理自主播放。cancel.io_exited只描述remote，不释放仍在执行的本地源/HTTP owner。close等实际源操作返回再清资源。
- 显式pump驱动：默认≤500ms poll机会（无后台timer），源/帧/状态转换每步有界；先尝试解码，缺完整帧才tick欠载，暂停elapsed/保front，足够min(24,remaining)重填再提交。loop只在末帧间隔＋本遍全验完成后重读，once_hold不重跑；118/117/4917ms、241/240/10042ms不补帧/赶帧。
- host自动合法renew优先于新素材段，仍走原queue/session/guard，不能延TTL或独立作业截止；接近horizon时须同时容纳ACK/交换余量，不足失败关闭，不发无预算permit。测试阈值是宿主假设，不作ESP/网络最坏值。单pending/一latest/一ordinary/有界flags保持；若取消需清未派发latest，仅新增可信queue discardLatest操作，不改旧wire允许kind。

## 实施与验证

复用原400窗口、strict wire/metadata pin、CAS reader/A4 lane/writer/证书/guard/A8只读根。新增pure arbiter与显式异步模拟driver，旧executor/host/projection/lab以code-only scheduling选项接入，缺省400-04不启。测试用实际TLS/全媒体actor，不用静态成功回执；本地read提供者可异步/忽略abort，独立request owner保持实际退出责任。

覆盖base播放/下载中touch、重复触摸、local full verify/首帧/正确tail、期间多次更新latest/退役ACK/取消、local失败/旧帧、loop与once_hold、欠载elapsed、双时钟/自动renew/截止、断线/暂停/撤销和新会话、source实际退出及默认模式回归。至少一>1MiB源；核logical ring/段/证据/outbox容量，不宣称硬RSS/ESP预算。

先专项再npm run check（仅语法）、npm test（含构建）、专用隔离监督CLI；新问题才扩大。记录真实通过数量、未覆盖、协议SHA、当前摘要/待办并归档被替代记录。所有固件/正式策略/N/Flash/TLS可信时间/凭据/G1-G2/24fps及真实用途批准仍待共同核定。

## 回退

关闭自有pump→fence executor/adapter→等HTTP/本地源操作/worker实际退出→关自有TLS/client/server/session/store→删自有临时根；忽略abort未退出就保留保护并等待，不假清理。撤销新arbiter/driver及显式选项变更（原字节已备份），保400-04默认路径。无外部配置/缓存/namespace/分区或旧合同迁移，不能用本片自动启设备窗口。

### 2026-11-03 负例审查补充（先于修复）

关闭投影必须无条件把actual标为historical，不能沿用“仅取消remote但local仍可继续”的cancel规则。调度模式以touch.started时已知verification高水位作本周期floor：local4新全验及非historical显示只可属于活跃touch且引用高于floor；触摸运行时remote非historical显示拒绝。结束/下一周期迟到包即使stream序列新、metadata和旧proof正确，也不得复活画面。不增wire字段；floor只是本session已验证证据的有界消费者状态。补相应负例/默认关闭回归。

## 本片状态（2026-11-03）

实现与验证已完成：35专项/独立临时监督CLI/check/含构建1126项通过，见[报告](../../reports/2026-11-03-native400-05.md)。此Spec保留实现前不变量；真实触摸、正式能力/策略、N/Flash与设备资源准入不在已完成范围，下一按当前待办共同G0/新鲜证据评审。
