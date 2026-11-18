# 400 PET4 TCP 维护协议提案

2026-11-11。PTM1 v1 已通过 Node/C++ 字节和宿主回环验证。终端发起单条维护连接，和 PTC1 播放控制分时使用。一个连接只做一次发送或一次查询。管理端首版只接调用者显式交付的 IPv4 loopback socket。既有 PTC1、只读 review 与 DSH 管理接口沿用原权限。[Spec](../context/plans/tcp-media-spec.md) · [Diff](../context/plans/tcp-media-diff.md) · [字节向量](vectors/native400-tcp-media-draft-v1.json) · [回环验证](../reports/2026-11-11-native400-tcp-media-nor.md)

## 帧

整数均为无符号小端。JavaScript 将 u64 表示为规范十进制字符串。摘要为原始 32 字节，作业 ID 为不透明 16 字节。终端连接 owner 用完整 ID 关联报文，并绑定单独的本地事务 ID。TCP 分段不影响帧边界，接收方先读满 16 字节头，核对类型和长度后再读 payload。payload 上限 4096 B，整帧上限 4112 B。错版本、类型、保留位、长度、CRC 或截断关闭该连接。

| 头偏移 | 长度 | 字段 |
| --- | ---: | --- |
| 0 | 4 | ASCII `PTM1` |
| 4 | 1 | version `1` |
| 5 | 1 | type |
| 6 | 2 | flags 固定 `0` |
| 8 | 4 | payload 字节数 |
| 12 | 4 | IEEE CRC32，覆盖头前 12 B 与完整 payload |

除 HELLO 外，所有 payload 的 `0..15` 均为 job。以下偏移相对 payload。

| type | 消息 | 方向 | payload 字节 | 剩余字段 |
| ---: | --- | --- | ---: | --- |
| 1 | HELLO | 终端 → hub | 32 | `boot`、`root`、`generation1`、`generation11`，依次为偏移 0/8/16/24 的 u64 |
| 2 | BEGIN | hub → 终端 | 124 | `boot`/`root`/目标 `generation` 为偏移 16/24/32 的 u64。`action`/`frames` 为偏移 40/42 的 u16。`bytes` 为偏移 44 的 u32。偏移 48 起六个 u16 为宽/高/帧率分子/帧率分母/关键帧间隔/分块行数，固定 `400/400/24/1/12/20`。偏移 60 为文件 SHA-256，偏移 92 为 V2 namespace SHA-256 |
| 3 | READY | 终端 → hub | 16 | 无 |
| 4 | DATA | hub → 终端 | 21–4096 | 偏移 16 为 u32 文件偏移，偏移 20 起为 1–4076 B 原字节 |
| 5 | ACK | 终端 → hub | 20 | 偏移 16 为 u32 累计确认字节 |
| 6 | END | hub → 终端 | 20 | 偏移 16 为 u32 最终字节数 |
| 7 | CANCEL | hub → 终端 | 16 | 无 |
| 8 | QUERY | hub → 终端 | 16 | 原作业 ID |
| 9 | RESULT | 终端 → hub | 68 | 偏移 16 为结果码，17–19 为零，20/28 为新 root/generation u64，36 为完整文件 SHA-256 |

RESULT 的结果码 `1` Saved、`2` Cancelled、`3` Failed、`4` Unknown。非 Saved 的 root、generation、SHA 必须为零。v1 使用固定字段和版本，能力或版本集合协商由双方定版。

## 顺序与收据

1. HELLO 给出当前 boot 和缓存目录。hub 校对原维护决定中的 boot、root、目标代数。BEGIN 只承载 compact78 的 1 或 11，固定已选中版本的精确字节数、241 帧、文件 SHA 与 V2 namespace。终端须按编译批准的完整身份复核，并以同一根和目标代数进入维护屏障。0/4 保持受保护。
2. READY 后从 offset 0 顺序发 DATA。hub 只保留一块未确认数据，等待该帧 socket 写回调及精确累计 ACK 再读下一块。终端在 Pull 下一次读入口确认上一块已写入暂存槽后发 ACK，最后一块同样先 ACK 再读 END。该时序已由真实 socket 和宿主 NOR 联测。固件产品入口应在 M2 屏障取得独占维修资格后发送 READY。
3. hub 验证原文件全长、完整 SHA 及文件指纹后才发 END。终端拒绝错 offset、提前 END、超长和 EOF，封存该作业的数据流，检查整文件 SHA 和全部 PET4 帧。通过根提交及读回恢复才可给 Saved。终端按原根和全部活动对象的最大代数加一。hub 要求新 root 恰为原 root + 1，新对象代数超过原 HELLO 报告的 root 和两个对象代数，文件 SHA 与原作业一致。
4. `sent` 随 socket 写回调推进，`confirmed` 随 DATA ACK 推进，`saved` 只由匹配该 job 的提交结果写入。三项分别观察。Saved 仅记录该动作的持久提交，实屏首帧和当前播放继续由各自状态提供。
5. CANCEL 只适用于当前 job。已开始写的帧完成后发送 CANCEL。随后最多消化一条合法迟到的 READY 或 ACK，再等 RESULT。提交前若能确认未落新根，终端返回 Cancelled 或 Failed。提交门之后可以返回真实 Saved。无法判定持久结果则返回 Unknown，继续保护已进入写栅栏的作业。
6. BEGIN 已尝试后遇到失联、报文错误或超时，hub 记 Unknown。调用者持原内存作业，通过同 boot 的新连接显式 QUERY。查询不发 BEGIN、不续写、不解除设备写栅栏。跨 boot 和目录根推进只提供当前库存事实。管理端退出后此候选无本地收据恢复机制。

## 权限、期限与联调缺口

- 管理端可信调用者显式给出本地维修决定，包含 manifest/index SHA、许可引用、namespace、动作、boot/root/代数。源码级入口由进程自身信任边界保护。已有只读审阅批准、视觉批准及播放授权各按原用途使用。boot、job、CRC、SHA 用于关联与完整性。真实 LAN 写入前需联合确定设备/用途授权、会话认证和重放规则，再做负例及资源测量。
- PMA1 已提供独立认证与维修用途的离线字节提案。该提案的时限和模式适用于未来认证封装。本页后述参数仍对应原裸 PTM1 宿主回环。[认证提案](native400-media-auth-draft.md)
- 整笔试验会话默认 30 s，可设至 120 s，从接管 socket 起计时。块和取消共享这条绝对截止。查询每次最多 5 s，只在原开始时间加作业超时再加 120 s 的期限内可调用。这些是宿主配置，端侧截止、结果保留期和 Wi-Fi/Flash 时延须联测。
- 宿主 owner 已以完整 16 B job 绑定一次本地 u64 事务并验证同 boot 查询。END 后、根标记前到达的额外 DATA 在管理端宿主测试中保留旧根。生产 owner 还需验证 M2 的 READY 时机、任务与 socket 的退出顺序、取消/失联/超期与写栅栏的交接，以及结果保留期。
- 实机窗口前独立核定 STA 空闲、低水位、最大连续块、暂存区、保存时画面及恢复播放。终端取证候选 `747f7a26` 已构建，宿主回环的结果不代表该候选已采集真机读数。
