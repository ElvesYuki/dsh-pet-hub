# G0-R4 临时adapter演进

2026-11-02。以下R3状态的“实际hello/adapter/schema2投影未实现”部分由R4临时宿主实现替代，实际设备/生产装配、共同签核、素材许可与G1/G2仍未完成。R3原合同/向量按原始SHA保存：[合同](../../protocol/vectors/round-pet-wire-r3-contract.json)、[向量](../../protocol/vectors/round-pet-wire-r3-vectors.json)；修订2只增显式full-offline-review选择，原字节不静默改写。

## 原 docs/context/current-system.md

```text
## 最新验证与限制

2026-11-02 [G0-R3管理端wire提案](../reports/2026-11-02-round-pet-g0-r3.md)完成：check（仅.mjs语法）通过，含构建test **811/811**；独立CLI **24/24**、Node与原创C++17宿主 **78正/62反**字节对照及SIGTERM临时清理通过，最大字段8动作页3075B＜4096。新增独立round-pet-native360-wire/1、闭合字段/错误表/codec与有界往返账本，无生产装配/新listener。固件共同签核、实际hello/adapter/schema2投影、真实素材独立批准及G1/G2仍未完成；C++仅宿主数据oracle，不是ESP栈或资源验收。本轮未新读固件/素材或设备。旧wire缺口已[归档](history/round-pet-g0-r3-evolution.md)，[交接](plans/round-pet-g0-handoff.md)为下一入口。

2026-10-30 [400批准合并](../reports/2026-10-30-native400-merge.md)完成：check（仅.mjs语法）通过，含构建test787/787通过，新增3项身份／批准／拒绝覆盖测试；真实78素材18675帧及旧sim_A cap下完整宿主激活／78动作／缓存恢复通过。仅宿主离线验证，无设备／固件／正式360或运行服务变更。下列其他切片数量保留各阶段语境。

G0-R2执行边界已完成本轮离线范围：[35专项与实施报告](../reports/2026-10-30-round-pet-g0-r2.md)、[API](../protocol/round-pet-g0-r2.md)。check（仅.mjs语法）与含构建test784/784、独立CLI35/35及SIGTERM清理通过；仅原创模拟素材/虚拟时钟/临时存储、UDS与loopback TLS，无真实通道或外部配置变更。当前工作区回归包含并行400候选，阶段旧数量不追写成最新。

2026-10-30 G0-R1身份基线（历史回归数对应其报告）：[只读契约/真实素材复核](../reports/2026-10-30-round-pet-g0-reconciliation.md)完成本轮范围，先补Spec/Diff，无生产代码更改。check（仅.mjs语法）和含构建test746/746通过（含并行素材切片）；独立46 PET4/11086帧全F/CRC/index及46源视频SHA/固定86181ce git blob均匹配，9项摘要/格式/缺批准负例通过。P=3afe4578…、M=9045bd6b…、N=dfc829e1…、源SHA=a6a2ddae…分域确认，详见[复核向量](../protocol/vectors/round-pet-g0-real360-review-v1.json)。license_ref仍upstream-reference-only，**未创建独立approval、未真实A2导入或生产批准**；原始形象声明本次直读失败，许可链/用途/分发范围待补证。

[C01–C12交接](plans/round-pet-g0-handoff.md)已由G0-R2更新执行边界：A5内部显式first-window-review/1在入队/派发限制cached0/11，remote4及其他拒绝、保存禁用，profile固定并进入选主身份，内部manualChoices投影供未来UI。local4首ACK计时/latest/会话失效用有界core模型对照；A1显式gate后取消可继续saved但不能重活旧播放，recoverStorage只出完整库存，I/O未知不降级/不补saved，root floor保持。真实UI/触摸源、固件gate同步/结果分类仍未实现，通用候选缺省仍46且生产通道OFF。R3已补独立完整hello/字段/错误/Node-C++字节向量及关联模型；旧A4 codec依旧无这些新字段，新hello未接session-runtime，A3旧schema1不能直接消费新schema2。下一共同签核与默认OFF临时adapter、实际版本投影及独立用途批准；联合G0未关闭，G1/G2/窗口独立。R1原未实现摘要已[归档](history/round-pet-g0-r2-evolution.md)。
```

## 原 docs/context/current-todos.md

```text
1. **共同wire评审与默认OFF宿主adapter、独立用途批准**：R3[24专项/78正62反宿主字节对照](../reports/2026-11-02-round-pet-g0-r3.md)及[wire/1闭合提案](../protocol/round-pet-wire-v1.md)已交付，不重做字段/向量。按[交接](plans/round-pet-g0-handoff.md)由固件任务独立核合同SHA/同一字节，C++宿主oracle不代其签核。管理端下一先Spec/Diff，仅临时loopback/原创素材，复用session/guard/A2/A3/R2/A8，接新hello版本/包到同socket挑战、schema2投影、错误/pending、取消/命中/迟到/unknown恢复；保持默认关闭、旧profile不放宽，不做真实UI/设备适配。真实360/46的P/M/N/F/源/原ID已核；原始形象声明直读、用途/署名传播范围与独立offline-validation approval仍缺，批准后另审真实A2全库导入/重开，不把复核JSON或本轮虚构向量当批准。
```

## 原 docs/context/plans/round-pet-g0-handoff.md

```text
# 给固件任务：G0 契约决定／待确认项

2026-11-02 G0-R3刷新；外部事实仍限定G0-R1只读快照，本轮未新读固件/设备。管理端已只读复核固件[回复](/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio/docs/protocol/round-pet-native360-g0-reply.md)及[输入向量](/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio/docs/protocol/vectors/round-pet-native360-g0-inputs.json)，并独立重验真实360/46库。[管理端报告](../../reports/2026-10-30-round-pet-g0-reconciliation.md)、[基线差异表](../round-pet-hub-baseline-alignment.md)、[无批准的身份复核向量](../../protocol/vectors/round-pet-g0-real360-review-v1.json)为本轮证据。旧交接全篇已[归档](../history/round-pet-g0-reconciliation-evolution.md)。本文是可交付文档，**未发送消息、不是共同签核/生产wire装配或设备操作授权**；固件仓库未修改。真实身份与外部事实在G0-R1核对，本轮仅补管理端合同/宿主向量。

## 当前边界

- 正式闭环仍是一块1.75C-EN、360²/24fps/241帧/46原ID；466²居中、单encoded、V2 28MiB/4活跃＋1暂存、保护动作0/4，不改N/分区/格式。400/78与分层角色是独立候选。
- 管理端A1–A10宿主候选已实现，scoped/静态证书减量与逐次动态授权保持，生产通道默认关闭。固件回复中的469或385项是旧hub快照，不重做已完成承载优化；最新全套数见[当前系统](../current-system.md)。
- G0-R1读取的固件矩阵顶部是缓冲A/B中断、最后核对cbdf3169…及临时端点，尚未恢复67；下方仍有“当前67”等历史行。以顶部中断记录及窗口Spec限定本次引用，不自行恢复或声称新读了设备。67为既有P3性能基线/恢复目标、a7精确回退均保留。fc55 G1缓存挥手后46,527B低水位未过48KiB，完整维护/G2未关闭。

## C01–C12：复核后的决定与缺口

表中“设计一致”指固件单方回复与本轮管理端选择相符，不代表代码/wire或资源验收已完成。

| ID | 已确认／管理端本轮决定 | 仍待确认或实现；下一证据 |
| --- | --- | --- |
| C01 能力执行 | **数值/模型确认**：schema2单encoded=playback/max/slot 5865472B；persistent 4+1、stride5869568、partition29360128，center53；媒体360/24/241/flag1/key12/tile20。A1/A6与固件常量一致 | 固件仅给capability_values表，缺protocols/firmware_version/board_profile，不能直接作为hello。R3已定义完整extensions/版本/identity表示；实际能力上报、hello绑定及实体装配待实现，未知能力拒绝 |
| C02 F/M/P/N | **真实字节身份已独立确认**：P=3afe4578…、M=9045bd6b…、N=dfc829e1…、源SHA=a6a2ddae…；46原ID/225509627B/11086帧全F/CRC/index通过；46源视频SHA256和固定86181ce提交git blob一致 | `license_ref=upstream-reference-only`原样保留，**无独立approval/真实CAS导入**。原始形象声明本次无法直接读取，发布/分发/用途许可复审待完成；改license_ref/目录字段须重算M/P并重新批准 |
| C03 metadata/信任 | **设计一致**：受信hub完整核P/M/F/源与媒体；设备持会话批准(P,M,N)+单descriptor，不收全46工作集；页≤8条且整个body≤4096B，超限减条目 | R3管理端选offset/next_offset/完整descriptor/(P,M,N)闭合分页；固件消费/实际许可绑定仍待实现；设备当前v5大目录路径不能作为新owner预算，G2说明实际释放/复用，不能假定已经节省RAM |
| C04 状态/恢复 | **证据语义一致**：accepted/verified/playing、display actual、storage saved及当前inventory独立；saved仅marker后元数据读回确认，命中已存不伪造新提交；淘汰同根更新available | 管理端R2逻辑gate/unknown恢复已验证；设备新wire/提交阶段结果钩子待实现。marker可能写入或确认失败→outcome_unknown/阻止新写；当前bool恢复把I/O失败与坏根折叠，不能直接把recover=true当未知已消除。低root/同seq冲突不降hub floor |
| C05 手动/触摸 | **管理端选择固件保守首窗口方案**：仅远端base0/11，physical4单次且本地优先；remote4暂禁，UI“触摸专用”。本地首帧token ACK起241/24秒，重复触摸新token；到期回最新有效base，否则idle0 | G0-R2已实现显式first-window-review/1的入队/派发cached0/11门禁与内部manualChoices，默认通用46候选保持；local/token/到期用纯模型对照，**真实UI/物理触摸和设备适配仍未实现**。其他动作随G4另扩；不改变旧v5/PC角色策略 |
| C06 首帧/维护 | **设计一致**：playing来自刷新提交及完整command/context/generation；local事件只更新actual，不回发4。loading/verifying/saving冻结最后有效画面，wall time不当动画elapsed | 现render在lv_refr_now路径后记presented_*，局部记录不是完整新身份，非面板扫描结束证明。同像素/同帧、旧token、维护恢复及独立display_seq需共同向量/钩子 |
| C07 wire/兼容 | **R3管理端提案已交付**：round-pet-native360-wire/1、/hub-device/v1路径、request_seq、完整能力/包、base_loop/descriptor、deferred_local、storage2命中/取消/未知、touch/display及固定错误/HTTP/恢复表；78正/62反经Node与独立C++宿主逐字节对照 | [合同/向量](../../protocol/round-pet-wire-v1.md)SHA需固件共同审阅；C++仅本仓库宿主oracle，非固件实现。旧A4/旧v5未改，正式runtime/真实UI、可信来源/时间/证书/提交/RTOS未装配，不能换名直连 |
| C08 取消/写预算 | **接受双边界设计**：取消准入gate与持久marker分开；gate前已观测取消不进入提交，gate后取消不承诺撤销保存，只禁止旧目标激活。marker/读回未知不得报未保存 | 管理端R2已补逻辑gate/取消后保存及恢复I/O/floor对照；固件persist仍只在commit前查取消，commit内部无回调，真实gate原子性/错误阶段钩子待实现。12次是启动内易失固定窗（首尝试起一小时），非滑动/跨重启硬限额；普通60秒，load完成约5秒且已呈现/非local才判断；installation仅维护、失败也占预算。G1实测与不可抢占上界仍缺 |
| C09 调度/期限 | **结构一致**：单在途control、单未派发latest、单待段，renew/cancel/revoke有界旗标，段后先exchange，不用8 FIFO | RTOS owner/让出/退出硬上界待实现实测。包括commit残余、全验/擦写与host磁盘成本；500ms poll/1s段仅假设。缺上界NO_GO，不延lease/放宽deadline掩盖排队 |
| C10 身份/认证 | **方向一致**：单TLS/HTTP owner，TLS1.2/P256仅探针候选，认证失败不降级IP/Bearer/明文 | 正式可信时间、密钥/证书/epoch持久提交、撤销/重绑定/丢钥恢复还缺可审查Spec与资源预算。RAM凭据探针不是配对，G2前不能开真实通道 |
| C11 资源/G1/G2 | **口径一致**：P3显式PSRAM6916777含64KiB read-ahead；保留内部≥48KiB、PSRAM≥1MiB/块≥512KiB、main栈≥1KiB及2MiB应用余量目标 | 最新G1并未通过全维护：fc55低水位门禁停止，后续A/B中断只覆盖A准入/待机，未缓存切换/点击，B未测。TLS峰值/最大内部块/新栈/清理未知；P3和loopback均不能放行 |
| C12 控制源/回退 | **设计一致**：启动网络owner前选择旧v5或新hub，断线不自动切源，不停整个pet/bridge；新session新hello/库存/控制，不重放旧命令 | 选择形式/持久策略/核验机制未实现；A5仅宿主OFF恢复。中断现场恢复需另获设备窗口授权，app/配置内容/凭据epoch/缓存分别恢复核对，不擅自触碰NVS/服务或整片恢复 |

## 下一次可独立验证的小切片

G0-R2已完成[35项离线对照](../../reports/2026-10-30-round-pet-g0-r2.md)：显式首窗口入队/派发门禁、profile固定/选主隔离、local/latest寿命、取消gate、marker未知与I/O/floor恢复；仅原创媒体/临时环境，无生产通道。旧R1未实现状态已[归档](../history/round-pet-g0-r2-evolution.md)，不重做该切片。
G0-R3已完成[24专项/双语言字节合同](../../reports/2026-11-02-round-pet-g0-r3.md)，旧未定义wire状态已[归档](../history/round-pet-g0-r3-evolution.md)。这是管理端提案，不代固件签核。

1. **共同评审与默认OFF宿主adapter**：固件任务先独立核合同SHA/同一向量与资源可行性；后续管理端adapter先Spec/Diff，仅临时loopback，复用现有session/guard/A2/A3/R2/A8，验证hello选择绑定、错误/pending与schema2投影、取消/命中/迟到/unknown，不扩旧profile或启用生产listener。真实UI/设备消费另验；若双方修改字段需显式修订合同/向量，不能静默改旧字节。
2. **真实素材独立批准**。G0-R1身份已固定，下一补原始许可链/用途/署名与分发范围记录，再选择是否建立**仅offline-validation**的A2批准并测试真实完整库导入/重开。approval由独立审阅输入提供，不把本复核JSON/哈希自封为批准；任何生产/商业分发另审。
3. **等待固件资源证据**。G1维护、G2时间/凭据/单owner/TLS/有限清理通过后，才准备G3真实缓存0/11+physical4方案/具体回退和单独窗口。G4再未缓存下载、校验、首帧、保存、淘汰、断连/重连。400/跨角色/多设备/BLE/OTA/音频不合并。

## 联合关闭与回退

联合G0仍**未关闭**：C02用途批准、C07提案的固件共同签核/固件消费与实际adapter，以及C04/C08/C09/C10/C12具体边界/身份设计还缺交付。G1/G2是独立执行门禁，不能以设计一致替代实测。管理端不改固件回复中的旧hub快照，由固件任务下次读取本交付自行刷新；本轮没有发送消息。

本轮无外部运行变化；撤回显式profile/局部门禁或关闭自有临时owner即可，无数据格式/TTL迁移或应用/配置/NVS/缓存恢复操作。未来实物操作前以最新矩阵+独立读回冻结现场、保护67/a7与窗口前完整备份；仅恢复app不等于恢复配置/绑定/缓存。当前临时端点/服务属于另一窗口，本轮不启动、停止或清理它们。

管理端R2[API](../../protocol/round-pet-g0-r2.md)明确：cachedHitInventoryOnly仅本地模拟结果，不是新的storage ACK；R3现已定义取消/命中与pending的独立关联表达并做宿主对照，待共同签核/实际adapter消费。本轮gate并非固件RTOS锁或Flash字节实现，不豁免G1/G2、许可批准及设备窗口。
```
