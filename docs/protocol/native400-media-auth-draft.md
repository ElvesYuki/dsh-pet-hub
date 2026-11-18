# PMA1 独立 PTM1 维护认证提案

2026-11-11。PTM1 帧与 NOR 提交规则保留，PMA1 在其外层增加互认证、按方向的记录完整性和一次性维修授权。终端已完成 C++ 对拍、认证 TCP/NOR 及正式 sender 联合收据回环。管理端 PBP1 已用模拟 USB 建立同 boot RAM 租用。真实 USB 与 LAN 准入待验。现有 PTC1、DSH/pet、只读 review 和 USB/HTTPS 诊断按原权限运行。[Spec](../context/plans/tcp-media-auth-spec.md) · [共享向量](vectors/native400-media-auth-draft-v1.json) · [运行入口](../reports/2026-11-11-native400-media-auth-sender.md) · [PBP1 配对](native400-pbp1-draft.md)

## 可信配对材料

- 每个 `device_id / controller_id / binding_id / credential_epoch` 使用独立 32 B CSPRNG PSK。ID 各 16 B，epoch 为从 1 起的 u64。可信 USB 使用 PBP1 交换 PSK。宿主核对 HMAC 与提议作用域，设备负责实际确认。管理端新增显式 BOOT 模式，已验证匹配 Active 和同 boot RAM 租用。实体按键、USB、熵源、重启与秘密生命周期待验。[PBP1 按键验证](../reports/2026-11-12-native400-pbp1-button.md)
- hub 只从绑定的秘密存储读取该 PSK，普通配置保存身份与引用。固件核对预配对 controller、绑定及 epoch，hub 同样从本地白名单核对设备。IP、发现广播、nonce、CRC、素材 SHA、旧 bridge token、只读来源或 PTC1 凭据不产生配对信任。不得把密钥暴露给 UI、日志、串口监视器或素材目录。撤销和换代先终止现有会话，再拒绝旧 epoch；端侧未确认时保留待确认状态。配对、存储和撤销装配尚未实现。
- PMA1 提供完整性和对称身份验证。PTM1、设备元数据和素材仍为明文，PSK 泄露可冒充该绑定任一侧，并可从已捕获的握手导出过去的记录密钥。实际 LAN 签核前须接受这一信任模型与明文范围。首轮仅预设绑定，禁止 LAN TOFU、静态共享出厂密钥、短验证码直接作 PSK 和裸 PTM1 降级。

## 线级格式

每条连接只处理 `repair` 或 `query`。数值均为无符号小端，摘要、ID 和 nonce 为原始字节。以下各偏移相对字段所属头或 body，ASCII 标签无 NUL。每条报文先读满 16 B 头，再按类型及长度有界接收。TCP 分段与报文边界无关。

| 头偏移 | 字节 | 字段 |
| --- | ---: | --- |
| 0 | 4 | ASCII `PMA1` |
| 4 | 1 | 版本 `1`，固定，无降级 |
| 5 | 1 | type |
| 6 | 2 | 保留，必须为零 |
| 8 | 4 | seq |
| 12 | 4 | body_len，不含尾部记录标签 |

| type | 报文和方向 | body_len | body 与尾部 |
| ---: | --- | ---: | --- |
| `01` | D_INIT，终端 → hub | 96 | 偏移 0/16/32 为 device/controller/binding，48 为 epoch u64，56 为 `repair=1` 或 `query=2`，57–63 为零，64 为随机 nonceD 32 B |
| `02` | H_CHALLENGE，hub → 终端 | 64 | nonceH 32 B，随后 hub 证明 32 B |
| `03` | D_FINISH，终端 → hub | 32 | device 证明 32 B |
| `10` | GRANT，hub → 终端 | 116 | 见用途决定，末尾另加 32 B 记录标签 |
| `11` | PTM，按 PTM1 方向 | 32–4112 | 一条完整 PTM1 帧，含原头与 CRC，末尾另加 32 B 记录标签 |

### 认证握手

1. 终端连接显式配置的 hub，发送 D_INIT。hub 只从当前启用的绑定和对应本地入口选择 PSK，核对身份、版本和模式。双方为每次连接独立生成 32 B 新随机数，熵不可用即拒绝。握手 seq 固定零，每步只允许一次，握手报文无额外尾部标签。
2. `T = SHA256(D_INIT完整字节 || H_CHALLENGE头16B || nonceH)`。H_CHALLENGE 头中的长度是 64，计算 T 时排除证明部分。`K(label) = HKDF-SHA256(IKM=PSK, salt=T, info=ASCII("PMA1/1/" + label), L=32)`。证明分别为 `HMAC-SHA256(K("hub/proof"), T)` 和 `HMAC-SHA256(K("device/proof"), T)`。终端验证 hub 证明后发 D_FINISH，随后发受保护的 PTM1 HELLO。hub 验证 D_FINISH 后才接收 HELLO 或发 GRANT/QUERY。双方都以本地配对身份和握手模式为准。
3. 记录密钥标签为 `hub/record` 与 `device/record`。发送者标签为 `HMAC-SHA256(K(发送方向标签), T || PMA1头16B || body)`，完整 32 B，接收者用恒时比较。每方向从 seq 1 开始，只接受严格下一号，至多 2048 条。标签核验成功后再解析 PTM1 和检查模式、方向、顺序、job、状态、边界及期限。CRC 继续检错，SHA 继续核对完整素材。认证覆盖帧类型、job、DATA 偏移、正文、累计 ACK、END、CANCEL、QUERY 和整个 RESULT。DATA 仍最多 4076 B，最大线级 4160 B。终端可用同一个 4096 B transfer 工作区和增量 HMAC 接收，标签通过前不可交给写入器。

`repair` 中 device 第一个记录为 HELLO，后续为 READY、ACK 或 RESULT，最终 RESULT 后结束。hub 第一个记录必须为 GRANT，紧接 BEGIN，之后按 PTM1 顺序发送 DATA、END 或 CANCEL，END 后只允许一次同 job CANCEL。任何第二个 BEGIN 都拒绝。需要旧会话失败后查询时，从新连接重新握手。`query` 中 device 只发 HELLO 和 RESULT，hub 只发一次 QUERY。局部状态仍由 PTM1 和 `RepairOwner` 最终裁决，包括 READY 后才允许 DATA、END 精确结束、根与对象重新检查及从真实读回认定 Saved。

## 一次性维修用途决定

可信本地 hub owner 持有独立的维修批准。批准包含指定设备/控制端/绑定/epoch、同一次启动、预期 root 和目标代数、job、用途 `repair`、1 或 11、文件 SHA、长度、帧数、编码参数、V2 namespace、原 manifest/index SHA、许可证据及本地签发和绝对截止。job 先分配再批准，且只用于这一笔。权威决定在本地模块内发出，页面、PTC1 或来源审阅输出不能构造该能力。文件预验和使用时复核继续执行。

| GRANT body 偏移 | 字节 | 内容 |
| --- | ---: | --- |
| 0 | 16 | 非零一次性 decision_id |
| 16 | 32 | 完整 PTM1 BEGIN 帧（含原头/CRC）的 SHA-256 |
| 48 | 32 | 原来源 manifest SHA-256 |
| 80 | 32 | 原来源 index SHA-256 |
| 112 | 4 | `work_ms`，1–30000，锚定本连接 D_INIT |

设备/控制端/绑定/epoch 与用途由认证 transcript 绑定。GRANT 固定下一条 BEGIN 的 boot/root/generation/job/素材身份。manifest/index SHA 用于关联 hub 批准，设备仍以本机编译批准的动作、SHA、长度、帧数、编码、namespace 及实际目录为权威。设备还须有显式本地维修授权，绑定当前配对与 boot，单笔、限时。收到合法 GRANT 后只等待该 BEGIN，完整校验后原子消费本地授权，再向 `RepairOwner` 移交。进入 M2 后重新核对目录及期限，独占后才发 READY。hub 在首次尝试发送 GRANT 前原子消费本地决定，连接失败或结果不明均不返还批准，不重发旧 BEGIN。

两侧以各自单调时钟计时。hub 从完整收到 D_INIT 起计，`work_ms = min(30000, hub批准截止 - hub起点)`，签发时仍须在有效期内。设备从首次发送 D_INIT 前起计，`设备截止 = min(本地维修截止, 设备起点 + work_ms)`。设备到达 GRANT 或 BEGIN 时不重置计时，hub 也保留原期限。握手上限提议 5 s，查询整连接 5 s，包含收发。ACK、重连、暂停、迟到报文不续期。检查时钟回退、休眠及失效并关闭。漂移余量和具体时间上限还需固件测量后共同签核。

## 断线与失败行为

- 握手或记录认证失败、序号重放/跳号、超长/截断、未知版本、撤销或过期，立即结束连接权限和后续动作，无明文错误回退。每连接仅一次认证尝试，需限流和有界并发，网络线程不可持显示锁。提交前通知 owner 取消并等真实读写退出后回收；若已跨根标记，保存器继续确认结果或记录 Unknown，连接错误不撤销已提交的根。若回执已无法认证交付，hub 记 Unknown。
- 断线后由持原作业的 hub 在有界窗口显式查询。新认证 session 的设备/控制端/绑定/epoch、HELLO boot 和完整 job 必须与原收据相同。终端仅查最近一条同 boot RAM 收据，提议从该作业结束计保留最多 120 s。未命中、已过期或原结果不确定时保持 Unknown，重启后的目录变化只表示库存。查询无 BEGIN、无写资格、无重新开栅栏。若轮换、撤销或换 boot，旧作业不自动恢复。终端应对新会话的 RESULT 重新计算 MAC，旧的认证记录不可重发。
- 窗口内掉线、重启、根标记附近 I/O 失败、撤销、线程迟退、设备真实 STA/Flash/画面仍需接 `RepairOwner` 与 ESP32 socket 候选做联合负测。LAN 开放前须定版物理配对、秘密存储、加密需求与剩余预算。[宿主验证及下一入口](../reports/2026-11-11-native400-media-auth.md)
