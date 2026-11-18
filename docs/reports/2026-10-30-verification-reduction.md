# 重复复验减量验证报告

2026-10-30。按[实现前Spec](../context/plans/verification-reduction-spec.md)/[Diff](../context/plans/verification-reduction-diff.md)完成宿主切片，活动边界见[契约](../protocol/verification-reduction.md)。未接真实设备、改固件/pet/桥接/DSH配置、启用插件、提交或推送；无新第三方依赖，保留并行角色工作。

## 结果与边界

mTLS使用当前profile实例内、用途/SHA256及完整DER匹配的最多64条静态批准FIFO；每次仍检查根/叶日期和真实socket、绑定/撤销/credential epoch。内部解析证书不暴露给调用者，返回X509的API给独立对象；auth关闭清缓存。缓存不保存bound或凭据准入结果，不跨信任根/用途/owner复用。

session runtime默认scoped：每个同步业务调用共享一次完整验证的binding revision，finally释放；新路由/每4KiB写块前再次完整读盘，不跨await、不靠mtime/大小/TTL。内部只读路径共享私有数据，公开read/record/lookup仍clone。视图内禁止变更，读失败在scope中保持失败；CAS/文件锁/写前冻结/commit_unknown语义保持。受信full参数保留逐次静态和磁盘验证供对照/回退，未提供UI配置。

一致性只到同步栈的已验证snapshot；其他进程在首次读取后更改文件，可在下一scope发现，**不是跨进程事务或即时撤销保证**。同scope的read仍查写锁。无跨请求元数据缓存，因此同尺寸/保mtime损坏仍拒绝。单一owner与协调器写路径仍是前提，SHA不是抵御同uid恶意重写的签名。生产设备listener/调度队列未接入，物理最坏延迟准入保持NO_GO_UNTIL_MEASURED。

## 同负载对照

macOS arm64、Node24.14.1/npm11.11.0/OpenSSL3.5.5。独立临时PKI/私有元数据和literal loopback动态端口，真实TLS1.2/P256，与原探针相同套件/资产/控制顺序。相同当前代码先full四档、再scoped四档；每档4轮原创70001B资产及4次模型renew，完整SHA、控制在段边界优先、每档素材280004B和写次数对等。不是实际设备命令、PET4解码、完整角色包或64设备并发。

正式数值来自忽略目录.cache/verification-reduction/results.json，监督器校验去敏schema再保存。最终独立测量在check/test和取消检查结束后重跑；表内只使用这一轮，不混用历史耗时。固定顺序可能受JIT/缓存/环境影响，无随机化或统计置信结论，耗时不作加速比门禁。

### 次数与字节

hello/acquire后重置计数，预热静态检查另记full10/scoped1。warm static=0表示本连接已缓存，不能省去首次验证；动态有效期仍每次执行。

| 绑定数/写块/Range KiB | 写次数（两策略同） | 叶/动态检查（两策略同） | warm静态 full→scoped | metadata加载 full→scoped | 元数据逻辑读取B full→scoped |
| --- | --- | --- | --- | --- | --- |
| 1/4/32 | 72 | 108/108 | 108→0 | 328→100 | 135464→41300 |
| 64/4/32 | 72 | 108/108 | 108→0 | 328→100 | 6140160→1872000 |
| 64/16/32 | 20 | 56/56 | 56→0 | 172→48 | 3219840→898560 |
| 64/4/8 | 72 | 132/132 | 132→0 | 400→124 | 7488000→2321280 |

默认4KiB写块/32KiB Range的64条绑定档：load328→100，逻辑读取6140160→1872000B，减少约69.5%。成功assertCurrent从3次load减为1次；一次模型renew的begin、两次路由检查和accept合计19→4次，6次动态证书检查保持。16KiB档仍只作原有实验，不改变4KiB默认或撤销字节窗口。逻辑读取不是物理盘I/O，131072B文件上限和64条容量保持。

### 耗时观察（ms）

| 绑定数/写块/Range KiB | 总elapsed full→scoped | 段RTT样本max full→scoped | 控制RTT样本max full→scoped |
| --- | --- | --- | --- |
| 1/4/32 | 24.435→9.805 | 2.482→0.915 | 1.308→0.503 |
| 64/4/32 | 71.688→38.585 | 8.564→4.828 | 5.799→2.519 |
| 64/16/32 | 43.285→21.043 | 3.143→1.800 | 5.314→2.223 |
| 64/4/8 | 76.372→43.222 | 2.215→1.772 | 3.994→1.870 |

耗时不含建库、hello/acquire及后置仪器基线；RTT不含lane等待。嵌套scope不能相加，仪器开销未扣除。certificate_static只量曲线/签名/扩展/用途；DER解析、指纹/hash/map和动态日期均包含在leaf总scope内。warm没有static字段表示执行0次，新数值schema允许它缺省，comparison仍要求初次计数。

64条/4KiB/32KiB档细分（累计/样本max，均ms）：

| scope | full total/max | scoped total/max |
| --- | --- | --- |
| certificate_leaf | 8.808/0.212 | 0.475/0.032 |
| certificate_validity | 0.073/0.005 | 0.042/0.002 |
| certificate_static | 6.265/0.118 | 0.000/0.000 |
| metadata_read | 1.653/0.032 | 0.808/0.023 |
| metadata_load | 47.194/0.512 | 20.567/0.363 |
| session_check | 55.113/1.222 | 25.814/0.543 |

没有据样本修改B1900ms/双端500ppm等设计参数。前轮深队列B9900、host RTT19810、发送跨度5070ms的可用性反例仍成立：减少本机重复成本不证明网络/盘/CPU/设备上界，也不能把样本max换成硬预算。

## 14项专项与既有回归

| 范围 | 验证结果 |
| --- | --- |
| 静态缓存（4项） | 返回X509变异不污染缓存；warm未知/未生效/叶和根过期拒绝；用途/根/扩展/用法/精确编码负例；FIFO淘汰、关闭清理和关闭后拒绝 |
| revision视图（5项） | clone与嵌套一致；异常/Promise释放与禁止变更；外部有效提交下一scope可见；同尺寸保mtime坏摘要拒绝且吞错后不能恢复该scope；关闭不留下可读权威 |
| warm真实TLS块间（4项） | 时间未知/过期/未生效3例；坏JSON/正确摘要但坏schema/坏摘要/删除/symlink/文件或目录权限/写锁8例；外部撤销/轮换、本地冻结、写前失败及commit_unknown5例；休眠失效1例。17条注入路径均只写首块、下一块前拒绝，session/auth清权威，未发布完整候选；关闭后缓存/连接/请求/定时器为0 |
| 同负载对照（1项） | 两策略四档各4轮SHA/顺序/字节/动态检查数对等，固定计数减量与初次批准正确，未知证据字段拒绝 |

npm run check通过（仅.mjs语法）；npm test含候选构建全套399项通过、0失败/跳过。既有真实TLS、绑定故障恢复、旧proof/租约重放、受控休眠与新会话协商、选主/IOKit注册及320次重连测试均以新的默认路径回归；旧历史full探针仍显式full。没有重跑真实电脑睡眠、长测、浏览器或真实角色库导入。

## 独立环境、清理及回退

正式CLI14项通过，监督观察墙钟4554ms，temporary_environment_removed=true。每档关闭后socket/Agent/请求/定时器/activeRequests为0、listener停止；专项关闭后auth缓存条数0，临时PKI根已删。

等待自有临时根创建后，分别在0.25秒及0.8秒发送SIGTERM：退出1、interrupted=true、不保存部分observations、临时环境删除，终止没有报错，最终hvrr根数量0。复用前轮已补强的终止错误/独立目录清理，不操作外部进程/端口或运行配置。证据和取消结果均在Git忽略目录，未保存证书、指纹、报文或本机网络配置。

回退关闭自有lane/会话/Agent/请求/socket/listener、等待实际结束与自有子进程退出，删除临时根。受信装配代码可用verification=full重新创建owner，或撤回本轮实现；没有现有DSH/pet/桥接配置、素材或hub-bindings/1格式需要恢复。

## 未覆盖与下一入口

未测缓存64个实际TLS身份的原生峰值、16设备并发/完整角色包/冷盘/多日、跨进程scope内任意写的原子撤销、真实网络/重试/轮询/设备处理上界、OS物理睡眠时序、helper签名/Keychain、ESP凭据/可信时间/TLS峰值/Flash/v5。缓存仅有条数和DER长度上限，不是进程RAM硬预算。

下一先做生产承载调度/期限Spec/Diff：明确控制FIFO优先的真实接入点、poll/分段/背压与队列等待的合成上界、重试身份和副作用未知时的失效策略；不能仅把离线lane接进去就宣称可用。签名/秘密引用与旧元数据迁移仍需专项，物理电源/设备操作必须另备窗口、观测和回退，不自动执行。

已更新当前摘要/待办/活动协议，并[按主题归档](../context/history/verification-reduction-evolution.md)被替代的“默认无缓存、3次元数据读取、仍待设计复验减量”描述；历史full负载报告保留为参考模式证据。
