# 静态证书批准缓存与同步revision视图

2026-10-30。本仓库离线宿主实现；依据[实现前Spec](../context/plans/verification-reduction-spec.md)/[Diff](../context/plans/verification-reduction-diff.md)，同负载与负例见[报告](../reports/2026-10-30-verification-reduction.md)。没有生产设备listener、真实配对或ESP准入。

## 哪些可以缓存

`createCertificateProfile({rootDER,now,metrics?,cacheEntries=0})`的静态缓存可设0–64条。实例固定直接根、P256/SHA256和严格扩展/用途策略；键为用途与DER的SHA256，命中还核对完整DER字节。成功条目只保留私有解析对象及静态批准，FIFO满时逐出最早条目；失败不缓存。最多64个≤4096B DER，但解析对象/原生TLS内存并无硬RAM测量结论。

每次调用都要求受信wall为非负安全整数，并检查根和叶的有效期，沿用原有效期端点语义。缓存命中只省去解析、曲线/签名、扩展和用途的重复工作，不能省去日期、真实socket、绑定/撤销或epoch/session检查。信任根变更必须关闭旧owner并新建profile，不能只改调用参数复用旧缓存。它不是通用PKIX、中间CA、CRL或OCSP实现。

client/server仍返回X509Certificate；启用缓存时返回独立对象，调用方覆盖getter或修改导出数据不能污染内部证书。新增clientFingerprint只返回已检查指纹，mTLS使用它避免为了返回对象再次解析。server主机名每次仍检查。close清缓存并拒绝未来验证，resources仅有cached_certificates/closed；缓存不落盘、不存绑定准入决定、不保存私钥。

`createMTLSPeerAuth`的cacheCertificates默认true（64条），false用于full对照。每次仍核对TLSSocket、encrypted/authorized、未销毁/未session reuse、TLS版本/套件，再检查动态日期与lookup结果、身份/绑定/凭据epoch。缓存里有同CN或有效CA证书不代表设备已绑定；lookup仍是权威。

## 哪些只能在同步栈复用

`store.withReadView(syncWork)`是受信内部API：首次read/record/lookup/isAdmitted才读当前磁盘，验证锁、目录权限、O_NOFOLLOW、文件类型/大小/私有权限、JSON/严格schema/摘要。随后同一同步栈复用该revision的数据；内部只读方法访问私有数据，read/record/lookup对外仍返回clone，不能修改权威。isAdmitted仍检查当前句柄的frozen/uncertain。

嵌套同步scope复用外层，最外层finally释放；不保存跨调用数据。异常同样释放；读取失败在该scope保持失败，即便调用方吞错/修复文件也不能继续返回成功。Promise/thenable返回按read_view_async拒绝并消费异步拒绝，不能让原视图跨await；这是可信调用约定，不能撤回任意错误回调已造成的副作用。视图内register/commit/revoke/rotate/freeze/unfreeze禁止，返回read_view_mutation。close允许安全关闭，未来读取store_closed。

**这不是跨进程事务。** scope首次读之后，其他进程原子替换或原地损坏文件，在下一scope首次读发现；同scope内部保持已验证revision，不混用新旧身份。每次read仍检查写锁，发现则该scope失败。没有mtime/文件大小/TTL/watch快捷缓存，所以同尺寸且恢复mtime的损坏也不能跨scope漏过。外部同uid若重写合法封套/摘要，不由SHA抵御；服务单owner和协调器写入仍是前提。无法原子绑定“读磁盘→写socket”，不承诺即时外部撤销或物理墙钟上界。

写路径仍使用原文件锁、CAS、临时fsync/rename/目录fsync，不使用读视图；新scope看到外部revision后照常校验。冻结后失败、commit_unknown和坏档没有缓存回退；磁盘不可读时失效清理仍只依赖内存。没有旧存储迁移或自动修复。

## 会话装配与默认行为

`createSessionRuntime`新增受信verification=`scoped`（默认）或`full`。scoped要求store提供withReadView，启用64条静态缓存，并在begin/confirm/assertCurrent/beginLease/accept/expect/track/complete/snapshot各自同步调用内建视图。accept内部auth、guard、Registry共享该revision，但每次真实路由入口、body读取后的检查、每个4KiB素材写块前都重新进scope；不会包围HTTP await或整段传输。full关闭缓存和视图，保留重复完整验证以便对照/回退。

直接暴露的auth/Registry/guard只供可信装配，不因为runtime创建就自动获得所有外围入口语义；离开scope仍按原store逐次读取。managed review装配使用新的默认scoped；CLI/插件不新增启用开关，不改descriptor/存储格式，无运行服务升级。旧系统要切换策略应关闭owner后重新构造，不能附着后假定已有owner已变更。

成功assertCurrent由3次load减为1次。模型renew的begin、两次路由检查和accept各1次load，合计由19减为4；6次证书动态验证仍保留，预热后无需再做静态验证。auth独立调用若不在scope内，仍会在lookup中按原语义读盘，不能把该数值套到所有API。默认4KiB写块/32KiB Range和段边界控制优先参考不变。

## 同负载证据与回退

```sh
node scripts/verify-verification-reduction.mjs --output .cache/verification-reduction/results.json
```

独立POSIX监督器测试14项，临时PKI/绑定文件/真实loopback TLS，四档各4轮70001B原创字节，先full后scoped；策略都使用同一当前代码，禁止把往次耗时混成对照。hello/acquire后计数重置；initial_static_checks单独保存预热成本（full10/scoped1），不能把warm0误写成无需初次证书验证。固定控制顺序、SHA、字节/写数及动态检查数对等，时间只作观察，不设加速比门禁。

certificate_leaf现在是每次叶检查总scope；certificate_static计曲线/签名/扩展/用途，仅miss执行，初次DER解析在leaf内；certificate_validity计根/叶动态日期。cold解析与map/hash成本也在leaf内。新类别在旧证据schema中可选，warm没有static类别表示执行0次；对照要求每档额外初次计数且严格校验固定数值字段。嵌套时间不相加，逻辑metadata_bytes不等于物理盘I/O，仪器成本不扣除。

正常、失败、取消按既有监督器关闭自有进程组与临时根；终止拒绝明确失败且不导出部分观察。关闭lane/Agent/请求/socket/listener/会话清缓存后再删临时PKI。回退可由受信程序显式verification=full新建runtime，或撤回实现；没有已运行DSH、pet、桥接、设备或磁盘格式要恢复。物理最坏网络/盘/CPU/漂移/睡眠、ESP资源及持久凭据门槛不变，NO_GO_UNTIL_MEASURED保持。
