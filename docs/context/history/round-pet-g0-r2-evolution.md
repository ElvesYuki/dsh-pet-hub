# G0-R2执行边界演进

2026-10-30。G0-R2替代R1中首窗口policy/取消gate与恢复对照尚未实现的状态。R1真实身份/来源/许可未批准、部署快照及正式wire/G1/G2限制仍有效。[报告](../../reports/2026-10-30-round-pet-g0-r2.md)、[API](../../protocol/round-pet-g0-r2.md)。以下原相对链接仅保留历史语境。

## 原当前摘要

```text
2026-10-30 G0-R1：[只读契约/真实素材复核](../reports/2026-10-30-round-pet-g0-reconciliation.md)完成本轮范围，先补Spec/Diff，无生产代码更改。check（仅.mjs语法）和含构建test746/746通过（含并行素材切片）；独立46 PET4/11086帧全F/CRC/index及46源视频SHA/固定86181ce git blob均匹配，9项摘要/格式/缺批准负例通过。P=3afe4578…、M=9045bd6b…、N=dfc829e1…、源SHA=a6a2ddae…分域确认，详见[复核向量](../protocol/vectors/round-pet-g0-real360-review-v1.json)。license_ref仍upstream-reference-only，**未创建独立approval、未真实A2导入或生产批准**；原始形象声明本次直读失败，许可链/用途/分发范围待补证。

[C01–C12交接](plans/round-pet-g0-handoff.md)已按固件回复刷新：资源/信任边界/状态/维护等设计方向一致，首窗口选择远端0/11+physical4、remote4暂禁；取消gate与marker分开、bool恢复I/O不能自动解除unknown，写预算是启动内固定易失窗。**policy/UI gate、提交结果/恢复分类及正式wire尚未实现**，A4/A5通用候选仍接受46目录。capability_values缺完整hello身份/协议封套，候选codec无mode/descriptor/deferred_local/touch等提案字段，不能换名直连；联合G0未关闭。下一G0-R2离线执行边界，再G0-R3字段/错误/Node-C++golden；G1/G2和窗口继续独立。旧快照已[归档](history/round-pet-g0-reconciliation-evolution.md)。
```

## 原 docs/context/plans/round-pet-g0-handoff.md

```text
# 给固件任务：G0 契约决定／待确认项

2026-10-30 G0-R1。管理端已只读复核固件[回复](/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio/docs/protocol/round-pet-native360-g0-reply.md)及[输入向量](/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio/docs/protocol/vectors/round-pet-native360-g0-inputs.json)，并独立重验真实360/46库。[管理端报告](../../reports/2026-10-30-round-pet-g0-reconciliation.md)、[基线差异表](../round-pet-hub-baseline-alignment.md)、[无批准的身份复核向量](../../protocol/vectors/round-pet-g0-real360-review-v1.json)为本轮证据。旧交接全篇已[归档](../history/round-pet-g0-reconciliation-evolution.md)。本文是可交付文档，**未发送消息、不是共同签核/新wire实现或设备操作授权**；固件仓库未修改。

## 当前边界

- 正式闭环仍是一块1.75C-EN、360²/24fps/241帧/46原ID；466²居中、单encoded、V2 28MiB/4活跃＋1暂存、保护动作0/4，不改N/分区/格式。400/78与分层角色是独立候选。
- 管理端A1–A10宿主候选已实现，scoped/静态证书减量与逐次动态授权保持，生产通道默认关闭。固件回复中的469或385项是旧hub快照，不重做已完成承载优化；最新全套数见[当前系统](../current-system.md)。
- 固件最新矩阵顶部是缓冲A/B中断、最后核对cbdf3169…及临时端点，尚未恢复67；下方仍有“当前67”等历史行。以顶部中断记录及窗口Spec限定本次引用，不自行恢复或声称新读了设备。67为既有P3性能基线/恢复目标、a7精确回退均保留。fc55 G1缓存挥手后46,527B低水位未过48KiB，完整维护/G2未关闭。

## C01–C12：复核后的决定与缺口

表中“设计一致”指固件单方回复与本轮管理端选择相符，不代表代码/wire或资源验收已完成。

| ID | 已确认／管理端本轮决定 | 仍待确认或实现；下一证据 |
| --- | --- | --- |
| C01 能力执行 | **数值/模型确认**：schema2单encoded=playback/max/slot 5865472B；persistent 4+1、stride5869568、partition29360128，center53；媒体360/24/241/flag1/key12/tile20。A1/A6与固件常量一致 | 固件仅给capability_values表，缺protocols/firmware_version/board_profile，不能直接作为hello。完整extensions/版本/identity、实际能力报告及实体装配待实现，未知能力拒绝 |
| C02 F/M/P/N | **真实字节身份已独立确认**：P=3afe4578…、M=9045bd6b…、N=dfc829e1…、源SHA=a6a2ddae…；46原ID/225509627B/11086帧全F/CRC/index通过；46源视频SHA256和固定86181ce提交git blob一致 | `license_ref=upstream-reference-only`原样保留，**无独立approval/真实CAS导入**。原始形象声明本次无法直接读取，发布/分发/用途许可复审待完成；改license_ref/目录字段须重算M/P并重新批准 |
| C03 metadata/信任 | **设计一致**：受信hub完整核P/M/F/源与媒体；设备持会话批准(P,M,N)+单descriptor，不收全46工作集；页≤8条且整个body≤4096B，超限减条目 | 分页字段/游标/批准授权记录与完整身份关系待C07；设备当前v5大目录路径不能作为新owner预算，G2说明实际释放/复用，不能假定已经节省RAM |
| C04 状态/恢复 | **证据语义一致**：accepted/verified/playing、display actual、storage saved及当前inventory独立；saved仅marker后元数据读回确认，命中已存不伪造新提交；淘汰同根更新available | 新wire/提交阶段结果钩子待实现。marker可能写入或确认失败→outcome_unknown/阻止新写；当前bool恢复把I/O失败与坏根折叠，不能直接把recover=true当未知已消除。低root/同seq冲突不降hub floor |
| C05 手动/触摸 | **管理端选择固件保守首窗口方案**：仅远端base0/11，physical4单次且本地优先；remote4暂禁，UI“触摸专用”。本地首帧token ACK起241/24秒，重复触摸新token；到期回最新有效base，否则idle0 | 这是后续实施目标，现A4/A5仍允许46目录动作，**尚无0/11准入gate或remote4 UI限制**；不能启用候选当首窗口安全实现。其他动作随G4另扩；不改变旧v5/PC角色策略 |
| C06 首帧/维护 | **设计一致**：playing来自刷新提交及完整command/context/generation；local事件只更新actual，不回发4。loading/verifying/saving冻结最后有效画面，wall time不当动画elapsed | 现render在lv_refr_now路径后记presented_*，局部记录不是完整新身份，非面板扫描结束证明。同像素/同帧、旧token、维护恢复及独立display_seq需共同向量/钩子 |
| C07 wire/兼容 | **方向一致、字段未冻结**：主动POST exchange、响应≤1 control、下一HTTP回传、显式版本/独立uint64流，旧端不协商拒绝 | hub候选profile=round-pet-pull-candidate/1、路径/offline-round-pet/v1；固件规划/hub提案另指正式/hub-device/v1，不能换名直连。heartbeat/request_seq、mode/descriptor、deferred_local、touch/cancel record、错误/HTTP映射与retry表仍缺共同决定和Node/C++字节golden |
| C08 取消/写预算 | **接受双边界设计**：取消准入gate与持久marker分开；gate前已观测取消不进入提交，gate后取消不承诺撤销保存，只禁止旧目标激活。marker/读回未知不得报未保存 | 当前persist仅commit前查取消，commit内部无回调；gate原子性/错误阶段尚未实现。12次是启动内易失固定窗（首尝试起一小时），非滑动/跨重启硬限额；普通60秒，load完成约5秒且已呈现/非local才判断；installation仅维护、失败也占预算。G1实测与不可抢占上界仍缺 |
| C09 调度/期限 | **结构一致**：单在途control、单未派发latest、单待段，renew/cancel/revoke有界旗标，段后先exchange，不用8 FIFO | RTOS owner/让出/退出硬上界待实现实测。包括commit残余、全验/擦写与host磁盘成本；500ms poll/1s段仅假设。缺上界NO_GO，不延lease/放宽deadline掩盖排队 |
| C10 身份/认证 | **方向一致**：单TLS/HTTP owner，TLS1.2/P256仅探针候选，认证失败不降级IP/Bearer/明文 | 正式可信时间、密钥/证书/epoch持久提交、撤销/重绑定/丢钥恢复还缺可审查Spec与资源预算。RAM凭据探针不是配对，G2前不能开真实通道 |
| C11 资源/G1/G2 | **口径一致**：P3显式PSRAM6916777含64KiB read-ahead；保留内部≥48KiB、PSRAM≥1MiB/块≥512KiB、main栈≥1KiB及2MiB应用余量目标 | 最新G1并未通过全维护：fc55低水位门禁停止，后续A/B中断只覆盖A准入/待机，未缓存切换/点击，B未测。TLS峰值/最大内部块/新栈/清理未知；P3和loopback均不能放行 |
| C12 控制源/回退 | **设计一致**：启动网络owner前选择旧v5或新hub，断线不自动切源，不停整个pet/bridge；新session新hello/库存/控制，不重放旧命令 | 选择形式/持久策略/核验机制未实现；A5仅宿主OFF恢复。中断现场恢复需另获设备窗口授权，app/配置内容/凭据epoch/缓存分别恢复核对，不擅自触碰NVS/服务或整片恢复 |

## 下一次可独立验证的小切片

1. **离线G0-R2：执行边界对照**。先Spec/Diff，实现独立首窗口policy（0/11允许、remote4及其他拒绝，physical4观察不反发）；验证同local期间latest替代/租约失效回idle/旧context不可复活。将取消gate、marker及读回结果分离为模型/适配向量，覆盖gate两侧取消、marker未知、I/O恢复分类及已存命中无新saved。本轮不改这些实现；保持A1–A10通用候选，不能仅把一个UI按钮隐藏就称门禁完成。
2. **离线G0-R3：完整wire定版**。以C07字段差异清单选择一个正式profile/版本、端点和闭合schema，明确错误/HTTP/retry、报告/取消/touch、metadata descriptor及最大报文；管理端先产无秘密正反字节golden，交给固件任务独立C++实现对照。固件输入数学向量不是wire向量，管理端不能代其签核。
3. **真实素材独立批准**。本轮身份已固定，下一补原始许可链/用途/署名与分发范围记录，再选择是否建立**仅offline-validation**的A2批准并测试真实完整库导入/重开。approval由独立审阅输入提供，不把本复核JSON/哈希自封为批准；任何生产/商业分发另审。
4. **等待固件资源证据**。G1维护、G2时间/凭据/单owner/TLS/有限清理通过后，才准备G3真实缓存0/11+physical4方案/具体回退和单独窗口。G4再未缓存下载、校验、首帧、保存、淘汰、断连/重连。400/跨角色/多设备/BLE/OTA/音频不合并。

## 联合关闭与回退

联合G0仍**未关闭**：C02用途批准、C07完整wire与双端向量，以及C04/C08/C09/C10/C12具体边界/身份设计还缺交付。G1/G2是独立执行门禁，不能以设计一致替代实测。管理端不改固件回复中的旧hub快照，由固件任务下次读取本交付自行刷新；本轮没有发送消息。

本轮无外部运行变化，文档撤回即可，无应用/配置/NVS/缓存恢复操作。未来实物操作前以最新矩阵+独立读回冻结现场、保护67/a7与窗口前完整备份；仅恢复app不等于恢复配置/绑定/缓存。当前临时端点/服务属于另一窗口，本轮不启动、停止或清理它们。
```

## 原 docs/context/round-pet-hub-baseline-alignment.md

```text
# 管理端 G0 基线与契约差异表

2026-10-30 G0-R1，只读刷新固件最新回复/资料和真实素材；[Spec](plans/round-pet-g0-reconciliation-spec.md)/[Diff](plans/round-pet-g0-reconciliation-diff.md)、[报告](../reports/2026-10-30-round-pet-g0-reconciliation.md)、[C01–C12权威交接](plans/round-pet-g0-handoff.md)。旧管理端快照已[归档](history/round-pet-g0-reconciliation-evolution.md)，A1–A10与认证/承载优化保持。固件回复中的hub469/385项仅是历史读取，不覆盖当前工作区。

## 固定输入与验证层次

| 输入 | 已确认事实 | 限制 |
| --- | --- | --- |
| 管理端 | A1–A10离线资源/导入/观察/pull/OFF装配/执行/根权威/减量已实现；Node24.14.1/npm11.11.0，最新全套见当前系统 | HEAD a5a2cff…不能复现主要未跟踪实现；本轮无生产代码变更，不重做优化 |
| 固件快照 | 读取HEAD9816317ae5ac6f86c982ef773461de595f407747；代码已迁入devices/esp32s3-touch-amoled-175c及common；源码/回复各文件SHA见报告/向量 | dirty工作区不由HEAD完整表示，旧G0文件路径/SHA不能直接当当前实现 |
| 部署引用 | current-status顶部及缓冲A/B Spec记最后核对cbdf3169…、临时端点保留，未恢复67，串口owner关闭；A联网准入/待机，切换/点击和B未执行 | 这是上游记录快照，本轮未新读设备；下方“当前67”旧行不覆盖顶部中断结论。67是P3性能基线/恢复目标，a7保留 |
| G1/G2 | fc55 G1曾联网准入通过、缓存挥手后SDK历史低水位46527B＜49152，未下载/保存；后续A/B中断，完整维护未通过 | SDK历史低位不等于同刻全局最低/泄漏证明；TLS/可信时间/凭据/最大块/清理上界均不能从旧P3推得 |
| 正式媒体 | 466²屏／360² center53、PET4/24/241/flag1/key12/tile20；46原ID、225509627B/11086帧 | 400/78与分层候选保持隔离，不改正式角色/尺寸或V2 N |
| 存储/内存 | 28MiB V2、4活跃+1暂存、按动作ID保护0/4；单encoded5865472B，stride5869568，read-ahead65536；显式PSRAM6916777 | 能力数值表不是完整hello；P3内部59035B是旧播放样本，非TLS准入；完整46库不在设备离线缓存 |
| 真实身份 | 管理端独立重算P=3afe4578…、M=9045bd6b…、N=dfc829e1…、源SHA=a6a2ddae…；46文件全F/CRC/index和46源视频git blob/源SHA一致 | license_ref原为upstream-reference-only，不创建独立approval，不真实导入CAS或生成设备指令；完整值/逐动作证据见[复核向量](../protocol/vectors/round-pet-g0-real360-review-v1.json) |

外部只读根：/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio。指定三份规划和current-status、G0 reply/inputs、G1-lite/内存报告及实际Store/播放器/策略/导出代码均核对；未调用导入器/固件测试或构建，不读运行凭据/配置。上游固定README与git目录只读取回，设备验证始终离线。

## 实现／决定／未决差异

“设计一致”是两份立场相符，不能提升成新wire或实体能力。完整12项及下一证据以交接表为准。

| 项目 | 管理端已实现/本轮确认 | 待实现／待确认 |
| --- | --- | --- |
| schema2 | parser/推荐/几何＋A1独立单RAM/Flash模型，A6执行链已离线验证；固件数值一致 | 旧DeviceModel仍schema1；固件完整hello身份/媒体扩展/实体执行和资源报告缺失，不能只因parser通过称闭环 |
| F/M/P/N及来源 | A2分域/严格导入/provenance已有，本轮真实46字节/源blob/ID/recipe确认，V2 N保持 | 许可链/用途/独立approval、真实完整库A2导入/恢复及Node-C++wire未完成，不从哈希生成批准 |
| 接纳/首帧/实际画面 | A3认证proof/目标/序列/查询投影及只读UI，A6模型首帧已验；固件有局部刷新提交钩子 | 完整context/generation/刷新结果wire尚未实现，旧played/HTTP/PC preview不能代替；同像素首帧向量待补 |
| 保存/淘汰/恢复 | A1/A3 root_commit/独立库存/当前性，A7/A8同binding根floor与durable发布保持 | 固件bool不能区分marker/读回未知与I/O恢复失败；须分提交阶段/完整根再判saved，不直接套模型或旧日志“保留旧根” |
| 手动/触摸 | 本轮选择首窗口远程0/11、physical4优先单次；远程4触摸专用暂禁。A3 local仅观察、A6仍模拟 | A4/A5候选目前允许整个46目录，尚无首窗口gate/UI禁用；不改变旧v5/PC规则。deferred_local/base_loop显式字段未实现 |
| 取消/维护 | A1/A3 held_last_valid及unknown、A6/A8旧结果拒绝；接受gate与持久marker双边界设计 | 固件commit内部不可取消，marker前任意点击不保证不保存；gate同步/结果分类/最坏不可抢占残余需新切片和固件验证 |
| wire/版本 | A4 loopback round-pet-pull-candidate/1、下一HTTP回执、分页/Range/单在途已验；A5默认OFF | 正式/hub-device/v1路径/profile及字段/错误表未定；现codec无mode/asset_descriptor、deferred_local字段或touch record。不得换名直接接ESP |
| 调度/授权 | 单pending/latest/普通、紧急旗标、scoped每scope/4KiB完整元数据、动态日期/撤销及完整deadline；A10 extra315→0且保护成本保持 | 固件当前旧v5多HTTP/整文件路径非单TLS owner；RTOS/Flash让出/cleanup上界未知，不能延TTL或用loopback样本准入 |
| 身份/恢复/控制源 | 管理端binding CAS、hello/session、A5 OFF恢复、A8根权威/低root失效已有 | 正式可信时间/秘密/epoch持久化/撤销重绑定；设备端新旧owner互斥和中断现场恢复须固件/独立窗口；无自动降floor/清锁/格式化 |
| 生产准入 | 当前deviceTransport=false，无生产listener/真实设备闭环；730是A10阶段证据，本轮回归数见报告 | G0-R2/R3及许可批准、G1全维护/G2资源通过后，才另授权G3/4；物理掉电/冷盘/多日/多设备等仍未覆盖 |

## 审查结论与下一入口

真实库**身份核定完成、批准与联合G0未完成**。下一优先离线G0-R2首窗口policy与取消gate/未知恢复对照，再G0-R3完整wire/错误/字节golden；不重做A2机制或A10承载优化。C02用途批准及原始声明直接核验并行补齐；等待固件G1/G2，不主动处理当前A/B中断现场。具体小切片/验收/回退见[C01–C12交接](plans/round-pet-g0-handoff.md)。
```

## 已完成的原待办

```text
1. **G0-R2离线执行边界对照**：先补Spec/Diff，接首窗口policy（仅远端0/11、physical4只观察、remote4/其他拒绝），验证local期间latest替换/到期回最新有效base/租约失效与旧context不复活；模型/适配区分取消gate、marker及读回/恢复I/O未知，保留root floor，不以隐藏UI代替准入gate。G0-R1已完成[真实身份与12项复核](../reports/2026-10-30-round-pet-g0-reconciliation.md)，不重做A2/A10机制；仍离线，不启真实通道。
```
