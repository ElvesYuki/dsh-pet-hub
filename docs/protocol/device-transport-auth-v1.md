# 实际设备承载与绑定认证子Spec

2026-10-29承载设计；2026-10-30后续已完成[离线证书/签名及TTL](offline-auth-v5.md)和[Node loopback真实mTLS互操作](loopback-mtls.md)。**尚无设备连接、新固件管理实现或生产listener，准入保持NO_GO_UNTIL_MEASURED。** 正式目标为[175C原生360](../context/native360-baseline.md)，迁移仍须审查v5。本文ESP网络/绑定持久化部分为设计，不继承模拟器共享时钟假设。

## 1. 首个验证候选与备选

| 路线 | 审查结论 |
| --- | --- |
| 设备作为HTTPS client，独立hub作为mTLS server | 首选离线原型；复用esp_http_client，单连接、认证边界清楚，应用私有CA，不改OS信任库 |
| ESP-TLS TLS-PSK | 保留复审备选；本机esp_tls有psk_hint_key，但当前esp_http_client配置没有同名直接入口，PSK验证未启用；不能当成已可直接替换的省内存方案 |
| WSS/双控制与下载TLS连接 | 首版不选；新增连接和依赖/峰值，当前内部RAM余量不足以预先承诺 |
| 明文HTTP+共享Bearer、关闭证书验证、信任广播/首次裸网连接 | 不用于新协议绑定/控制；旧v4仅在显式legacy模式独立保留 |

首个互操作目标固定TLS 1.2、ECDHE-ECDSA-AES128-GCM-SHA256、P-256证书；算法集合是候选约束，Node loopback已执行协议/套件与证书正反例，ESP仍须实物负测才能放行。当前IDF配置只启用TLS1.2，Node24.14.1本地OpenSSL3.5.5能枚举该套件；不能用Node26网页或getCiphers枚举推导设备握手已成功。TLS1.3后续单独验证，不允许协商到TLS1.0/1.1。

依据：[ESP HTTP Client 6.0.2](https://docs.espressif.com/projects/esp-idf/en/v6.0.2/esp32s3/api-reference/protocols/esp_http_client.html)说明同一handle可复用连接，并有HTTPS校验入口；[ESP-TLS 6.0.2](https://docs.espressif.com/projects/esp-idf/en/v6.0.2/esp32s3/api-reference/protocols/esp_tls.html)列出证书与PSK两种验证路线。实际接口以本机同版本头文件/源码复核。

## 2. 网络拓扑与连接预算

- 设备主动连hub的**独立设备监听器**；该监听器只能提供本协议白名单，不挂载DSH/pet、本机IPC或任意URL代理。不复用现有bridge端口，不监听通配地址，不配置路由器转发。
- 只有取得用户级hub服务独占权后才可打开设备监听；绑定到用户明确选定的本地接口与新端口。端口变更需已认证发现/重新配置，不能信任mDNS广播后直接改信任锚。
- 初版每设备最多1个TLS连接、1个HTTP请求在途。设备通信任务唯一拥有esp_http_client handle；动画/触摸任务只通过有界队列交互，不能并发使用handle或持LVGL锁等待网络。
- 复用持久HTTP连接，控制收发和素材分段串行。TCP keepalive是探测机制，不能替代应用心跳或TLS/HTTP连接复用；遇Connection:close、截断、超时就销毁handle并带退避重建，不每200ms重新握手。
- TLS最大并发/握手准入先限定一块当前板；多设备listener可后续限流，不能把模拟两设备通过当TLS并发容量通过。

## 3. 认证及身份映射

设备持有独立P-256私钥和clientAuth证书；controller拥有独立本地CA、serverAuth证书与私钥。服务进程重启不换controller身份，但换service_instance/session/控制代数。一个有效CA链本身不代表已绑定。

设备验证：预置controller专用CA、证书用途/有效期、预期稳定服务DNS标识（如每controller独立名字），正常校验证书名称；禁止skip_cert_common_name_check和全局不安全开关。数值IP变化时，连接地址与预期证书服务名分开配置，通过IDF common_name等实际接口验证；必须有错误SAN/错误CA负测。固定服务名只作证书匹配，不让广播赋予信任。

hub验证：Node server要求requestCert=true、rejectUnauthorized=true，并将授权证书的指纹/公钥与已批准device_id、binding_id、credential_epoch白名单匹配，检查clientAuth用途；不以CN或客户端自报JSON选设备。每HTTP请求重新检查当前绑定/撤销状态，即使连接已建立也不能绕过撤销。错误设备证书、相同device_id不同密钥、有效CA签发但未登记的证书均拒绝。

初版关闭会话票据/恢复，限制每设备握手速率，重启建立新TLS/session；恢复功能要在撤销负测后再开放，不能让空peer证书被当授权。不得输出keylog/TLS secrets或把客户端证书私钥传给UI。

[Node TLS官方API](https://nodejs.org/api/tls.html)支持请求并校验客户端证书；在线页当前版本较本机新，本轮只将其作为API概念参考，Node24目标仍需离线互操作测试。后续已完成临时证书的离线签名/用途/绑定及撤销负例，未调用真实证书存储或开启TLS监听；peer映射已在后续Node loopback验证，生产listener/凭据所有权装配仍待实现。

## 4. 首次配对和凭据生命周期

### 4.1 USB开发绑定（未来授权后）

1. 用户明确进入限时开发绑定并确认目标实物；USB物理通道与屏幕指纹确认是初始信任，不使用LAN TOFU。日常BLE配网另行实现，不能宣称本流程已满足P2。
2. 设备在本地生成随机身份/密钥及CSR，私钥不离开设备；hub只接收CSR、公钥指纹与待确认身份，校验证明后签发证书。录入独立controller CA/服务标识/新endpoint，不复用bridge token或把Wi-Fi秘密写入日志。
3. 双方各存pending binding记录，设备核对并持久提交后返回确认，hub再标bound。断电/取消/超时保留可解释pending，不因单边文件生成就标已绑定。
4. 旧USB解析行长256字节不能承载完整证书。新增独立版本化USB分帧命令，单片原始payload≤64字节（Base64后≤88字符），USB operation_id限32字符、整行含元数据≤240字节，带operation_id/序号/长度/最终摘要，证书/CSR/metadata各有上限；CRC只检错，不当认证。缓冲不超8KiB，重复片幂等、取消清pending，不兼用旧pet_config字符串格式。

### 4.2 两类持久化门槛

- **首次资源探针**：临时证书与密钥只留设备RAM，重启失效；只测握手/堆/帧率，不进入正式注册表，不声称持久绑定或自动重连。控制台输出指纹与存在性，绝不输出私钥。当前报告所需预算仍未测量，不能直接执行探针。
- **正式绑定**：拟用新namespace hub_id/hub_bind/hub_epoch（各≤15字符），保留clock_net/pet_remote等旧namespace。私钥/证书/信任锚、绑定状态和epoch分别限定编码长度，双槽generation+摘要记录及最后激活标记须过掉电切点；同一namespace不等于独立容量或事务。

候选DER上限：私钥256B、设备证书1024B、controller root1024B、绑定metadata768B，单份总载荷3072B；双副本6144B尚不含NVS页/条目开销和写放大。当前175C production分区报告NVS为860160B，属于源码/宿主快照，实际部署表与free_entries未读取，**不能证明可用容量或掉电安全**。旧128的24KiB仅为历史值，不用于新目标容量结论。空间不足时停止绑定，不自动erase/repartition或覆盖旧配置；证书长度必须由实际签发器检查，超限拒绝，不截断。

主机秘密放系统安全存储，普通配置只保存引用。macOS初选Keychain条目；NodeTLS若需要PEM则由专用适配器授权读取到服务内存，不声称已集成Secure Enclave不可导出签名或能保证JS堆清零。CA私钥与server私钥权限分开；自动签发仅经批准的配对操作，不开放无鉴权签发服务。Keychain读写/授权未实现或验证。

### 4.3 设备静态秘密保护

当前源码配置未启NVS加密、Secure Boot或Flash encryption，不能声称抵御物理Flash读取。IDF提供Flash-encryption或HMAC保护的NVS方案；这涉及key partition/eFuse和恢复路径，必须单独审批，不作为本轮/首次探针的默认操作。[官方NVS加密文档](https://docs.espressif.com/projects/esp-idf/en/v6.0.2/esp32s3/api-reference/storage/nvs_encryption.html)

正式持久凭据若无已审查的存储保护策略，只能明确作为开发环境威胁模型，不能标成生产安全绑定。禁止把“加密blob但解密key也以明文在同一Flash”当物理保护。不可逆eFuse操作不包含在本方案的授权中。

### 4.4 时间、轮换与撤销

- 证书验证需要可信有效时间。本地已有SNTP调用不等于可信时间来源。首次通过受信USB提供时间并建立允许的时间边界；冷启动无法确认有效时间时fail closed，提示需恢复时间。不得跳过证书有效期或因IP变化关校验；需要自动无USB冷启动的后续方案必须另评可信时间来源。
- root/设备证书更换走现有认证连接+设备确认，双代pending→验证→切换，有界重叠窗口，失败继续旧绑定；旧设备身份丢失不允许靠LAN重新绑定覆盖。证书过期且无可信通道时走物理恢复，不自动接受自签名新证书。
- 撤销先hub冻结、关闭旧TLS并阻止新请求，再通知设备持久递增binding_epoch。回执缺失保留revocation_unconfirmed，不以TLS失败当撤销已证实。撤销摘要回执恢复通道只能用于同operation的收敛，不能复活命令/旧凭据；具体受信查询仍待离线负测。

## 5. HTTP映射候选（未开放）

HTTPS单一origin，路径前缀`/hub-device/v1`；所有业务端点mTLS且通过登记白名单。协议版本、boot/session/control等仍使用hub-device/1信封，不能只靠HTTP200判断业务。设备身份来源是TLS peer映射，不信任URL/header里的device_id。

| 路径 | 方法/作用 | 限制 |
| --- | --- | --- |
| /hello | POST认证后的能力/boot协商 | 本profile最大JSON4096B，未知必需字段/超深对象拒绝 |
| /exchange | POST回执/心跳/续租请求，响应返回目标/控制请求 | 单设备串行，空闲500ms一次，心跳5秒；最大请求/响应均4096B；响应携带H→D的acquire/renew请求，设备下一POST返回grant/结果，hub不能替设备授予租约 |
| /manifests/<sha256> | GET已授权角色变体目录 | 按上限分段读取到受限PSRAM；首版只支持已审核本地目录，禁止任意URL |
| /assets/<sha256> | GET带单Range | 每段≤32768B、stream read缓冲4096B，不额外分配整段副本 |

目录与命令的认证来源一致；先授权manifest、尺寸/编码/asset长度，再下载。asset路由只按校验摘要查表，不拼磁盘任意路径。TLS负责传输保护，完整SHA-256仍负责整素材校验，不可省略。

Range固定206与正确Content-Range/Content-Length，不接收服务器无视Range返回整文件，不接受chunked/多range/压缩传输/重定向/跨origin。If-Range/ETag必须与已授权SHA一致；若文件代数改变就丢弃未完成候选。首版只在当前同manifest的连续内存下载内续段，不承诺断电续传。

分段间优先处理控制/心跳；一段请求最多阻塞1000ms目标、连续数据停顿500ms目标，超时销毁连接并退避，连接不可用期间不伪造心跳。32KiB段在低吞吐网络下未必满足目标，要实测后调整段大小/超时。单次read timeout不能证明整段最坏时延。TLS握手预算单独最多10秒，进专用任务且不能持显示锁。失败继续已验证缓存，不降回明文v4。

## 6. 控制代数与时钟落地

设备仍最终仲裁control_epoch并持久提交后granted；lease由设备自己的单调时钟计算，线上的grant只含lease_ms，不传S1模型expires_at。hub在原请求发送时记录本地单调时间，以生成时剩余TTL扣除漂移和最坏命令延迟预算，收包时检查RTT和固定截止点，不从收包时续满；设备拒绝的最终权威优先。seq/epoch按十进制uint64字符串，固件有界解析，拒绝溢出。

候选`native360-v5-lease/1`的4KiB canonical编码/解码已离线接入guard/Registry相对路径，仅传剩余TTL；旧同钟模型仍要求expires_at。现行固件v5没有该管理语义，生产报告转换/互操作仍未实现，见[契约](offline-auth-v5.md)。500ms轮询加1000ms段阻塞不能用B1000预算；含额外假设项的离线示例B1900/RTT3802已验证，不代替实测。

TLS断开立即使该session无权控制，重连后重新认证/hello/acquire；不能因为HTTP复用或相同证书直接复用旧lease。实际首帧回执来自具体profile的显示提交钩子，不能把当前v4或模拟frame事件直接接成新协议playing。

## 7. 准入顺序

A. 承载评审已完成接口/资源/方案，保持deviceTransport=false。
B. 离线证书/报文负例、独立时钟与bounded TTL decoder已完成，见[报告](../reports/2026-10-30-offline-auth-v5.md)，无设备/监听；生产TLS peer映射未完成。
C. 已获授权并完成独立Node loopback TLS互操作，证书拒绝/撤销/Range及正常/取消清理通过，见[报告](../reports/2026-10-30-loopback-mtls.md)。仍无生产listener或实物，不证明ESP内存可用。后续临时[统一绑定/会话与注入休眠恢复](session-consistency.md)也已验证，后续[UDS赢家review装配、macOS观察源及managed回收](service-power-capacity.md)已验证，设备侧及真实物理电源时序仍待接入/验证。
D. 固件仓库独立Spec/Diff与明确恢复物审核通过后，才申请RAM TLS资源探针的构建/刷写/设备操作授权。
E. 达到[资源门槛及恢复门槛](../context/plans/transport-auth-device-gates.md)后才做永久绑定/一块板控制；BLE、跨平台和多实物后续再验。
