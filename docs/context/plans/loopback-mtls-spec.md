# 独立loopback mTLS互操作 Spec（实施前）

状态：先行方案已在2026-10-30实施并验证，见[报告](../../reports/2026-10-30-loopback-mtls.md)。下文保留执行前范围，正式服务/ESP未接入。

2026-10-30。用户已授权本切片：先明确方案/回退，再在独立临时环境执行真实loopback TLS。保持零npm依赖、Node24.14.1；不接设备、不读运行凭据、不改固件/pet/bridge/DSH配置、不装插件、不提交推送。不使用子智能体，保留并行动画工作。

## 目标与不变量

从真实Node HTTPS/TLSSocket取得已授权peer证书，固定私有CA、证书profile、指纹白名单及绑定代数，连接关联完整context后生成opaque proof。真实TLS proof进入Registry.connect及lease guard；不得调用上一切片的离线签名挑战来冒充TLS身份，不从URL/header/JSON布尔赋予设备身份。复用既有证书profile和严格TTL decoder，避免复制认证规则。

固定TLS1.2、ECDHE-ECDSA-AES128-GCM-SHA256、P-256、HTTP/1.1。服务端requestCert/rejectUnauthorized；客户端显式CA、servername/SAN校验、rejectUnauthorized。禁用TLS tickets，resumeSession拒绝恢复，并拒绝任何isSessionReused连接；每次建立新连接必须重新hello，不沿用旧boot/session/lease。profile只支持直接根→叶，无通用PKIX/CRL/OCSP。

绑定记录由受信lookup按证书DER SHA256查找；逐请求及proof提交前复核bound、指纹、binding_id/epoch、controller_id、credential_epoch及可信wall时间。JSON device_id只有匹配已批准peer映射后才可使用。本地controller/service_instance必须匹配；每socket只建立一个固定context；新context须新TLS连接。撤销先修改绑定并关闭关联socket、失效guard/Registry；即使漏掉主动通知，下一请求/proof检查也必须拒绝。撤销不伪造设备已持久确认。

## 具体执行方案

1. 复用临时PKI fixture，根与叶私钥只存在私有mkdtemp目录/测试进程，新增仅内存PEM转换用于Node TLS，不修改OS信任库。证书生成子进程有期限且退出清理。
2. 独立测试fixture创建HTTPS server，仅listen(0,'127.0.0.1')，禁止通配/LAN接口；端口只保留内存，不进日志/报告。没有启动正式hub、DSH、bridge或插件。
3. 临时client Agent仅连接同一literal loopback端口，SNI/验证名为hub.test.invalid，不DNS解析该名字；每Agent最多1 socket、每连接1请求在途、无自动重试/跳转。
4. 固定测试白名单POST /hub-device/v1/hello、POST /hub-device/v1/exchange、GET /hub-device/v1/assets/<sha256>。hello/exchange≤4096B，严格字段；资产由合成内存摘要表授权，不拼磁盘路径或外部URL。
5. 验证实际peer→绑定→Registry，再通过真实TLS传递候选TTL回执→opaque proof→guard。控制设备仍是离线模型，不能称生产固件通信/设备认证已上线。
6. 用约70KiB原创字节资产验证单Range分段≤32768B、每次写≤4096B、206/Content-Range/Content-Length/强ETag及If-Range、最终SHA。拒绝整文件200、重定向、chunked、gzip、多Range、超范围、坏长度/摘要/ETag、截断及超时；失败不发布候选或覆盖旧actual。
7. 测试已连接撤销、credential轮换、旧proof/旧context、分段间撤销及传输中取消；socket close也触发当前会话失效。已提交TCP字节无法撤回，不宣称撤销可删除已接收素材。
8. 每个fixture拥有server、socket集合、Agent、请求deadline和PKI；握手/HTTP请求有界（测试整体deadline≤30秒），最多16活跃认证连接、记忆256个device/session且满时拒绝，未认证连接由server上限/握手期限约束。不导出keylog、原始证书/响应、端口或本机路径。

## 验收与失败路径

先运行专用Node测试；正例核对实际协议/套件、authorized、非恢复连接、keepalive复用和证书映射。负例包括无证书/错CA/用途/服务名/未登记叶、TLS版本或套件不匹配、伪造device/context、撤销/凭据轮换/可信时间丢失、Range和报文边界、截断/超时/资源关闭。测试错误只记录稳定分类，不输出秘密。运行npm run check和npm test（含构建）；无core行为修改则不机械重跑素材/浏览器/30分钟测量。

不能把loopback耗时当1900ms命令上界或500ppm实测，不作ESP TLS内存、Flash/密钥/可信时间/BLE结论。当前固件v5没有该管理租约，deviceTransport=false继续保持。

## 回退与收尾（执行前已明确）

正常/失败/取消都先停止新请求、销毁本轮Agent及在途请求/自有socket，再关闭并await本轮server，失效auth/proof/guard/Registry，最后删除本轮临时PKI。关闭幂等，清理断言listener=false、socket=0、request/timer=0、临时目录不存在。验证CLI由独立测试子进程承载并有总超时，必要时终止该自有POSIX进程组（含测试worker/openssl）；不按端口查杀其他进程。仅忽略目录保存去敏结果摘要。

撤回本切片模块/测试即可回退，无已有持久数据迁移，不删除旧绑定/角色/缓存，不调整任何现有服务。执行后直接更新当前摘要/待办并归档“尚无TLS握手”的被替代范围，保留生产与实物限制。
