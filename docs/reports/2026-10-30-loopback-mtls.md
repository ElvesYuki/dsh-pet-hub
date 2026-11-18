# 独立loopback mTLS互操作验证

2026-10-30。按用户授权，先写[Spec](../context/plans/loopback-mtls-spec.md)/[Diff](../context/plans/loopback-mtls-diff.md)及回退，再运行独立临时环境。没有连接真实设备、修改固件/pet/bridge/现有DSH配置，没有安装/启用插件、提交或推送。并行动画导出工作保留。

## 已确认结果

真实Node HTTPS双方完成TLS1.2握手，实际协商`TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256`、authorized=true、非恢复连接。客户端使用固定私有CA和精确服务名，服务端要求并验证客户端证书。peer X509指纹→已批准绑定/凭据代数→固定完整context→opaque peer proof进入Registry.connect；候选TTL报文经真实TLS传输后生成receipt proof进入lease guard。路径未使用上一切片的离线签名证明冒充TLS。

共享证书profile已抽取，旧离线认证测试保持通过；core只公开已有context校验入口，wire与租约公式未改。正式服务未装配listener，runtime模块本身无监听。详细API/范围见[契约](../protocol/loopback-mtls.md)。

| 验证 | 结果 |
| --- | --- |
| npm run check（仅.mjs语法） | 通过 |
| npm test（含候选构建） | 308/308通过 |
| 本轮loopback专项 | 22/22通过，包含于全套 |
| 原离线证书/TTL测试 | 全套中12条回归通过 |
| 专用验证CLI | passed=true，临时环境已删除 |
| SIGTERM取消监督进程 | 预期退出1、interrupted=true、passed=false、临时根已删除 |

当前全套数量包含并行分层角色真实导出新增的16条；本切片新增22条，不能把合计增量全部归于TLS。没有再次运行未受影响的素材全库、浏览器或30分钟探针，check不是架构/契约自动门禁。

## 用例覆盖与实际修正

- 无客户端证书、错误CA/用途、错误服务器CA/SAN、版本/套件不匹配在真实连接中拒绝；同CA同CN未登记叶及JSON设备/服务实例冒充不能取得绑定。
- 相同TLS连接复用，重复hello不清已有控制记录；连接不能改boot/session，旧应用session不能在新连接重放；提交旧TLS session数据仍为完整新握手，TLS恢复未接受。
- 主动撤销、凭据轮换和可信时间丢失使连接/旧proof/guard失效；已有actual保留，TLS关闭不被当成设备持久撤销确认。
- 70001B原创合成资产按三段（32768、32768、4465）传输，每次写≤4096，整包SHA一致；没有真实动画/素材目录/设备Flash接入。
- 缺失/陈旧If-Range、多/后缀/超大/越界范围、未知资产路径；客户端拒绝200/302、错ETag/Content-Range、gzip/chunked、长度不符/截断、整包摘要不符及停滞。失败保留旧actual；分段间和首块之后撤销均阻断候选发布。
- 畸形UTF-8 hello、过大exchange、旧context回执、proof序列化、传输中close及幂等清理均验证。每fixture收尾确认listener=false，socket/Agent/request/timer/在途HTTP与认证会话为0；PKI目录不存在。

首轮发现独立fixture的keepAliveTimeout=1000会使Node24 Agent提前关闭空闲连接；改为5000后实际同socket复用通过。撤销刚关闭连接时，旧Agent可能收到ECONNRESET，而不是业务403；测试按“旧连接失败、新连接被拒绝”的真实边界断言，不加隐式重试。关闭必须await自有请求和socket的close，不能仅一轮事件循环后假定计数归零。上述均已修正并纳入回归。

## 复现、隔离及回退

宿主锁定Node24.14.1/npm11.11.0，内置OpenSSL3.5.5；临时证书生成继续使用本机LibreSSL3.3.6 CLI，未增加依赖。读取本机TLSSocket实际API并执行互操作；本轮官方在线文档检索服务不可用，未据搜索结果推断兼容版本。

运行`node scripts/verify-loopback-mtls.mjs --output .cache/loopback-mtls/results.json`。结果及取消摘要位于忽略目录，不保存原始TLS材料/响应、端口或本机运行配置。测试自有literal loopback动态listener、临时Agent与私有PKI，未发现/复用任何现有endpoint。CLI监督整个POSIX测试进程组，正常或SIGTERM后删自有临时根，取消不会报告成功。

回退按Spec停止本轮新请求、销毁Agent/在途请求、失效auth/guard/Registry并关socket/listener、等待清理，再删除临时PKI；无需恢复任何外部配置。所有本轮正常验证环境已关闭。新代码与原创合成fixture为本仓库MIT，无复制上游代码/动画。

## 未覆盖与下一入口

没有生产listener/单实例选主装配、正式凭据存储、真实设备hello随机挑战协商、统一绑定持久状态、掉电撤销恢复、系统休眠自动失效、多设备TLS容量/握手洪泛压力、renegotiation主动攻击或Windows监督测试。16连接/256会话历史上限是实现约束，未作实物或满载容量验收。受限直接根profile不支持中间CA/通用PKIX/CRL/OCSP。

局部keepalive、撤销和分段成功不证明ESP TLS峰值、可信时间、密钥保护、v5 wire互操作、物理漂移/最坏延迟或设备Flash事务。已有1900ms/500ppm仅假设，准入仍NO_GO_UNTIL_MEASURED。下一先补生产会话生命周期/绑定撤销权威及休眠恢复Spec/Diff，再推进v5协调与Flash模型；真实设备/固件操作另行授权。被替代的“尚无TLS握手”当前记录见[历史](../context/history/loopback-mtls-evolution.md)。
