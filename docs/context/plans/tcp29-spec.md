# TCP29 Spec：固定副本实际宿主启动与原能力IPC（先写后实施，已完成）

2026-11-06。沿TCP28完成真实子进程集成闭环，不重复import/运行器实现。固件只读，保位station仍2759f2e4…未部署、原f553/af5b最后确认；不接ESP/USB、现有服务/profile或真实pet。

## 授权与进程边界

现有Request/audit/controlAccess使用模块私有WeakMap，不能从JSON跨进程重建。采用能力留在父进程：可信父调用点已经通过原audit＋独立素材/用途/window决定创建genuine NodeControlWindow/原shared owner；同一模块实例从窗口取得只属于本次宿主的scoped client附件。新增内部窗口brand/单活run loan，拒绝克隆JSON、其他模块实例和附着者；只在显式start时取原authorize，不生成素材/窗口批准或自助延其期限。

子进程没有Request、bearer或approve入口。固定bootstrap为原TCP28运行器构造仅转发GET controls、POST command(base/cancel)的父IPC proxy，父以原scoped client发送原UDS；原seq/CAS/权限/TTL仍由原channel检查，不另建控制层。消息闭合、有界、单在途，abort映射原请求signal；启动实例绑定消息，迟到回执丢弃。API不接受JSON client/config/prepare结果来赋权，不向网页开放。

## 固定代码与真实运行

复用genuine execution snapshot租约和既有Node加载审计bootstrap/收据校验，不复制第二套loader。固定child bootstrap从快照执行，复用原node-load-child注册的hash/inventory hooks导入固定manager entry=native400-pet-hold-run。实际调用createNative400PetHoldRun/start，并记录同一次进程的pid匹配、启动instance、Node二进制/快照/实际导入收据、constructed/start状态及退出资源。constructor/start不只export存在。

start单次，父前后verify snapshot，租约覆盖child+stdio+原RPC实际退出。每次新私有HOME/TMP，不读现有账号/runtime；源URL只走自有IPC，不进证据/命令行。原45秒/52.5秒余量/三期限/unknown原body及late BASE栅栏保持，实际run时钟为子进程单调墙钟，不靠虚拟时间加速装成熟壁钟通过。

## 生命周期

父start/abort/close/外部失联仅fence自身通道；BASE停止后仍允许原GET/cancel清自身目标。子进程IPC断线或SIGTERM立即close run；父保启动/运行/退出独立deadline，超期只TERM/KILL自己PID/进程组，标unknown，不按端口杀服务。强制退出/原请求未知不猜cancel，不撤人工；原有限TTL收敛。snapshot/loan不在实际I/O退出前释放，cleanup失败明确unknown，不删外部runtime。

宿主只释放自己的grant附件，不end共享组、不关闭借用窗口或audit；它们由原所有者最后关闭。manual/unknown确认/重复启动/中途abort与父退出的行为须实际测。ready表示已构造并start本机run，非设备首帧；done只报告本child/资源，不等同ESP退出/恢复。

## 验证与验收

真正固定副本child＋原创HTTP＋genuine父owner/scoped UDS＋真实loopback保位端侧模型；至少一段真实墙钟跨两个5秒租期、touch中thinking→working及EOF最新11、到期完整退出。其余用短真实窗口覆盖错误pins、错模块实例/伪JSON/无能力、重复start、abort/start半途、unknown与人工目标保留、父退出、卡住child的bounded unknown。保留TCP28/26回归，清child/stdio/timer/socket/lease/自有HOME。

check/test/两候选build、实际运行证据与源码/候选SHA、上下文替代归档。临时loopback/model与真实进程/IPC/socket、DSH/pet/ESP分层；真实加载pet/自然迁移、fresh现场批准/app/peer/动态资源/实屏/设备退出恢复仍待。回退关闭本host后原borrowed window继续可用，不使用新API即原路径；无wire/存储/现有服务迁移。

完成证据：[TCP29报告](../../reports/2026-11-06-tcp29.md)，16专项/1956全量、check和两构建通过；固定副本和构建候选均已真正construct/start/原授权IPC-TCP/退出，不是import-only。现场DSH/pet/ESP未验。
