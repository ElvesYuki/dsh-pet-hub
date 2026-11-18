# 独立loopback mTLS契约

2026-10-30。已在Node24.14.1/OpenSSL3.5.5宿主验证；仅独立测试fixture监听literal loopback动态端口。生产服务仍deviceTransport=false，未接ESP/固件/现有DSH。先行[Spec](../context/plans/loopback-mtls-spec.md)/[Diff](../context/plans/loopback-mtls-diff.md)，证据见[报告](../reports/2026-10-30-loopback-mtls.md)。

## 真实peer到可信回执

`createMTLSPeerAuth`位于runtime，不创建listener。必须显式注入rootDER、可信wall时间now、按证书指纹查找的lookupByFingerprint、当前controller_id/service_instance_id，以及同步onInvalidate。调用方必须是受信HTTP所有者，只传当前request的真实TLSSocket；该API不是接受外部JSON socket描述的IPC。

固定TLS1.2、ECDHE-ECDSA-AES128-GCM-SHA256、P-256及HTTP/1.1；服务requestCert/rejectUnauthorized=true，客户端显式CA、SNI服务名与正常SAN校验。双方私有证书均为临时生成；不改系统信任库。关闭ticket、resumeSession返回null，并在映射边界再次拒绝isSessionReused；socket禁用renegotiation。测试记录实际协商协议/套件及authorized，不以配置值代替结果。

共享certificate-profile校验直接根→叶、ECDSA-SHA256、CA=false、digitalSignature、精确用途、有效期与有界扩展。TLS原生链校验先执行，应用层再按可信时间及绑定复核；临时测试使用主机时间，不证明设备可信时间来源。离线签名工具继续存在，但TLS路径不调用它。

`establish(socket,context)`从peer X509 DER计算SHA256，查找bound记录并匹配device_id、binding_id/epoch、controller_id和credential_epoch；service_instance_id必须匹配本地owner。返回不可序列化peer proof供Registry.connect使用。每socket固定一个完整context，同context重复hello幂等且fixture不重复重建Registry记录；另一个context须新TLS/hello。每设备一个活跃连接、总16；当前auth生命周期最多记忆256个device/session键，拒绝重复和满容量，不逐出后复活旧session，close清记忆。后续[会话owner](session-consistency.md)已在显式managed临时模式实现hub随机挑战/新session；本节原直接context fixture保留为TLS边界回归，生产listener仍未装配。peer声明的boot字段不构成物理启动证明。

`assertCurrent`在每次HTTP请求及每次资产写块前复核；`attest(socket,bytes)`严格解码既有4KiB TTL报文并绑定完整context，返回packet/proof。guard通过`verifyResponse`再次检查当前socket、凭据、上下文及packet快照；复制JSON proof和旧连接proof不能授权。未经认证的URL/header/device_id不选择绑定，调用方不能跳过这些检查直接下发。

绑定更新后调用`revoke(device_id)`主动关连接；即使未主动调用，下一次检查遇撤销/凭据轮换/无可信时间也清会话并拒绝。socket close、revoke与auth.close均同步调用onInvalidate，fixture失效guard并断开对应Registry，保留旧actual。该回调必须由所有者实现且不抛错；没有默认空回调。后续宿主单一元数据/CAS及统一冻结顺序已在[会话切片](session-consistency.md)实现；设备端撤销确认仍未实现，关闭TLS不等于设备已持久撤销。

## 受限HTTP和分段

仅测试fixture开放POST hello、POST exchange、GET assets/<sha256>。前两者最多4096B，Content-Length必需；HTTP headers≤8192B，chunked请求拒绝。全部资产仅来自预先批准的原创合成摘要表，无任意URL/路径、真实动画或磁盘仓库接入。

`assetRange(headers,total,sha)`只接受显式单一闭区间bytes=start-end、端点在资产内且长度≤32768B，If-Range必须是已授权SHA强ETag。拒绝suffix/multi/越界/超段/陈旧ETag。fixture每次write≤4096B，写入间隙再验授权并响应背压；这不保证TLS/TCP内部缓冲也只有4096B。

`validateSegmentResponse`只发布完整验证后的段副本：必须206、精确Content-Range/Content-Length、相同强ETag，无chunked/content-encoding/location。客户端不自动跳转/重试，每Agent最多一个socket、一个请求在途；正文收集上限32768B，绝对请求deadline覆盖握手到收包，不以read timeout冒充整段期限。70001B合成资产按32768+32768+4465三段验证后再核完整SHA，失败丢候选，不写角色指针/actual。

已验证200/302、错ETag/范围、gzip/chunked、超长声明/截断/停滞、内容损坏、分段间及首块后撤销。已经写入TCP或已收到的字节无法撤回；撤销阻断后续传输/发布，不声称删除对端已有资产。当前Range是Node宿主与Node客户端互操作，不代表ESP Range、PET4资源仓库授权或设备Flash安装。

## 运行、资源与回退

`node scripts/verify-loopback-mtls.mjs --output .cache/loopback-mtls/results.json`使用独立测试子进程组（POSIX），上限30秒，输出仅去敏用例及清理状态。测试监督进程创建临时根，子测试PKI在其内，正常/失败/取消均删根；SIGTERM中断已实测。只杀本轮自有进程组，不查杀其他服务；Windows监督器未实现。

fixture上限32 TCP连接、1秒握手/请求deadline、5秒HTTP空闲、64请求/socket；认证连接再限16。5秒空闲用于保持Node24 Agent复用，不能推出设备心跳周期。关闭先停新请求、销毁Agent/在途请求、失效认证及guard/Registry、销毁自有socket，await listener/请求/socket关闭，再删临时PKI；测试断言计数归零且close幂等。专用CLI写显式.cache忽略目录，不保存端口、证书、私钥、session secret、keylog或原始响应。

回退关闭并清理本轮临时环境，撤回本切片新增模块即可；没有持久格式迁移、正式服务启动或配置更改。loopback延迟不证明1900ms/500ppm或ESP TLS内存/可信时间/持久密钥资源门槛。后续临时绑定/会话权威与注入休眠恢复已实现；后续[review装配、macOS观察源与managed admission回收](service-power-capacity.md)已验证；下一仍须物理电源周期/负载及v5协调/设备Flash事务方案；真机准入继续NO_GO_UNTIL_MEASURED。
