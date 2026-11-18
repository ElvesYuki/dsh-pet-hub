# 离线认证与v5管理候选期限

2026-10-30。本仓库进程内验证已实现，依据[Spec](../context/plans/offline-auth-v5-spec.md)/[Diff](../context/plans/offline-auth-v5-diff.md)，结果见[报告](../reports/2026-10-30-offline-auth-v5.md)。不监听网络、不装配默认服务、不改现行v5固件。`native360-v5-lease/1`是候选管理profile名称，不表示现行`/v5/*`已支持租约。

## 身份、凭据与证明

`createOfflineLeaseAuth({rootDER,lookupBinding,now,clock})`是runtime离线密码学工具。根由调用方显式固定；只接受单根直接签发的P-256/ECDSA-SHA256叶证书，不查OS信任库。根/叶都按`now()`提供的可信wall毫秒检查有效期，未知时间拒绝。叶必须明确CA=false、Key Usage仅digitalSignature、EKU仅clientAuth；检查重复扩展、未知critical扩展。服务证书对应serverAuth及精确DNS SAN，不回退CN或通配符。DER各≤4096B，拒绝PEM或尾随数据；这是宿主验证上限，不能代替设备证书≤1024B的候选资源门槛。

`lookupBinding(device_id)`是受信注入边界，必须返回已批准的bound记录，包含certificate_sha256（DER摘要）、binding_id/binding_epoch、controller_id及credential_epoch。请求context只用于定位候选，证书指纹及记录必须一致才授权；同CN、同CA、JSON自报device_id都不能单独赋予身份。boot/session与service_instance由受信装配生成并绑定挑战，guard再核对Registry当前上下文；证书本身不证明boot/session仍有效。

`challenge(context)`生成256位随机挑战及完整context待签名字节，32个pending、单调5秒有效；成功认证后消费，返回不可序列化session。`authenticate(id,DER,signature)`验证私钥持有，最多16个session，满时拒绝而不踢活跃会话。`attest(session,bytes,signature)`重新检查凭据、绑定/撤销、时间和代数，先复制原始字节再验签/严格解码，产生不可序列化proof。guard通过`verifyResponse`再次检查session、完整packet和context，验证失败不更新确认或actual。断线用disconnect释放session，close幂等清所有pending/session；过期pending由后续challenge清理，不开后台定时器。

签名域为离线挑战及报文工具专用。它验证真实证书和私钥签名，**没有执行TLS握手、提供机密性或实现生产TLS peer映射**，不得部署为另一套自制认证协议。不是通用PKIX路径构造：中间CA、name constraints、CRL/OCSP、系统证书存储均不支持；撤销来自本地绑定记录。墙钟来源的可信建立、系统休眠/速率越界检测与统一失效装配仍待实现。恢复时应撤销旧session/proof、guard与Registry会话再重新认证，不能继续使用停钟前的租约。

## 候选报文与模型转换

`encodeLeaseV5({context,request,grant,device_now})`从设备自身grant取`expires_at-device_now`，过期或TTL超过30000拒绝。wire仅包含：

```text
protocol=hub-device/1, profile=native360-v5-lease/1, type=lease.granted
request_id, request_seq, kind=acquire|renew
context={device_id,binding_id,binding_epoch,boot_id,session_id,controller_id,service_instance_id}
control={controller_id,service_instance_id,control_epoch,lease_id}
lease_ms=生成响应时的实际剩余设备单调毫秒
```

`decodeLeaseV5(bytes)`只接受≤4096B的严格UTF-8与canonical JSON：递归对象key排序、无额外空白；schema固定，uint64保持十进制字符串。重复key、未知字段/版本、绝对expires_at、坏UTF-8及非canonical编码拒绝。先校验有界固定schema再canonical比较，不接收任意深结构。输出既有guard packet，control变为grant，没有绝对到期字段。

Registry/guard相对观察模式允许grant无expires_at；旧同钟模式仍要求expires_at，DeviceModel内部仍保留自身绝对期限。模型报告转管理wire时同样去除expires_at；本次测试显式完成此转换，尚未新增生产报告编码器。host保守截止始终从原request.sent_at加漂移/命令余量预算计算，不能按收包时间续满。signed TTL不保证设备逻辑正确，设备仍是租约/epoch最终仲裁者。

## 轮询、素材与延迟

管理承载候选为单连接串行、空闲轮询500ms、Range每段≤32768B、读缓冲4096B、单段阻塞目标≤1000ms。这些是[承载设计](device-transport-auth-v1.md)，没有在现行v5或实物上证明。当前v5源码反而是300ms循环末尾等待、每请求新建handle、整文件下载，不能把它代入该管理调度模型。

`leaseDelayBudget(parts,{host_ppm})`要求明确queue/segment/poll/network/process五项非负真实毫秒上限，求和为命令B。为离线对称两腿模型，每腿取同一保守和；RTT换算为最快host本地毫秒`ceil(2*B*(1000000+host_ppm)/1000000)`。生产若两腿不同、额外阻塞或排队无界，必须重新建模并拒绝旧预算。

| 假设项 | 毫秒 |
| --- | ---: |
| hub排队 | 100 |
| 不可抢占分段 | 1000 |
| 等待轮询 | 500 |
| 网络/重传 | 200 |
| 设备处理至校验 | 100 |
| 命令B合计 | 1900 |

121个分段余量/轮询相位离散样本最大1900ms；这是求和模型的检查，不是网络调度实测。500ppm双端、15秒设备TTL、margin10时，RTT上限3802个host毫秒，保守发送跨度13074个host毫秒（从发送请求算起）。旧B1000示例不能覆盖该模型。32KiB段满足1000ms仅正文就需≥32KiB/s，还要为协议、调度和重传留余量；不得将平均吞吐或socket read timeout当最坏整段界限。超时/断线/未知上界必须失效并重连，新TLS握手不偷偷计入已认证续租。

## 回退及下一入口

模块只由离线测试/验证CLI引用，默认deviceTransport=false，无持久格式迁移。关闭auth与guard、清本轮临时PKI/输出即可回退；不删绑定、角色或现有缓存，不调整现有服务。

后续[独立loopback mTLS](loopback-mtls.md)已按先行方案完成固定TLS1.2、临时私有CA/动态端口、真实peer→绑定→proof、撤销与Range负例及正常/取消清理。本文件描述的签名工具仍是独立离线路径；临时[绑定/会话owner与注入休眠](session-consistency.md)已有后续实现，后续[服务review装配与macOS观察源](service-power-capacity.md)已接入，生产设备listener与物理电源时序仍未验，ESP可信时间/密钥存储/TLS峰值与漂移时延实测门槛保持，NO_GO_UNTIL_MEASURED。
