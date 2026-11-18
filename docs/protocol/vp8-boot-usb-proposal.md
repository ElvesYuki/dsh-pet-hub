# VP8 BOOT USB 对接候选

2026-11-17，固件候选与管理端共用的宿主对拍契约。

## 已有实现

当前 VP8 使用一个 `BasicUpdateLines<384>` 文本接收器，每行由 LF 结束，行体最多 383 字节。控制字符或超长行整行丢弃。已有 `STATUS2` 只返回固件版本和槽等状态，无法宣告首绑。旧 native400 的 PBP1 是另一种上层协议。它已有 16 字节帧头、正文长度和 CRC。

| 类型 | 方向 | 正文字节 | 已有语义 |
| --- | --- | ---: | --- |
| 6 | 请求 | 0 | 读取能力与已提交状态 |
| 7 | 请求 | 1 | 申请挑战，操作 1 为首绑 |
| 8 | 请求 | 173 | 指定本次挑战 reference 的签名提议 |
| 10 | 请求 | 64 | VP8 独有的 poll／fence 完成查询 |
| 129 | 应答 | 84 | 能力、boot、代数与持久状态 |
| 130 | 应答 | 40 | 挑战与 reference |
| 132 | 应答 | 88 | 独立的首绑等待应答，末尾回显 reference |
| 133 | 应答 | 136 | VP8 独有的持久读回、完整公钥 SHA-256 与请求回显 |

## 候选 VP8 载体

- 主机方向 `VP8PAIR1 <base64>\n`，设备方向 `@VP8_PAIR1 <base64>\n`。单行只封装一个标准填充 Base64 帧。编码最大 196 原始字节，Base64 最大 264 字节，有界于现有接收器。接收端拒绝非规范编码、额外字段、帧尾随字节。主机接收可容许 CRLF，主机发送固定 LF。
- 先显式探测并读取类型 129。bit 0／1 保留，bit 2 表示此 VP8 首绑能力，当前候选值为 7。旧固件无该位或无应答时，禁止发挑战或首绑。类型 9／131 和现有 PMA1 RAM 租用留在旧协议范围。
- 类型 132 只确认匹配的提议正在等待物理确认。类型 129 的 Bound 只表示读到了设备持久记录。设备、控制者、绑定 ID、代数、公钥摘要及 boot 必须与当前意图一致。原状态只携带公钥 SHA-256 的前 16 字节，管理端完整指纹仍需绑定到新鲜验证会话，不能用摘要前缀替代。
- 管理端每个最终查询新生成 32 字节非零 nonce。成功 Bound 要求同一请求的 boot、device、mode、nonce、reference，以及持久记录的 controller、binding、epoch、完整公钥 SHA-256 全部匹配。只有 fence 的 OK Unbound 能解除未知。其他结果保留 pending。直连、已核对 USB 是设备侧信任边界，P-256 继续校验发起首绑的管理端签名。

## 完成查询正文字段

整数按小端编码，偏移从正文起算。

| 字段 | type 10 | type 133 |
| --- | --- | --- |
| 头部状态 | mode 在 0，1–3 保留为零 | result 在 0，phase 在 1，mode 在 2，3 保留为零 |
| boot、device | 4 起 8 字节，12 起 16 字节 | 同请求 |
| 已提交记录 | 无 | epoch 在 28，controller 在 36，binding 在 52，公钥 SHA-256 在 68 |
| nonce | 28 起 32 字节 | 100 起 32 字节 |
| reference | 60 起 4 字节 | 132 起 4 字节 |

mode 0 为 poll，要求当前 boot 已受理的非零 reference。mode 1 为 fence，要求 reference 0，设备先隔离原确认和挑战，再返回当前记录。result 沿用 0–4。phase 0／1／2／3 分别为 Unbound、Waiting、Bound、Fault。没有持久记录时 controller、binding 和 keyHash 为零。已用固件真实 Session 和固定向量离线验证，未用于设备或生产入口。

## 明确启用的一键绑定候选

能力 bit3 表示 `VP8_USB_ENROLL`。管理端要求 bit3 与前述 bit0–2 同时存在，仅在受信宿主明确授权时使用 Type 7 的 op3。Type 130 以原布局回显 op3。独立挑战及 reference 进入现有验签流程，签名正文仍使用 `PBP1/persist/enroll/v1`，Type 8 原布局保持。

Type 132 的 op3 成功态为 OK + Bound + 新代数，必须属于当前设备、boot 和 reference。它提供控制者、绑定及 16 字节公钥摘要前缀。管理端保持 pending，接着发送同会话的新鲜 Type 10 fence。只有匹配 Type 133 的完整持久记录才提交本地 bound。Type 132 丢失或结果未知交给既有 fence 恢复。历史 op1 可显式独立使用，默认候选无 op3。 [宿主对拍](../reports/2026-11-17-vp8-usb-enroll.md)
