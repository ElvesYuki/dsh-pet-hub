# 离线认证、证书负例与v5期限验证

2026-10-30。已先补[Spec](../context/plans/offline-auth-v5-spec.md)/[Diff](../context/plans/offline-auth-v5-diff.md)，实现与边界见[协议](../protocol/offline-auth-v5.md)。全程离线，不接真实设备、不改固件/pet/桥接/DSH配置、不安装启用插件、不提交推送，保留并行动画修改。

## 结果与实现

- runtime通过Node X509/crypto校验临时真实P-256证书、私钥随机挑战和原始报文签名，显式CA/证书指纹→binding/credential_epoch→完整会话→opaque proof→guard。每次消息及guard提交前重查凭据、撤销、可信时间与上下文。
- 候选`native360-v5-lease/1`严格4KiB canonical UTF-8编码/解码已接通相对Registry路径；wire不含expires_at，TTL在设备模型生成报文时采样。旧同钟行为保持，默认服务未装配该路径。
- 显式核对排队、轮询、素材段、网络与处理预算：假设100+1000+500+200+100=1900ms，121相位样本通过；500ppm host下两腿RTT取3802个本地毫秒。15秒TTL、双端500ppm、margin10得到发送跨度13074ms，旧1000ms B不适用。没有实测网络或漂移。

证书CA负例揭示仅检查Node `cert.ca`不足：CA:true且KU冲突的叶不一定由该属性标为CA。因此增加有界DER扩展检查，明确拒绝CA:true、非digitalSignature KU、重复/未知critical扩展；不是通用PKIX实现。

## 只读现行v5核对

只读取外部源码与公开对接文档，未执行固件脚本或导入模块。相对固件仓库路径及本次SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| docs/protocol/pet-hub-firmware-contract.md | 23044028bf2f28c6fb25ed3c0be7091168dbb61f0f32067612793c273fff87ff |
| apps/round-pet/main/pet_native360_main.cpp | 7bd133f1eacf9b8ab6dd624135399af3d65099cf15723279776b92f3862d91da |

production源码request()约391行：Bearer、每请求init/cleanup、timeout_ms=3000。状态任务约476–525行：`/v5/state`文本action/revision/hint，循环末尾vTaskDelay300ms（不是保证周期）；catalog/touch/played请求也会占时。下载约631–669行：完整`/v5/asset/id`，每次read≤16384B，循环60秒总时限检查，未采用32KiB Range管理分段。对接文档明确现行v5没有完整device/boot/session/lease语义；故本轮TTL profile属于管理候选，不能当作固件互操作通过。源码可能继续变化，部署SHA/分区仍须实物前冻结。

## 验证证据

Node24.14.1/npm11.11.0，Node内置crypto/OpenSSL3.5.5；临时证书生成/独立用途检查使用本机LibreSSL3.3.6 openssl CLI。未增加npm依赖；运行这些PKI测试需要该CLI，换实现/平台须重验命令兼容。

| 检查 | 结果 |
| --- | --- |
| npm run check（仅.mjs语法） | 通过 |
| npm test（含候选构建） | 270/270通过 |
| 本轮认证/wire/延迟用例 | 12/12通过，包含在全套内 |
| SIM-01–30及补充 | 30/30＋4证据通过 |
| 独立双时钟回归 | 13/13通过 |
| 既有租约预算回归 | 11/11；768参数/2368速率边界通过 |

12条用例覆盖真实私钥持有及报文完整性、错误CA/用途/CA叶/KU/未知critical/坏证书/尾随DER与PEM拒绝/未登记同CN、缺可信时间及证书过期/未生效、服务SAN不匹配、错密钥/挑战重放和过期、会话伪造/关闭、撤销与credential轮换、篡改/旧context/伪造proof、坏UTF-8/超长/重复字段/未知版本/绝对期限/坏uint64、延迟TTL不续满、32挑战/16会话容量及close回收、分段/轮询预算。OpenSSL verify -purpose独立交叉检查客户端/服务端正例及错用途/CA/KU/critical负例；没有对所有自定义绑定语义作独立实现交叉验证。

命令：`node scripts/verify-offline-auth-v5.mjs --output .cache/offline-auth-v5/results.json`；另运行verify-dual-clock和verify-lease-budget回归到同一忽略目录。摘要复用测试，不是额外独立覆盖。临时PKI目录及私钥退出时删除，日志/证据不保存私钥、证书原文、签名或原始设备状态；Git仅包含生成fixture代码。未重跑未受影响的浏览器/真实素材/30分钟测量。

## 未覆盖、回退与下一入口

未执行TLS握手/监听，未验证真实TLS peer授权、ESP内存峰值/可信时间/持久凭据、休眠自动失效、物理延迟/漂移、Range互操作或生产固件TTL生成/报告转换。离线签名工具不提供传输机密性，不作为生产应用认证协议；直接根profile不支持中间CA、通用路径构造或CRL/OCSP。测试证明已批准凭据的密码学持有和消息关联，不证明批准过程、设备逻辑或时钟来源可信。

默认路径保持deviceTransport=false。回退关闭离线auth/guard、删除本轮私有输出并撤回新增模块，无配置/数据迁移，不碰现有服务。下一入口为先补独立loopback mTLS互操作具体方案及回退，再检验真实peer/绑定/Range；资源准入仍NO_GO_UNTIL_MEASURED，实物操作与固件修改需另行授权。被替代的当前片段见[归档](../context/history/offline-auth-v5-evolution.md)。
