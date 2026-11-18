# 1.75C 持久绑定与自动重连 Spec

2026-11-13。管理端独立串口候选已通过 PTY。设备与管理端当前源码采用类型 132 和 bit 1 隔离首绑应答。带拆分协议的固件产物、凭据持久化和真机待验。[线上帧评审](../../protocol/native400-pbp1-persistent-wire-review.md)

## 身份、凭据与所有权

- 单实例 runtime 拥有绑定和签名。DSH 插件与独立桌面界面共用该实例，经既有权限 IPC 请求绑定、查看状态或解绑。PMA1 的 `hub` 对应 PBP1 `controller`，是安装实例首次配置时生成的稳定随机 16 B ID。每个新绑定使用独立随机 `binding` ID 与 P-256 密钥。`device` 固定到用户选择的物理设备和 USB 对端返回的 ID。现固件用 `SHA256(ASCII("PBP1/device/v1") || eFuse 默认 MAC)[0..16)`；建议持久候选沿用。ID 为非零 16 B，传输原始字节。`epoch` 为非零 uint64，JSON 用规范十进制字符串。建议设备保留解绑代数高水位并在重绑时递增，溢出关闭该流程。ID 兼容性和高水位持久布局待固件确认。
- 管理端保存独立版本的私有绑定索引。记录 `{device, controller, binding, epoch, publicKey, keyRef, phase}`、并发 revision 和必要的待恢复意图。复用既有单实例、CAS、私有权限、原子替换与文件／目录同步策略。现有 `binding-store.mjs` 的证书 schema 服务于历史承载，`native400-tcp-binding.mjs` 管理素材绑定，两者的记录都不承载此凭据。
- macOS 产品候选用签名用户态辅助进程经 Security.framework 创建常驻 P-256 私钥，按本地 `binding` 查 Keychain 引用，向 Node 返回未压缩公钥和签名。辅助进程只为既定协议域与匹配绑定的结构化请求签名。拟采用 Data Protection Keychain、应用签名授权的访问组和设备本地、不 iCloud 同步的 key item。稳定的签名身份、签名升级、锁屏、Keychain 锁定及用户会话权限均待宿主验证。后台签名路径遇交互要求、权限变化或暂不可用即报明确状态，等待用户恢复后续接。首个宿主切片可用独立测试签名提供者。私钥不进入 JSON、IPC、命令行或日志。Linux／Windows 凭据后端暂未定义。[Apple TN3137](https://developer.apple.com/documentation/technotes/tn3137-on-mac-keychains) · [本地 Keychain 选项](https://developer.apple.com/documentation/security/ksecusedataprotectionkeychain) · [签名算法](https://developer.apple.com/documentation/security/seckeyalgorithm/ecdsasignaturemessagex962sha256)

## 首绑、恢复与解绑

1. USB 独占读取持久绑定能力、设备 ID、当前 boot 及绑定状态。首次绑定须显式操作。先用 CAS 落 `pending_enroll` 和稳定 `keyRef`，创建或按同一引用查回私钥并记录公钥，再发送绑定提议。系统钥匙串和索引是分开的提交点，启动时按待处理阶段及设备读回对账。待确认或提交结果未知时保留原 ID 和密钥引用。
2. 首绑签名覆盖设备发的一次性挑战与完整提议。设备验签后显示本次提议对应的提示，窗口内要求一个新的 BOOT 短按。建议沿用现有 15 s 实体窗口，按钮不能消费验签前的按键。设备原子持久提交并读回后发布已绑定状态。回执丢失后读取同一元组及公钥摘要，再以原密钥完成新挑战签名；成功后 CAS 提升为 `bound`。设备报告冲突、坏记录或只读故障时等待显式处理。未收到按键、错键、拒绝或过期均不能让设备自动采用别的提议。
3. 同一管理端重启、设备重启或 Wi-Fi 断线后，重新走可信 USB、现存绑定核对与新挑战。每轮生成独立的 32 B CSPRNG 会话 PSK，经可信 USB 发送并在签名中绑定 SHA-256。设备仅为当前 boot、完整已绑定元组和未过期的一次性挑战接受签名。BOOT 和挑战均需新鲜，期限由设备单调时钟判定。提议一次仅一个，接受精确作用域的首次证明后消耗挑战，失败也不得用同一挑战继续尝试签名。限速、清理与定时数值待双方确认。USB 依然是信任边界，链路上可读取 PSK 的对手超出本设计防护范围。
4. 发布本轮 RAM 租用前，管理端验证设备的 `ACTIVE` 绑定、boot、proposal、fingerprint 与基于本轮 PSK 的回执 HMAC，并等待独占 USB 事务实际退出。断线时先撤销本地租用并完成旧 I/O 清理。设备须明确允许新租用后才重做挑战。确认丢失时优先做只读查询验证原回执；丢失本轮 RAM PSK 时只在设备确认旧租用退出或过期后用新挑战，禁止跨代接受旧回执。管理端进程退出后 USB 线可能仍连接，设备侧应有空闲租用到期或验签后的原子替换机制，且维护在途时应返回 busy。重连只恢复认证与当前操作可用性。现有 USB ARM 仍限定原 boot、proposal、PSK 与确切 BEGIN，每笔操作独立审批；旧 `Unknown` 写入结果保持 Unknown，按现有受支持的读回路径恢复，不能自动重发 ARM、BEGIN 或宣告 Saved。现有 LAN 入口没有跨 boot 收据查询能力。阶段一自动续接需要可信 USB 仍可达。
5. 解绑在设备侧独立本地确认，私钥丢失时也可进入该流程。确认后设备先阻止新挑战和 ARM、撤销现存租用，待在途维护退出再提交解绑及代数高水位。管理端只在可信 USB 读回精确解绑结果后删除本地 Keychain 项并完成索引转换。设备不可达时可在本地冻结绑定，显示设备解绑待确认。重绑必须重新走本地按键和新 ID／密钥，不自动覆盖已有绑定。换 Wi-Fi 仍由当前 RAM 引导更新，不推进绑定代数。

## 签名输入和回执向量

以下是双方宿主已核对的签名输入。外层 PBP1 的编号、能力位、布局和错误码以新草案为对拍起点。沿用 PBP1 的 16 B 帧头、长度和 CRC 规则。普通 INFO、临时 OFFER、CONFIRM、CANCEL、STATE 和 LAN ARM 的现有字节保留。旧适配器遇未识别类型应拒绝。新能力须由固件明确宣告，缺能力的设备只能从显式 legacy 入口使用临时 PBP1。

```text
scope = device16 || controller16 || binding16 || LE64(epoch) || LE64(boot) || challenge32
enroll_input = ASCII("PBP1/persist/enroll/v1") || scope || public_key65
resume_input = ASCII("PBP1/persist/resume/v1") || scope || SHA256(session_psk32)
active_input = ASCII("PBP1/persist/active/v1") || SHA256(resume_input) || LE32(proposal) || fingerprint16
active_tag = HMAC-SHA256(session_psk32, active_input)
```

ASCII 无终止符，`challenge32` 来自设备 CSPRNG，`public_key65` 为 SEC1 `04 || X32 || Y32`，坐标大端。签名为 ECDSA P-256／SHA-256，线上采用固定 64 B `r32 || s32`（各自大端），要求 `1 <= r,s < n`。辅助进程可把 Security.framework 的 X9.62 DER 结果严格解析并转换；Node 宿主可用 `ieee-p1363`。验签对完整 transcript 做一次 SHA-256，摘要接口直接接摘要。接受 ECDSA 合法的两种 S 表示，去重依据是当前挑战消费状态。`proposal` 为本 boot 由设备分配的非零 u32，`fingerprint16` 按既有 PBP1 公式从该 proposal、boot、完整元组和新 PSK 派生。`active_tag` 比较完整 32 B。首绑后走同一 resume 流程以便复用租用和 ARM 对接。

[公开合成签名与回执向量](../../protocol/vectors/native400-pbp1-persistent-draft-v1.json)仅使用测试用公开已知标量和合成 PSK。Node 生成并验签，LibreSSL 独立验两条签名和 ACTIVE HMAC。ECDSA 重新签名可以产生不同的有效字节。固件侧宿主 C++ 已对拍 transcript 与 ACTIVE HMAC，线上帧仍待共同对拍。

## 固件待确认与回退

- 共同冻结能力探测和外层帧。草案类型 8 从挑战快照重建 device、boot 和 challenge，在原 169 B 提议字段前加 4 B 引用，全帧 189 B。明确 129 查询和首绑应答关联、ACTIVE 的租用 scope 如何接回旧 LAN ARM 的 `STATE`，以及 Busy、挑战过期、解绑和丢回执规则。
- 固件在现有 NVS 内验证独立记录、绑定/解绑持久提交、断电恢复和空间不足；确认 NVS 解禁范围、STA 仍用 RAM、签名和写入资源及播放停顿，完成宿主 Node/C++ 对拍和独立实板窗口。主机及设备共同核对有界重连、冷启动、Wi-Fi 断开、签名服务失联及原 I/O 退出。跨 boot 维护结果另需可信库存或读回证据。
- 首个持久候选默认关闭。回退停用候选并关停该实例的 USB 和 RAM 租用，保留索引及 Keychain 项供恢复。持久态与旧临时态显式切换，禁止检测失败后降级。真机回退沿固件任务的应用槽与记录级备份方案执行，保留素材分区和既有回退；已解绑的记录不可因恢复旧 NVS 副本而自动复活。旧固件忽略持久记录时不具备持久绑定保护，不应以原绑定的名义开启临时维护。
