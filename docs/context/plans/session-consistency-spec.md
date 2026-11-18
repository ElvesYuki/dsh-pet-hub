# 绑定与会话一致性 Spec（实现前）

状态：先行切片已于2026-10-30在临时存储/虚拟时钟/loopback实现并验证，见[报告](../../reports/2026-10-30-session-consistency.md)。以下保留实施前范围，正式服务与设备未接入。

2026-10-30。用户授权统一元数据、失效顺序、hello/重连及休眠/故障恢复；只用临时存储、虚拟时钟、独立loopback TLS。不接设备、不改固件/pet/bridge/DSH，不装插件/提交/推送，不用子智能体，保留并行角色工作。新代码MIT，零npm依赖。

## 已确认根因与边界

现有fixture的认证白名单与Registry MemoryStore分离；Registry.disconnect要求bound，不能直接用于已撤销记录；hello.context为fixture提供，尚无hub挑战协商。mTLS、严格TTL/Range与保守预算已完成，不重复认证算法。本轮不实现系统Keychain、真实配对/证书签发、OS休眠检测、生产listener或固件协议。

## 单一绑定权威

runtime新增显式目录的hub-bindings/1元数据文件。内容schemaVersion=1、uint64 revision、最多64个bindings；每条包含device/binding/controller/identity_ref、binding_epoch、credential_epoch、证书DER SHA256、state、mapping，pending_revocation含operation_id。不存私钥、证书正文、网络或运行端口。Registry读取与TLS指纹查询使用同一份内容，不保留独立批准表。

严格schema/大小/摘要、私有目录/文件/拒绝symlink；初始化必须显式create，不对缺失/坏档静默重建。提交使用短期独占写锁、重新读取revision做CAS、临时文件fsync→rename→目录fsync；调用成功才表示宿主提交确认，不代表物理掉电已测。普通Registry commit只能改mapping，注册、撤销、轮换走显式控制面接口。指纹唯一、代数不回退，普通Registry.bind不能绕过凭据审批。

撤销先校验预期revision并冻结当前进程准入、失效会话，再落盘pending_revocation及operation_id。写前失败不报成功、当前进程保持冻结；提交前崩溃未确认的操作不承诺跨重启撤销。rename后失败返回commit_unknown并冻结整个存储准入，不能盲重试；重新打开并核对持久operation后才能确认。已提交pending记录重启继续拒绝，不伪造设备持久撤销确认。轮换必须提升credential_epoch并清旧会话，成功后才允许新握手。坏档或遗留写锁都fail closed，不自动擦除/重置；已知退出的本轮故障子进程，其临时锁仅由测试父进程明确清理后验证恢复。

## 会话所有者与失效顺序

runtime会话协调器独占auth、Registry、guard、challenge、在途任务，service_instance_id每实例随机生成。Registry新增受信invalidate(context)：不要求bound、按完整现有会话匹配、幂等；旧close不能断开新会话。普通业务仍核对当前存储binding_id/epoch和准入。原disconnect与同钟模拟契约保持兼容。

失效先移除当前有效会话/提升本地代数，删除对应挑战并取消有界在途任务；再失效guard、Registry、auth/socket。回调可重复，不递归清新会话。每设备只一个有效会话，64设备、32待挑战、每会话8任务；任务票据不可序列化，结果提交前核对实例/完整context/本地代数、准入、期限及abort状态。断线/撤销保留Registry最后actual；新hello的current actual仍从未知开始，历史观测单独标记，不能当新会话确认。历史观测不做设备持久化。

## hello与重连

在已经完成mTLS的同一socket上，POST hello.begin仅声明boot_id/capabilities，不接受device_id/session/controller自报。hub从真实peer映射绑定，生成随机challenge_id及session_id，返回完整context与当前实例。hello.confirm回显挑战/context，必须同socket、同凭据代数和当前实例，单调5秒内、一次消费；capabilities冻结并验证。TLS已经证明私钥持有，这不是新增应用层签名协议，也不证明物理boot计数。

待定begin重复返回原挑战且不续期限；已成功confirm可在同会话幂等回执，不重建Registry/续租。跨连接、过期、撤销、旧实例或旧boot/context均拒绝。重连先完成新挑战，新session无租约，需重新acquire；旧任务、回执、报告不得迁移。可信peer proof额外绑定Registry hello的boot/session，防止批准一个context却连接另一个。

## 休眠和故障验收

显式注入suspend先停止准入、统一失效所有挑战/会话/任务；resume须有可信时间，重新开放后必须新TLS+hello+acquire。暂停/回拨/跳变不能借恢复延长旧租约。此为注入事件与虚拟时钟验证，不宣称macOS/Electron电源事件或时钟漂移检测已实现。

先专项验证：统一视图/CAS/指纹唯一/权限/坏档/写失败；撤销后失效、迟到close/旧结果、新连接挑战/confirm重放/跨连接/过期/错实例/凭据变化；休眠在host停钟时仍拒绝旧租约、未知可信时间恢复失败；已提交未回执重启、子进程提交切点崩溃及遗留锁安全恢复。复用独立TLS/Range fixture，检查正常/失败/取消资源归零，摘要只进忽略目录。core改动须跑SIM与双时钟/租约回归，并运行check/test。

## 回退

正式服务仍deviceTransport=false。先关闭本轮协调器/Agent/请求/socket/listener，等待本轮子进程退出，再删除本轮临时目录。新元数据无自动旧格式迁移；回退新模块不覆盖旧运行文件。遗留锁/坏档保留并明确拒绝，只有测试父进程清理已证实退出的自有故障子进程临时锁。保留本轮证据摘要，更新当前摘要并按主题归档被替代片段；设备资源/真实时钟/密钥保护/v5/Flash门槛保持。
