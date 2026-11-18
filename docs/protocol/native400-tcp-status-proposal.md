# TCP-03：状态、完整性与退出字段交接候选

后续状态（2026-11-05）：[TCP04实际Bridge对照](native400-bridge-event-alignment.md)确认WholeSha-before-bind、同token多cycle/source、Touch无Presented与本候选有语义差异。本文保留已测试提案，不直接接线、不视为端侧采纳；当时a74f/worker待适配描述为旧快照，当前板上f553与未部署f2cf/9dc须分开。

2026-11-04。[Spec](../context/plans/tcp03-spec.md)/[Diff](../context/plans/tcp03-diff.md)、[报告](../reports/2026-11-04-tcp03.md)。以终端2026-11-04 draft-v0和TCP01/02为起点；本轮只读确认终端仍7消息/未共同定版，未修改固件或启用新增消息。下面是内部decoded-field候选，不是网络JSON，也不是已经冻结的二进制布局。

## 一致内容与需要共同决定的内容

保留PTC1、LE、原7消息、CRC/完整身份/会话/seq、10秒会话、仅PING续期、BASE1–60000ms、0/1/11 remote、4触摸、取消不取消触摸。旧v0仍last_frame0与current_display unknown；新增投影完全分离，不默认为旧设备支持新消息。f553板上/a74f未部署及三RGB/1MiB预算不变，本片不重新取设备性能或素材。

必须共同决定：新增type编号/固定长度、HELLO能力协商、每次启动或会话的report_seq范围/重连floor、source代数语义、完整STATE的提交点、失败保front后的actual含义。**本片不分配type、不改HELLO56B/flags0、不在旧记录尾追加字段、不向v0探发未知消息，也不自动降级以假装兼容。** 确认后在同一PTC1协议中作可识别扩展，补Node/C++字节向量；不能拿本片对象测试代替binary对拍或终端采纳。

## 字段提案（宿主内部形状）

| 字段 | 类型/来源/意义 |
| --- | --- |
| kind | verified/state/exit/error；内部dispatch标签，不等于TCP type |
| scope.connection | host socket owner的非零u64本地代数，**由适配器注入，不接受设备自报为当前连接** |
| scope.boot/session/mapping | 非零u64/非零u64/SHA32；从已核HELLO/OPEN/本地恢复映射固定，不自行更换或当认证 |
| report_seq | 非零u64字符串；本候选用同scope单调事件序列，允许跨号，以完整快照收敛；最终启动/会话范围待双方确认 |
| basis_seq | remote必须为hub最近明确base seq；touch/local为0，不靠重放命令查询状态 |
| token/source | 非零u64，意图token与真实Source代数分别绑定。端侧token启动内递增/不复用；同token不能替换source |
| asset | action u16、bytes u32、frames u16、asset_sha256 SHA32，对应本地明确恢复且已匹配的四对象 |
| integrity | 本候选唯一值file_sha_metadata_frame0_crc；明确完成整文件SHA、元数据与frame0 CRC，不表示全帧预解码/whole-media |
| origin | remote/touch/local。remote0/1/11，touch4，local0/1/11（已知本地随机），不把4开放为远端动作 |
| frame0_committed | Boolean，只有实际同token/source的View draw ACK才能为true；preparing可以false |
| reason | cancelled/expired/source_failed/decode_failed/display_failed/local_complete；固定枚举，不能透传日志/路径 |
| front_retained | Boolean，退出/错误后是否保留最后有效像素；本投影只展示历史，不把保front当当前播放或自动恢复base |

每种对象仅接表中适用字段，未知字段拒绝。u64保持字符串，不转换成浮点Number。所有字段值仍是明文LAN设备报告，不能冒充密码学证明。存储/saved/offline_available不在此提案。

## 提交与失效顺序

1. host先固定scope/四对象与clock，显式candidateEnabled:true才能创建候选；setBase由本地调用给出新seq/动作/绝对截止，不从报告生成控制授权。
2. verified必须匹配有效最新base、完整资产身份与token/source；只更新独立校验观察，不能生成首帧。frame0 true的remote STATE必须有同base/token/source的verified。准备中新source不会继承旧proof。
3. 触摸STATE先使remote actual成为历史，清proof，保留最新有效base。触摸期间setBase只改最新目标，不结束touch。触摸结束/退出事件不能自动恢复remote，必须收到匹配最新base的新token/source verified与STATE。token高水位防旧remote/source在高report_seq中重现；新触摸到来后旧touch exit不能结束它。
4. base到期/cancel清remote当前/proof，local/touch状态仍独立；关闭连接/实例失效则当前观察全转历史，不再接受报告。remote error/exit使该base失效，即使重新提供旧校验也不能复活；需本地新seq重新设目标。
5. 旧scope、旧report_seq/旧目标/退役token/source丢弃且不影响新scope高水位。相同report_seq相同规范化内容无副作用、不续寿命；相同seq不同内容阻塞当前投影。已识别当前scope的坏内容/完整性声明失败关闭，旧成功不回current。scope/序列前置格式非法直接拒绝，由未来decoder/owner决定是否断连接。
6. CLOCK读当前单调毫秒；倒退阻塞/清当前，不能用报文附带旧时间修正。失败后只可信新建投影，不提供网络reopen/修复。host历史中保留退役scope并不构成启动恢复授权。

verified的报告时间、STATE和PRESENTED如何统一排序须共同决定。本片未桥接旧PRESENTED到新projection，避免在没有verified消息的v0上伪造proof。完整snapshot允许report_seq跨号，事件丢失前的连续实际画面仍不能保证；真正网络适配需新快照/错误后的收敛策略。

## 管理端实现与验证范围

core/native400-tcp-observation提供上述内部校验、投影、令牌/来源隔离、期限/历史。ui/native400-tcp-observation仅共享只读renderer，展示目标、设备报告校验等级、实际来源/首帧与历史；不渲染原scope、路径、私有字段或操作按钮。两者是候选库，未挂DSH设置槽或TCP02 listener，默认关闭不产生I/O。

22个宿主专项与独立CLI用合成身份/虚拟clock测试顺序、触摸、多轮source、取消/期限、重放/冲突、uint64及只读展示。本片**未新增二进制/C++/loopback扩展互操作**；全套中的旧TCP01/02继续验证原七消息及loopback，不把它算新增STATE已上线。更未执行ESP首帧/全SHA/View/实际触摸或设备缓存操作。

## 交给终端的决定/待确认

- 已采用的管理端候选原则：完整SHA等级与首帧分离，STATE是完整实际快照，touch/local独立，失败保front仅历史；report seq与命令seq分离；connection来自host owner，token/source来自端侧实际worker/View。
- 待终端共同答复：新增type/长度与显式能力；verified/frame0失败切点及排序；report_seq跨号/重连floor；token启动内单调和source是否可复用/复位；front保留时退出原因与本地回退状态。
- 待执行：在双方定稿后实现同PTC1扩展的Node/C++字节对拍与实际worker/View适配，再loopback/端侧Wi-Fi资源短测；真实缓存控制窗口另定方案/回退。当前不自动启用生产LAN或改固件。

本文与向量未发送给其他任务，也不是双方签核。回退丢弃候选projection，继续TCP02默认关闭/v0；无数据/配置/素材/分区迁移。媒体流、保存/掉电、400-L/V3后置，broker/native/TLS不作前置。
