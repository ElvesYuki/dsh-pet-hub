# 离线认证映射、证书负例与v5期限 Spec（实现前）

状态：先行文档对应的离线切片已实施并验证（2026-10-30），见[报告](../../reports/2026-10-30-offline-auth-v5.md)。保留以下实施前范围供追溯；没有TLS握手/监听或固件改动。

2026-10-30。仅离线进程内验证：不监听网络、不接设备、不改固件/pet/bridge/DSH配置，不安装/提交/推送。已读开发/上下文规则，保留并行动画。新代码MIT、无第三方依赖。

## 认证边界

runtime新增离线证书/私钥持有/报文校验适配器，使用Node X509Certificate/crypto。只支持明确的单根→叶证书profile：P-256、ECDSA-SHA256、有效时间、CA约束、叶clientAuth用途及显式证书SHA白名单映射。证书CN/JSON device_id不选绑定。每次消息重查绑定state、credential_epoch、fingerprint、context，撤销/轮换即拒绝。缺可信wall time拒绝，单调租约时钟与证书wall time分开。不是通用PKIX路径构造/CRL/OCSP，不自动改OS信任库。

仅有公开证书不足以授权；离线fixture用随机挑战+完整context的私钥签名建立不可序列化会话，再用会话挑战域和原始消息签名绑定报文。此为离线密码学证明工具，不新增生产应用签名协议，不代替mTLS握手/机密性/实际TLS peer映射。未来TLS adapter须从已认证连接提供同等级proof，不能接受authenticated布尔。挑战最多32、会话16，5秒过期，close幂等清状态；原始私钥只在测试临时目录，退出清理，不进Git/日志。

## v5管理候选wire

新增strict canonical JSON租约回执profile native360-v5-lease/1（hub-device/1逻辑协议；不是现有固件v5已支持）。最多4096字节，UTF-8、确定key排序/编码；非canonical、重复key、未知字段/版本、坏uint64、路径/URL/绝对expires_at均拒绝。设备侧编码必须取生成时actual_remaining=expires_at-device.now，不能从host接收时续满。

wire控制身份仅controller/service/control_epoch/lease_id，TTL单独lease_ms；转换为既有guard packet保留该身份且不伪造expires_at。core guard/Registry相对模式允许缺省expires_at，旧同钟模型仍要求绝对到期值，原fixture兼容。DeviceModel本地仍用自身完整grant；报告出wire须同样去掉绝对字段。本轮不迁移固件/生产transport。

## 延迟核对

复用现有500ms轮询、1000ms不可抢占分段设计目标，以显式queue/segment/poll/network/process分别相加计算命令B；对应请求及返回两段分别求和得到保守RTT。构造多种分段相位/到达时刻的串行离线调度，检查所得上界。上一示例B1000不能覆盖500+1000，更不能遗漏排队/网络/处理；新样例预留这些项后再调用已验证漂移预算。全部数值仍为设计假设，不是吞吐/设备实测；不确定或越预算拒绝。

## 验证/回退

临时OpenSSL生成测试CA/叶证书及私钥，Node离线验真实签名，OpenSSL verify -purpose作独立交叉检查。负例：错CA/用途/CA叶/未登记同CN/有效期/缺可信时间/错误签名/篡改/过期挑战/旧会话/撤销/credential轮换；报文大小/非法UTF8/重复字段/未知版本/absolute TTL；真实密码学proof→v5 decoder→lease guard→Registry及DeviceModel当前目标验证。运行check/test，core期限表示变更另跑SIM与双时钟。无UI/素材变化，不重复长测或浏览器。

完成更新当前摘要和待办，把被替代的“仅合成proof/无v5表示”片段归档；保留TLS/固件/实测/Flash/v5其他接口未验。回退关闭离线会话、删除本次temp并撤回新代码，无用户状态迁移，不清既有配置或缓存。
