# G0-R7 gate失联恢复演进

2026-11-02。R7替代以下R6中“gate失联无法收尾/下一验证”的模型缺口；原闭环/承载、默认OFF、共同签核/许可/固件资源门槛保持。最新[R7报告](../../reports/2026-11-02-round-pet-g0-r7.md)、[API](../../protocol/round-pet-gated-recovery.md)。历史链接按原文件位置解读。

## 原 docs/context/current-system.md

```text
2026-11-02 [G0-R6新wire A1 actor闭环](../reports/2026-11-02-round-pet-g0-r6.md)已复用既有actor/Flash/executor，经新hello/exchange/GET验证未缓存下载、全F/PET4/CRC/index、独立submit首帧、保存/淘汰/命中非saved、unknown恢复及重连/新owner/模型reboot；30专项、check（仅.mjs语法）及含构建910/910通过（含并行素材3项），正常/SIGTERM自有临时清理通过。新wire模式显式启用且simulator不进候选；R3修订2/80正62反及A1核心保持。窄修loading+当前downloading读许可及A5已有EMPTY/IDLE_READY安全门禁，默认OFF/readBudget=null/R2首窗口不放宽，R4/R5其他承载/状态/A8顺序保持。原未接A1状态已[归档](history/round-pet-g0-r6-evolution.md)。gate期间失联/租约或暂停失效后的旧提交收尾仍未完整验证，下一先Spec/Diff，不强清commit_in_progress；共同签核/真实许可/固件G1/G2/生产及设备窗口仍未完成，本轮未新读外部状态。
```

## 原 docs/context/current-todos.md

```text
1. **共同契约与gate失联/暂停收尾、独立用途批准**：R6[新wire A1 actor闭环/30专项](../reports/2026-11-02-round-pet-g0-r6.md)已验证未缓存下载、全校验、独立首帧、保存/淘汰/unknown恢复及重连/新owner/模型reboot，不重写模型或重做R4/R5。下一先Spec/Diff，仅原创临时CAS/PKI/真实loopback/双虚拟时钟，评审gate期间失联、lease/暂停失效与非可取消旧commit收尾/迟到终态：现actor的commit_in_progress必须保持阻塞，不偷清gate/降root/补saved/续TTL；明确何时可完成旧提交、何时只能显式模型恢复/新库存与新控制。R3修订2/80正62反、GET关联及资源边界仍需固件独立共同审阅，宿主C++不代签核。真实360/46身份已核，原始形象声明直读、用途/署名传播范围与独立offline-validation approval仍缺，批准后另审真实A2全库导入/重开，不把原创测试批准当真实素材批准。保持默认OFF、无生产/正式UI/设备接线。
```

## 原 docs/protocol/round-pet-wire-execution.md

```text
# G0-R6 A1 actor／新wire 离线执行对照

2026-11-02。[Spec](../context/plans/round-pet-g0-r6-spec.md)/[Diff](../context/plans/round-pet-g0-r6-diff.md)、[报告](../reports/2026-11-02-round-pet-g0-r6.md)。这是模型设备端验证，不是实体设备驱动或生产入口。

## 复用与装配

[既有模拟executor](../../packages/simulator/round-pet-executor.mjs)增加显式wireProfile=round-pet-native360-wire/1；缺省旧A6模式不变。Native360DeviceModel、Native360FlashModel及MemoryNative360Flash直接复用，未修改模型内核、V2 namespace或根权威。actor/simulator继续排除在插件候选dist之外。

[新lab](../../tests/fixtures/round-pet-wire-execution-lab.mjs)复用R4/R5 checked client与真实临时mTLS/A2/A8；autoApply=false禁用静态peer库存/播放/保存，只有原lease授予编码保留。初始化缓存也由actor逐个request/load/supply/verify/save事务形成，再关闭/reopen actor验证恢复，不能直接造库存JSON。

host/device使用独立VirtualClock（初始偏移700000ms）；grant相对时长按原leaseSendBudget保守换算，实际控制仍由原session/guard。每次actor记录通过新exchange，经真实TLS/新ledger/A3显式schema2入口；网络文件逐段由新GET、If-Range/许可/关联/逐块授权取得，完整收到后才交actor。

## 执行与证据边界

| 动作 | 得出的事实 | 不能替代 |
| --- | --- | --- |
| executor.receive(playback.set) | actor.request已接纳，schema2 admission=ready | 下载/完整校验/首帧 |
| load未命中／supply | source=network、downloading；supply复制完整字节但未验证 | verified/playing |
| verify | 原verifyRoundPetAsset完成F、PET4头、241帧CRC/index核验 | 刷新提交 |
| prepareFrame | 本地不透明frame token | 首帧或面板完成 |
| submitFrame | actor注入刷新提交，独立playback playing及display | 真实LCD面板扫描/ESP刷新证据 |
| beginSave/writeSave | 完整staging仍不属于可用库存 | 持久提交 |
| gateSave/commitSave | 模型逻辑门禁/有效根提交，storage saved/root_commit | 当前完整inventory/恢复动画 |
| cache hit | already_available/inventory_reference，引用已知对象/根 | 新saved/新root |
| inventory query | 完整同根当前离线可用与淘汰，经A8 durable后发布 | 历史saved补发/控制权 |

新控制校验完整target/control/package/mode/descriptor后才变更actor；旧裸command_id取消不能混用。新模式outbox最多16，流序列uint64，inventory按action_id规范化；manifest/P/M及R3修订2/80正62反JSON字节不变。

## 维护、取消与未知

display snapshot由actor查询产生，保留最后已提交画面及原source_context；新会话或新目标不能改写旧画面来源。维护冻结最后有效帧，不承诺旧动画继续。新adapter仅在full-review、当前目标已ready且playback=downloading时允许maintenance=loading继续GET；saving/verifying/recovering/blocked/触摸/旧目标仍拒绝。未查询的维护变化不自动假装已有完整推送/UI接线。

EMPTY只准0，IDLE_READY只准0/4，再OFFLINE_READY扩其他动作；规则与A5一致，入队/派发及actor各自检查。R2缺省首窗口仍cached0/11、remote4/保存禁用；本片full-offline-review不是实体操作准入。

deferSave先以同dispatch发deferred/pre_gate释放控制槽；后续保存终态同operation_id、dispatch=null且更高seq。gate前取消actor真正取消staging，发cancelled_pre_gate及独立cancel.report；gate后保留非可取消commit，只fence播放，允许saved/unknown，旧frame无法激活。只有显式新wire模式提供gateSave；旧A6默认语义保持。

marker或读回不确定仍outcome_unknown，阻新写，不能因bool失败称未保存。恢复复用actor recoverStorage/reboot；I/O失败继续unknown，完整inventory查询确认可用，不给历史操作补saved。低root/同seq冲突不得下降A8 floor；模型中旧有效根回退也会被hub拒绝，不自动降级/格式化。

## 重连与资源

正常断线先清outbox/volatile/control，actor.beginSession接受新完整context，保留逻辑Flash及最后画面；新hello/库存后必须重新acquire，不续旧会话租约或重放manual。旧context/load/frame token拒绝。丢saved回执靠新库存收敛，不补历史saved。

lab支持显式重建宿主owner：关闭旧adapter/session/store，按同CAS的cachedOnly A2重开、同绑定A8 floor及新service instance继续，actor/medium不重启。它是同进程内新owner对照，不称真实管理进程崩溃或全盘防回滚。显式actor reboot则重扫模型根、清像素/旧token，已保存动作可从Flash RAM加载而不再GET。

gate期间失联不保证无缝重连：actor会拒绝commit_in_progress；本片不强清门禁、补saved或在新session继续旧提交。该分支需独立方案验证可恢复边界。模型Flash为内存逻辑持久，JS测试驱动还持下载buffer/副本，encoded_buffers=1不等于ESP实际RAM或RSS上限。

关闭等真实HTTP/read退出后释放A2 reader/pin，executor释放medium claim；均只处理自有临时资源。无真实设备/固件/素材、生产listener、插件/外部配置变化或提交推送。

## 复验与后续

```sh
node scripts/verify-round-pet-g0-r6.mjs --output .cache/round-pet-g0-r6/results.json
npm run check
npm test
```

30专项及通过/未覆盖见报告；新增闭环不代固件协议互操作或物理资源准入。下一优先离线评审gate期间失联/暂停、迟到终态与恢复策略，保留原有门禁而不扩TTL；共同G0/GET合同、真实许可、固件G1/G2与设备窗口并行待验。回退关闭自有lab并等实际I/O退出，撤回executor显式模式/fixture及loading/EMPTY窄修正，无格式或期限迁移。
```

## 原 docs/context/plans/round-pet-g0-handoff.md

```text
# 给固件任务：G0 契约决定／待确认项

2026-11-02 G0-R6刷新；外部事实仍限定G0-R1只读快照，本轮未新读固件/设备。管理端已只读复核固件[回复](/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio/docs/protocol/round-pet-native360-g0-reply.md)及[输入向量](/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio/docs/protocol/vectors/round-pet-native360-g0-inputs.json)，并独立重验真实360/46库。[管理端报告](../../reports/2026-10-30-round-pet-g0-reconciliation.md)、[基线差异表](../round-pet-hub-baseline-alignment.md)、[无批准的身份复核向量](../../protocol/vectors/round-pet-g0-real360-review-v1.json)为本轮证据。旧交接全篇已[归档](../history/round-pet-g0-reconciliation-evolution.md)。本文是可交付文档，**未发送消息、不是共同签核/生产wire装配或设备操作授权**；固件仓库未修改。真实身份与外部事实在G0-R1核对，本轮仅补A1 actor经新wire的离线闭环；修订2合同/向量及GET关联规则仍须共同审阅。

## 当前边界

- 正式闭环仍是一块1.75C-EN、360²/24fps/241帧/46原ID；466²居中、单encoded、V2 28MiB/4活跃＋1暂存、保护动作0/4，不改N/分区/格式。400/78与分层角色是独立候选。
- 管理端A1–A10宿主候选已实现，scoped/静态证书减量与逐次动态授权保持，生产通道默认关闭。固件回复中的469或385项是旧hub快照，不重做已完成承载优化；最新全套数见[当前系统](../current-system.md)。
- G0-R1读取的固件矩阵顶部是缓冲A/B中断、最后核对cbdf3169…及临时端点，尚未恢复67；下方仍有“当前67”等历史行。以顶部中断记录及窗口Spec限定本次引用，不自行恢复或声称新读了设备。67为既有P3性能基线/恢复目标、a7精确回退均保留。fc55 G1缓存挥手后46,527B低水位未过48KiB，完整维护/G2未关闭。

## C01–C12：复核后的决定与缺口

表中“设计一致”指固件单方回复与本轮管理端选择相符，不代表代码/wire或资源验收已完成。

| ID | 已确认／管理端本轮决定 | 仍待确认或实现；下一证据 |
| --- | --- | --- |
| C01 能力执行 | **数值/模型确认**：schema2单encoded=playback/max/slot 5865472B；persistent 4+1、stride5869568、partition29360128，center53；媒体360/24/241/flag1/key12/tile20。A1/A6与固件常量一致 | 固件仅给capability_values表，缺protocols/firmware_version/board_profile，不能直接作为hello。R3已定义完整extensions/版本/identity；R4临时宿主同socket hello绑定已实现，实际能力上报及实体装配待实现，未知能力拒绝 |
| C02 F/M/P/N | **真实字节身份已独立确认**：P=3afe4578…、M=9045bd6b…、N=dfc829e1…、源SHA=a6a2ddae…；46原ID/225509627B/11086帧全F/CRC/index通过；46源视频SHA256和固定86181ce提交git blob一致 | `license_ref=upstream-reference-only`原样保留，**无独立approval/真实CAS导入**。原始形象声明本次无法直接读取，发布/分发/用途许可复审待完成；改license_ref/目录字段须重算M/P并重新批准 |
| C03 metadata/信任 | **设计一致**：受信hub完整核P/M/F/源与媒体；设备持会话批准(P,M,N)+单descriptor，不收全46工作集；页≤8条且整个body≤4096B，超限减条目 | R3管理端选offset/next_offset/完整descriptor/(P,M,N)闭合分页；R5临时宿主分页/许可已实现，固件消费/实际许可绑定仍待实现；设备当前v5大目录路径不能作为新owner预算，G2说明实际释放/复用，不能假定已经节省RAM |
| C04 状态/恢复 | **证据语义一致**：accepted/verified/playing、display actual、storage saved及当前inventory独立；saved仅marker后元数据读回确认，命中已存不伪造新提交；淘汰同根更新available | 管理端R2逻辑gate/unknown恢复已验证；R6新wire/actor提交阶段结果已宿主验证，设备钩子仍待实现。marker可能写入或确认失败→outcome_unknown/阻止新写；当前bool恢复把I/O失败与坏根折叠，不能直接把recover=true当未知已消除。低root/同seq冲突不降hub floor |
| C05 手动/触摸 | **管理端选择固件保守首窗口方案**：仅远端base0/11，physical4单次且本地优先；remote4暂禁，UI“触摸专用”。本地首帧token ACK起241/24秒，重复触摸新token；到期回最新有效base，否则idle0 | G0-R2已实现显式first-window-review/1的入队/派发cached0/11门禁与内部manualChoices，默认通用46候选保持；local/token/到期用纯模型对照，**真实UI/物理触摸和设备适配仍未实现**。其他动作随G4另扩；不改变旧v5/PC角色策略 |
| C06 首帧/维护 | **设计一致**：playing来自刷新提交及完整command/context/generation；local事件只更新actual，不回发4。loading/verifying/saving冻结最后有效画面，wall time不当动画elapsed | 现render在lv_refr_now路径后记presented_*，局部记录不是完整新身份，非面板扫描结束证明。同像素/同帧、旧token、维护恢复及独立display_seq需共同向量/钩子 |
| C07 wire/兼容 | **R3管理端提案已交付**：round-pet-native360-wire/1、/hub-device/v1路径、request_seq、完整能力/包、base_loop/descriptor、deferred_local、storage2命中/取消/未知、touch/display及固定错误/HTTP/恢复表；R4修订2的80正/62反经Node与独立C++宿主逐字节对照 | [合同/向量](../../protocol/round-pet-wire-v1.md)SHA需固件共同审阅；C++仅本仓库宿主oracle，非固件实现。旧A4/旧v5未改，临时hello/exchange runtime/schema2映射已由R4接入；R5又补临时GET/逐块授权；生产runtime/设备GET/真实UI、设备可信来源/时间/证书/提交/RTOS未装配，不能换名直连 |
| C08 取消/写预算 | **接受双边界设计**：取消准入gate与持久marker分开；gate前已观测取消不进入提交，gate后取消不承诺撤销保存，只禁止旧目标激活。marker/读回未知不得报未保存 | 管理端R2已补逻辑gate/取消后保存及恢复I/O/floor对照；固件persist仍只在commit前查取消，commit内部无回调，真实gate原子性/错误阶段钩子待实现。12次是启动内易失固定窗（首尝试起一小时），非滑动/跨重启硬限额；普通60秒，load完成约5秒且已呈现/非local才判断；installation仅维护、失败也占预算。G1实测与不可抢占上界仍缺 |
| C09 调度/期限 | **结构一致**：单在途control、单未派发latest、单待段，renew/cancel/revoke有界旗标，段后先exchange，不用8 FIFO | RTOS owner/让出/退出硬上界待实现实测。包括commit残余、全验/擦写与host磁盘成本；500ms poll/1s段仅假设。缺上界NO_GO，不延lease/放宽deadline掩盖排队 |
| C10 身份/认证 | **方向一致**：单TLS/HTTP owner，TLS1.2/P256仅探针候选，认证失败不降级IP/Bearer/明文 | 正式可信时间、密钥/证书/epoch持久提交、撤销/重绑定/丢钥恢复还缺可审查Spec与资源预算。RAM凭据探针不是配对，G2前不能开真实通道 |
| C11 资源/G1/G2 | **口径一致**：P3显式PSRAM6916777含64KiB read-ahead；保留内部≥48KiB、PSRAM≥1MiB/块≥512KiB、main栈≥1KiB及2MiB应用余量目标 | 最新G1并未通过全维护：fc55低水位门禁停止，后续A/B中断只覆盖A准入/待机，未缓存切换/点击，B未测。TLS峰值/最大内部块/新栈/清理未知；P3和loopback均不能放行 |
| C12 控制源/回退 | **设计一致**：启动网络owner前选择旧v5或新hub，断线不自动切源，不停整个pet/bridge；新session新hello/库存/控制，不重放旧命令 | 选择形式/持久策略/核验机制未实现；A5仅宿主OFF恢复。中断现场恢复需另获设备窗口授权，app/配置内容/凭据epoch/缓存分别恢复核对，不擅自触碰NVS/服务或整片恢复 |

## 下一次可独立验证的小切片

G0-R2已完成[35项离线对照](../../reports/2026-10-30-round-pet-g0-r2.md)：显式首窗口入队/派发门禁、profile固定/选主隔离、local/latest寿命、取消gate、marker未知与I/O/floor恢复；仅原创媒体/临时环境，无生产通道。旧R1未实现状态已[归档](../history/round-pet-g0-r2-evolution.md)，不重做该切片。
G0-R3已完成[24专项/双语言字节合同](../../reports/2026-11-02-round-pet-g0-r3.md)，旧未定义wire状态已[归档](../history/round-pet-g0-r3-evolution.md)。这是管理端提案，不代固件签核。

1. **共同评审与gate失联/暂停收尾**：R6已复用A1 actor/executor，经新wire hello/exchange/GET完成离线下载/全验/独立首帧/保存/淘汰/重连对照；见[API](../../protocol/round-pet-wire-execution.md)。这不是固件消费或物理Flash/面板完成，R3修订2字节与A1核心保持。下一先Spec/Diff评审gate期间失联、lease/暂停失效、旧提交收尾与迟到终态，不清commit_in_progress/降root/补saved/延TTL；只用原创临时环境，明确恢复/新库存/新控制条件。固件仍须独立签核共同字段/GET关联与G1/G2，真实UI/生产/设备另验。
2. **真实素材独立批准**。G0-R1身份已固定，下一补原始许可链/用途/署名与分发范围记录，再选择是否建立**仅offline-validation**的A2批准并测试真实完整库导入/重开。approval由独立审阅输入提供，不把本复核JSON/哈希自封为批准；任何生产/商业分发另审。
3. **等待固件资源证据**。G1维护、G2时间/凭据/单owner/TLS/有限清理通过后，才准备G3真实缓存0/11+physical4方案/具体回退和单独窗口。G4再未缓存下载、校验、首帧、保存、淘汰、断连/重连。400/跨角色/多设备/BLE/OTA/音频不合并。

## 联合关闭与回退

联合G0仍**未关闭**：C02用途批准、C07修订2的固件共同签核/固件消费与生产装配（临时宿主hello/exchange已实现），以及C04/C08/C09/C10/C12具体边界/身份设计还缺交付。G1/G2是独立执行门禁，不能以设计一致替代实测。管理端不改固件回复中的旧hub快照，由固件任务下次读取本交付自行刷新；本轮没有发送消息。

本轮无外部运行变化；撤回显式profile/局部门禁或关闭自有临时owner即可，无数据格式/TTL迁移或应用/配置/NVS/缓存恢复操作。未来实物操作前以最新矩阵+独立读回冻结现场、保护67/a7与窗口前完整备份；仅恢复app不等于恢复配置/绑定/缓存。当前临时端点/服务属于另一窗口，本轮不启动、停止或清理它们。

管理端R2[API](../../protocol/round-pet-g0-r2.md)明确：cachedHitInventoryOnly仅本地模拟结果，不是新的storage ACK；R3现已定义取消/命中与pending的独立关联表达并做宿主对照，已由R4临时adapter消费验证，待共同签核/设备消费。本轮gate并非固件RTOS锁或Flash字节实现，不豁免G1/G2、许可批准及设备窗口。
```
