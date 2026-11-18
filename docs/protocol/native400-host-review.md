# 400-04 默认关闭的临时宿主装配

2026-11-02。[Spec](../context/plans/native400-04-spec.md)/[Diff](../context/plans/native400-04-diff.md)、[报告](../reports/2026-11-02-native400-04.md)、[400-03合同/W01–W10](native400-wire-review.md)。此处是内部离线候选/API，不是生产service/CLI/plugin入口、固件实现或设备准入。400-03表/revision1/94正116反与400-02工作集未改，旧尺寸只作备份。

本页记录400-04缺省路径；后续显式scheduling选项/触摸调度见[400-05 API](native400-scheduling-review.md)。该选项仍无生产入口，不改变400-03字节。

## 所有权与默认边界

createNative400WireReview(directory,{material,sessions,readView,rootAuthority,clock,readBudget,ackMs=4000})拥有400-01 import/worker、CAS reader、A4 read lane、原PullControlQueue与新Native400Observations投影，借用调用者私有绑定/session/guard/readView/A8 rootAuthority。ready完成严格批准/媒体验证后仍disabled；enableReview须显式调用。模块不创建socket/listener/自动轮询/插件或IPC路由，不发现真实设备/pet源。createNative400ReviewHandler只允许挂在调用者自建的临时双端127.0.0.1 mTLS server。

A3的requested/actual/历史/相关性原则在独立400投影实现，不把新字段塞入旧360 A3/schema2。A8根仅读取检查点，storage/inventory0始终unsupported、saved/offline_available=null，不提交EMPTY或迁移旧缓存/floor；没有Flash写gate或保存/淘汰成功。R7实际退出原则通过原read lane/writer/request owner延续，未复制旧Flash executor来冒充400。

## 受信profile注入（原缺省不变）

- Registry新增validateCapabilities/validateTarget构造依赖，缺省原capabilities/target。session新增可选deviceProfile（且只接受capabilities/target/decodeLease三个函数，内部冻结副本），缺省原实现。
- native400SessionProfile严格校验400 schema3/manifest目标，独立解析native400-review-lease/1为原guard packet。MTLS auth仅新增可信decodeReceipt函数依赖；仍在实际TLSSocket、证书/日期/绑定/epoch/current context上产生proof，再交原guard。没有生成旧360 lease字节或虚报完整encoded RAM。
- 上述是代码依赖，不从wire/IPC/运行配置选择，默认DSH/服务调用没有注入。新loopback client只追加显式review路径白名单并返回rawHeaders；原默认路径、单socket/HTTP、失败等请求/连接退出及无自动重试保持。

## 握手、控制与观察

hello.begin/challenge/confirm/ready完整核profile/包/版本/策略、同socket/boot/challenge/context和递增request_seq；confirm后调用原session建立认证。每次exchange及每个≤4KiB读块重新进入store.withReadView，动态日期/撤销/完整绑定元数据检查不跨await缓存。整个会话只有一个HTTP，queue仍一pending/一latest/一ordinary和有界紧急flags。内部query.inventory普通槽仅翻译为400 query.storage，返回unsupported，不产生旧inventory事实。

接纳ACK与全部媒体作业分开：默认ACK4000ms，测试lease15000及原保守horizon，段/exchange/cleanup/margin为1000/500/100/10ms；均为**离线假设**，不作ESP/CPU/磁盘/网络最坏值。合法renew保原control epoch/lease，逐块授权仍须有效；模拟actor作业固定120000ms、每个新作业开始时计时，与可续lease独立，续租不能延作业截止。未达到剩余预算就不发读许可，不加TTL掩盖排队。

Native400Observations逐request/stream/verification/commit防重放；invalid input不部分发布，认证错误fence会话。linked观察先核dispatch/具体target/operation/query或lease request；query snapshot/cancel不能靠null dispatch清pending。退役目标accepted只清它自己pending，不能覆盖最新desired；后续新目标才可派发。cancel.io_exited=false继续占pending，直到同operation新序列true或期限失败。它也不能释放本地仍在执行的HTTP/read。

whole verified记录须descriptor与独立批准metadata一致且首遍源cursor完整；仅校验自报SHA形状不够。验证引用最多4项（保护已观察actual），display必须引用同context/P/M/N/action/F/target的已接纳记录；未知verification_seq拒绝。软件commit高水位拒绝同序列改画面，commit−first至少覆盖frame_index；相同画面query可重复观察。旧context只有与本owner已知历史完全一致的held画面可投影，新进程没有该历史就不能凭自报建立旧证据。HTTP/下载/PC预览不合成verified/playing。

## 固定读取recipe与真实HTTP

400-03没有客户端read-request/任意range选择字段，因此本候选明确使用：每会话20页完整目录（4项/末2）→当前target首遍文件→收到完整verified后从0重读。新target保留已传目录，从asset0重新开始；重连重取目录和全验，不恢复部分下载、不重试旧manual或已用permit。此顺序是离线recipe，尚非正式设备调度协议。

每次exchange至多发一个manifest/asset permit，字段精确绑定当前socket/context/control/target、P/M/N、页/显式range/总长与授予exchange request_id/seq；下一exchange替换未用许可。control与permit互斥，控制优先；GET只准消费一次且必须与发出的页或range完全一致。旧A4单次票据在内部复用，仅桥接头名，不改旧路径/格式。

POST body≤4096、真实请求头计量≤8192，GET无body/编码。asset必须单Range≤32768B、If-Range=F强ETag，响应206/Length/Range/ETag与X-Pet-Hub-Read/Request-Id/Seq全部核对；client检查rawHeaders重复/编码/CRLF和body长度。写块仍≤4096，块前/后新scope验证原session/guard，reader同fd前后fingerprint；部分206失败destroy，不能拼JSON或发布完整素材。错误用400-03固定安全码，不泄露内部cause：非法报文400、未启用503、未授权读映射stale_control、blob改变映射integrity_failed；已发headers后只关闭。

cursor只在相应GET实际handler成功、writableFinished且当前权威仍有效时推进；失败/取消不推进。abort/timeout/响应close均不是实际I/O结束，忽略abort的beforeChunk仍须await；HTTP/read/reader/catalog pin在finally实际退出后释放。disable/close先fence再等待；未退出禁止enable/new hello。临时测试peer断开还等TLS两端close，避免旧server连接未退出时抢唯一socket；没有通过重试掩盖时序。

## 模拟peer与资源

createNative400WireExecutor直接调用原Native400WindowModel：每次只保一个≤32768B接收段和≤2464B重读头副本；没有全文件encoded数组。核心最大逻辑typed-array2194816B不变，executor最多额外35232B段/头，不含wire/projection元数据、SHA内部状态、Node VM、源fixture/测试完整decoder/worker或系统TLS。不是硬RSS/ESP预算，第三RGB仍预留，不声称RTOS前瞻实现。

首遍逐tile/LZ4/XOR/CRC/F/index/RGB/extra真实验证；成功才产生verified/verification_seq；重读逐帧SHA后必须独立prepare/submit，再显式display才投影actual。118/117短尾按原clock模型；解码/F/重读或作业超期失败发有界failed报告并使源停止，保留已知历史front，不用HTTP成功补状态。lease过期/clock失败/断线则清旧上下文，旧帧/旧回执不能复活。

local4本片仅验证**空闲时显式原创本地源**：同一个actor全验→asset.verified→重读→软件首帧，未伪造remote4或创建第二套常驻窗口。不是设备初始Flash/ROM已安装、真实触摸、挥手抢占/回最新base或deferred_local完整调度。活跃local作业与新remote竞争目前明确拒绝，不静默抢占；这部分列为下一离线切片。TLS peer的lease grant是模拟设备逻辑，host用真实TLS/原guard核它，不代表ESP的凭据/时钟/控制权实现。

## 复现、退出与下一入口

`node scripts/verify-native400-04.mjs --output .cache/native400-04/results.json`运行37专项，仅使用原创source/独立用途批准、私有CAS/PKI/store、虚拟双时钟（设备起点偏移700000ms）与动态loopback端口。专用临时环境和worker/socket退出后删除，不能据此推断400@24/G1/G2/真实无线或持久化。

回退：disable/close自有adapter→等HTTP/read/worker实际退出→调用者关闭自有TLS client/server/session/store→删除自有临时根。忽略abort未退出时保持资源保护，不清pin或假装回退完成。撤回新模块和四个显式注入/测试传输修改即可，无namespace/分区/缓存/配置迁移，无现有服务需恢复。

本阶段原计划（现已由[400-05报告](../reports/2026-11-03-native400-05.md)完成其离线范围）：local4优先/最新base/退役命令与失败恢复、自动循环/欠载/分段/合法续租协同。是否需要新read-request/版本修订必须先审合同，不静默扩大400-03 revision1。正式profile/策略/两遍与7712B成本、N/Store、TLS/可信时间/凭据/实际退出/G1-G2/24fps和真实用途仍W01–W10待共同确认；本轮不启动生产或设备窗口。
