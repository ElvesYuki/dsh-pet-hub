# 绑定权威、hello和会话失效

2026-10-30。本仓库临时存储/虚拟时钟/真实Node loopback TLS路径已实现；正式服务仍deviceTransport=false。依据[先行Spec](../context/plans/session-consistency-spec.md)/[Diff](../context/plans/session-consistency-diff.md)，结果见[报告](../reports/2026-10-30-session-consistency.md)。没有真实配对、密钥存储或ESP协议接入；后续macOS原生源已有注册/退出验证，物理电源周期仍未验。

## 唯一元数据来源

`openBindingStore({directory,create=false,fault?})`必须使用显式私有目录；无默认运行目录或旧配置迁移。bindings.json为hub-bindings/1封套，包含严格content schema和规范JSON的SHA256；摘要用于损坏检测，不是抵御本机文件所有者改写的签名。

content={schemaVersion:1,revision:uint64-string,bindings:{device_id:record}}，最多64设备/131072文件字节。record包含device_id/binding_id/binding_epoch/controller_id/identity_ref/credential_epoch/certificate_sha256/state/mapping；state目前只有bound及pending_revocation，后者要求operation_id。证书指纹不可跨设备复用，身份字段不可通过普通commit修改。没有证书正文/私钥/网络/端口字段；identity_ref是引用，尚未接Keychain。

Registry.read/commit与TLS.lookupByFingerprint都使用此文件；Registry的普通commit仅允许mapping编辑，register、revoke、rotate是受信控制面入口。实际会话装配通过协调器执行撤销/轮换，不能绕过失效流程直接修改存储。旧MemoryStore模拟入口保持参考用途，不是第二份生产白名单。

不在scope内的read每次重新读取并验证私有权限、O_NOFOLLOW文件类型/长度、版本/字段/摘要；锁存在则拒绝。当前[同步revision视图](verification-reduction.md)只在单次受信同步调用内复用首次完整验证结果，新请求/每4KiB块前重新读盘；无跨请求快路，scope内跨进程变化下一scope发现，不能当事务。缺失只有显式create才初始化，坏档、dangling symlink或遗留锁仍fail closed。提交仍用wx短期写锁、锁内读当前revision做CAS，临时文件fsync→rename→目录fsync；成功后推进revision。锁不能替代hub选主、设备fencing或物理掉电测试。

| 情况 | 语义 |
| --- | --- |
| 预期revision陈旧 | revision_conflict，协调器尚不冻结/断线 |
| 冻结后、rename前失败 | storage_failed，磁盘保持旧值，当前进程继续拒绝该设备；不能报撤销成功 |
| rename后返回失败 | storage_commit_unknown，整个存储准入冻结，不自动重试/解冻 |
| 重开看到相同pending operation | 可明确确认该宿主记录已经存在，继续拒绝旧凭据；不是设备撤销确认 |
| SIGKILL留下写锁 | binding_store_locked，不自动删锁；仅测试父进程证明自有子进程已退出后清其临时锁 |

撤销冻结→清挑战/在途/会话→持久pending_revocation并提升credential_epoch。重复已确认operation幂等；commit_unknown原实例不靠重试伪造成功。写前崩溃的未确认请求不承诺跨重启已撤销；已提交pending记录重开仍拒绝。没有伪造设备确认，也没有永久解绑/遗忘API。轮换先冻结和失效，持久新指纹/递增credential_epoch成功后才解冻；失败保守冻结。

## 统一会话所有者

`createSessionRuntime({store,rootDER,clock,now,manifest,policy,controller_id})`创建auth/Registry/guard，独立用法生成随机service_instance_id；后续review服务装配传入持锁instanceId，不保存或复用旧实例ID。它不创建listener，也不关闭调用方拥有的store。公开registry/guard/auth仅供受信装配/诊断，不应直接映射到UI/IPC。

每设备一个有效会话。失效先从当前有效集合删除并推进本地generation，再取消对应挑战/任务，失效guard、Registry与auth/socket。Registry新增invalidate(context)不要求bound，且完整匹配当前boot/session；旧close与旧任务不能清新会话。失效历史观测直接读Registry内存，不依赖已经坏掉/被锁的磁盘，从而不会因元数据不可读打断安全清理。

Registry普通操作及controlled摘要同时检查当前绑定身份/epoch/准入。verifyPeer还收到完整hello，防止peer proof批准一个boot/session、Registry却连接另一个。原disconnect和同钟/双时钟模型接口保持兼容。

失效保留当前记录最后actual；新hello仍把当前actual置未知。协调器另给last_observed={action_id,context,current:false}作为上次断线前历史，不能当新会话确认；此历史只在内存，不声称进程重启后持久恢复设备播放状态。

## 两步hello与重连

双方先完成既有mTLS。在同一个真实socket上用原测试白名单POST /hub-device/v1/hello：

```text
device → {protocol:hub-device/1,type:hello.begin,boot_id,capabilities}
hub    → {protocol:hub-device/1,type:hello.challenge,challenge_id,context}
device → {protocol:hub-device/1,type:hello.confirm,challenge_id,context}
hub    → {protocol:hub-device/1,type:hello.ready,context}
```

完整context的device/binding来自真实peer→元数据，controller/service来自本地owner，session_id及challenge_id各为独立256位随机值；boot/capabilities是已批准peer声明、经过schema验证，不证明物理启动或硬件能力。hello最大4096B，不允许client自选device/session。回显挑战证明当前TLS通道上的关联，不是新增私钥签名认证协议。

最多32个pending、每设备一个，单调5秒有效。重复pending begin仅返回原挑战，不延长期限；confirm必须同socket、同凭据记录、同generation及完整context，一次消费。成功confirm的同会话重放只返回原ready，不重建Registry或租约。错误连接/过期/旧实例/篡改context/期间轮换均拒绝。每次连接close清对应挑战/会话；重连必须新TLS/hello，再显式acquire，不能接续旧lease或旧命令。

后续[服务/电源/容量切片](service-power-capacity.md)以同socket/context/generation的一次性opaque admission接入managed owner，不再累计全部历史session；320次真实重连回收通过，auth活动上限16保持。旧直接context入口仍保留256限制。owner已在UDS选主后的review路径装配，默认不启用，没有实物设备端fencing或满载容量结论。

## 在途工作、休眠与恢复

beginLease/accept/expect每次核对当前socket、完整context、generation及权威准入。track创建不可序列化ticket和AbortSignal，每会话最多8个，期限1–30000主机毫秒；complete再验证票据/当前会话/代数/未取消/未过期，才交Registry校验目标revision和报告。失败/完成释放票据；invalidate统一abort。expire、后续begin/track负责有界过期清理，无新增后台定时器。

suspend是显式注入事件：立即停止新hello/命令，清挑战、失效所有会话/租约、abort任务并关socket；不写绑定状态。resume需要可信wall毫秒及不回退的host单调时间，恢复准入后仍必须新TLS+hello+acquire。host时钟不前进也不能继续使用休眠前的proof。观察到负值/无效或回退的单调时间时自动进入suspended；不检测未被通知的停钟或任意速率漂移。后续macOS IOKit观察源已有真实注册/退出证据；物理睡眠周期、Electron/其他OS、可信时间来源与漂移检测仍待验，不用Date.now差值冒充可靠休眠检测。

## 验证、隔离与回退

`node scripts/verify-session-consistency.mjs --output .cache/session-consistency/results.json`监督独立POSIX测试进程组，临时PKI、存储、loopback端口全部私有；最多30秒，输出只含去敏用例和清理状态。与旧loopback CLI共用监督器，SIGTERM后也清整个本轮进程组及临时根，不按端口查杀。

正常/失败关闭顺序为冻结新工作、abort本轮任务、失效auth/guard/Registry、销毁Agent/请求/socket并await close，最后删除本轮临时目录。store.close只释放本地入口，不删除磁盘内容。所有本轮新数据都在临时环境，正式服务/旧绑定文件未迁移；回退撤回新模块即可。设备端撤销确认、正式配对/可信时间/系统密钥/物理掉电与v5/Flash互操作仍未实现，NO_GO_UNTIL_MEASURED保持。

## A8显式根权威候选

[A8](round-pet-a8.md)新增显式rootState v2 profile，把根状态与绑定放同一CAS文件；默认v1仍严格且无自动迁移。readonly scope不写，prepare候选离开scope后才durable CAS并发布。rotate/revoke保根、mapping不可改根。实例内revision检测不等于跨进程防磁盘回滚，物理耐久/可信恢复与生产初始化仍待验。
