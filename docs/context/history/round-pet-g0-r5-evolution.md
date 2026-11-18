# G0-R5 GET／分段承载演进

2026-11-02。R5替代以下R4记录中的“无GET/read_permit/待接临时分段”缺口；不替代共同签核、真实素材批准、固件资源/实物验证与默认OFF限制。R3修订2合同/向量字节保持；当前证据见[R5报告](../../reports/2026-11-02-round-pet-g0-r5.md)。历史相对链接仅按当时文件位置解读。

## 原 docs/context/current-system.md

```text
2026-11-02 [G0-R4临时宿主adapter](../reports/2026-11-02-round-pet-g0-r4.md)已接默认OFF的新hello/exchange、schema2投影、取消/命中/迟到/unknown恢复及A8故障顺序；复用现有session/guard/A2/A3/R2/A8，无CLI/插件/服务入口。30专项、check（仅.mjs语法）与含构建全套844/844通过（较R3另含并行素材3项，非全由R4新增）；监督正常/SIGTERM清临时环境。R3合同修订2只增显式离线full-review选择，原字节保持，80正/62反Node-C++宿主对照通过；原78正/62反及合同按原SHA[归档](history/round-pet-g0-r4-evolution.md)。旧hello/A4/旧A3入口不放宽，无新GET/read_permit、正式UI或生产/设备装配。共同签核、真实素材独立批准及固件G1/G2仍未完成；C++只是宿主数据oracle，本轮未新读外部状态。下一新路径临时GET/分段先Spec/Diff，见[交接](plans/round-pet-g0-handoff.md)。
```

## 原 docs/context/current-todos.md

```text
1. **共同wire评审与新路径临时GET/分段、独立用途批准**：R4[默认OFF临时adapter/30专项](../reports/2026-11-02-round-pet-g0-r4.md)已接新hello、schema2投影、取消/命中/迟到/unknown与A8故障顺序，不重做该片；当前[合同修订2](../protocol/round-pet-wire-v1.md)80正/62反需固件独立共同审阅，本仓库C++ oracle不代签核。管理端下一先Spec/Diff，在原创临时loopback复用A4 Range/读许可/每4KiB动态授权和实际I/O退出，接/hub-device/v1 GET、manifest offset/包绑定、段后exchange/续租与有界调度；新adapter当前无GET handler/read_permit。保持OFF/无生产配置/UI/设备，旧profile不放宽。真实360/46的P/M/N/F/源/原ID已核；原始形象声明直读、用途/署名传播范围与独立offline-validation approval仍缺，批准后另审真实A2全库导入/重开，不把复核JSON或原创测试批准当真实素材批准。
```

## 原 docs/protocol/round-pet-wire-review.md

```text
# temporary-wire-review/1 临时宿主 adapter

2026-11-02，G0-R4。[Spec](../context/plans/round-pet-g0-r4-spec.md)/[Diff](../context/plans/round-pet-g0-r4-diff.md)、[实施报告](../reports/2026-11-02-round-pet-g0-r4.md)。这是内部显式离线验证入口，没有服务CLI、IPC/UI或插件开关，不自行创建网络listener；生产deviceTransport=false保持。

## 所有者与入口

createRoundPetWireReview(directory,{material,sessions,readView,rootAuthority,clock,caps,executionProfile,ackMs})：directory为独立私有CAS，material走既有A2独立approval及worker全包验证/来源发布；借用现有session-runtime、同步readView和A8 bindingRootAuthority；自行拥有catalog/reader/A3/ledger/队列。ready成功只代表素材已离线验证，仍disabled。失败不安装/启用任何东西。

- enableReview显式等待ready及空HTTP槽，启用review；不创建socket。缺省executionProfile=first-window-review/1，复用R2入队/派发cached0/11门禁，remote4与保存拒绝。仅原创fixture可显式固定full-offline-review/1覆盖保存/命中/未知恢复，无运行中profile切换。
- hello/exchange输入完整canonical wire字节及真实服务端TLSSocket；handler仅由测试调用方显式挂载于私有127.0.0.1动态mTLS server（maxHeaderSize8192、maxConnections1、禁TLS恢复），双端地址限制；handler单HTTP/4KiB body/头计量/期限，禁编码和chunked，等待response实际close后释放槽。
- lease/manual/save/cancel/query是受信宿主内部操作，不接受网络调用。manual仅请求desired，verified/playing/saved/actual只能来自有来源的独立报告；cancel仅取消当前已派发target并先栅栏其晚回执，不伪造设备cancelled phase。新意图仍由单latest队列处理。
- snapshot返回review观察与wire扩展，未接公开UI白名单；resources供诊断。disable先fence，再等真实HTTP退出；close还释放A2 worker/pin/reader并关闭A3，不关闭借用store/session owner。调用方负责退出server、所有socket及临时根；资源不确定时不得重连抢槽。

没有manifest/asset GET handler、不发read_permit；因此本片不代表素材传输已通过新协议。旧A4分段/读许可与每4KiB动态检查保持，不复制或绕过它；下一切片另Spec/Diff显式接入新路径。

## Hello 与严格版本

[R3合同修订2](round-pet-wire-v1.md)只扩challenge/ready的execution_profile候选（首窗口/显式离线full-review），不改已有字段或原78正例字节；新增2正例，当前80正/62反经原独立Node/C++宿主对照。旧R3[合同](vectors/round-pet-wire-r3-contract.json)/[向量](vectors/round-pet-wire-r3-vectors.json)按原SHA保留，新的SHA须固件重新审阅，单方提案不代表双方已同意。

新adapter完整校验schema2/包/版本后，显式构造旧session begin/confirm输入，包/版本/挑战/单调request_seq绑定同socket和context。session增加discard(socket)仅清该socket未完成挑战/当前会话，不写元数据。旧hello闭合字段不变；新信封不能直接调旧入口。confirm后ledger以该hello request_seq设高水位，exchange不能回放到握手前。断线/坏选择/重放清挑战/ledger/队列，重连须新hello/库存/lease，不回放旧manual。

lease命令派发才由原beginLease登记发送时刻，回执子记录经原canonical lease parser、TLS attest、guard accept；不造proof、不以UI入队计时、不延TTL。动态日期/撤销/元数据仍逐scope验证，A10已有减量不重做。失败会话直接被现有auth销毁socket，**不保证总能收到HTTP error体**；未建立权威的格式错误可固定错误码响应，未暴露raw cause，无自动重试。

## A3 schema2 与 A8 顺序

A3新增显式openWire/ingestWire/prepareIngestWire，旧ingest依旧schema1。新入口先验证R3原记录及原始context/proof，再集中规范化旧reducer已有语义；schema2 admission、maintenance generation/reason、历史source_context及touch/cancel保存在有界只读扩展中，不静默丢字段或扩公共UI schema。

缓存命中already_available只接受**当前已确认同root、同F/bytes/action/generation**库存，历史记录保留inventory_reference，不生成saved或提升floor。saved仍root_commit；cancelled_pre_gate仅取消保存结果，不代播放取消。cancel先标本地intent fence，晚playing会失败关闭，保存可继续saved/unknown；cancel.outcome_unknown同样使库存unknown/阻新写，不能借playback_only推导Flash回退。触摸有独立event_seq/token/phase顺序，仅观察、不回发remote4；实际本地优先/首帧寿命仍需设备执行钩子，不能用PC事件替代。

storage/inventory由A3prepare得到私有候选及checkpoint→退出readView→A8 durable CAS→新同步scope核同session→commitPrepared，之后才能ACK/发下一control。失败discard并fence；before_write不发布，after_rename结果未知也不发布，只有明确关闭旧owner/重开临时store才读取持久结果。完整库存确认前写门禁关闭；unknown不降floor、不补历史saved、不盲重试，完整同绑定新库存查询才能解除。淘汰以新完整root更新offline_available，saved历史保持。

request_seq/dispatch/operation/target/包/lease epoch先经R3 ledger关联，实际操作/根语义再经A3/A8；后一步失败会整体fence会话，不能继续用已推进ledger的半接受状态。最大1 HTTP/1待ACK control/1 latest/1 ordinary及有界紧急旗标，ACK及入队deadline保持，close不自动重放。

## 验证与回退

30专项见报告：实际临时TLS/绑定映射、原创A2素材与虚拟时钟，含命中、维护/历史画面、本地触摸、取消迟到、marker未知与低root、before_write/after_rename不发布、撤销/坏档、重连及真实退出。不是ESP资源、固件RTOS/刷新/持久事务、物理掉电或最坏延迟证明。

```sh
node scripts/verify-round-pet-g0-r4.mjs --output .cache/round-pet-g0-r4/results.json
npm run check
npm test
```

回退disable/close自有adapter后由fixture关闭自有TLS/目录，撤回新模块和A3显式wire入口即可；无旧数据/配置/namespace/期限迁移。共同G0签核、真实许可用途批准、G1/G2与独立设备窗口仍未关闭，不恢复外部A/B现场或修改固件/pet/bridge/DSH配置。
```

## 原 docs/context/plans/round-pet-g0-handoff.md

```text
# 给固件任务：G0 契约决定／待确认项

2026-11-02 G0-R4刷新；外部事实仍限定G0-R1只读快照，本轮未新读固件/设备。管理端已只读复核固件[回复](/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio/docs/protocol/round-pet-native360-g0-reply.md)及[输入向量](/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio/docs/protocol/vectors/round-pet-native360-g0-inputs.json)，并独立重验真实360/46库。[管理端报告](../../reports/2026-10-30-round-pet-g0-reconciliation.md)、[基线差异表](../round-pet-hub-baseline-alignment.md)、[无批准的身份复核向量](../../protocol/vectors/round-pet-g0-real360-review-v1.json)为本轮证据。旧交接全篇已[归档](../history/round-pet-g0-reconciliation-evolution.md)。本文是可交付文档，**未发送消息、不是共同签核/生产wire装配或设备操作授权**；固件仓库未修改。真实身份与外部事实在G0-R1核对，本轮仅补临时宿主adapter；修订2合同/向量须重新共同审阅。

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
| C03 metadata/信任 | **设计一致**：受信hub完整核P/M/F/源与媒体；设备持会话批准(P,M,N)+单descriptor，不收全46工作集；页≤8条且整个body≤4096B，超限减条目 | R3管理端选offset/next_offset/完整descriptor/(P,M,N)闭合分页；固件消费/实际许可绑定仍待实现；设备当前v5大目录路径不能作为新owner预算，G2说明实际释放/复用，不能假定已经节省RAM |
| C04 状态/恢复 | **证据语义一致**：accepted/verified/playing、display actual、storage saved及当前inventory独立；saved仅marker后元数据读回确认，命中已存不伪造新提交；淘汰同根更新available | 管理端R2逻辑gate/unknown恢复已验证；设备新wire/提交阶段结果钩子待实现。marker可能写入或确认失败→outcome_unknown/阻止新写；当前bool恢复把I/O失败与坏根折叠，不能直接把recover=true当未知已消除。低root/同seq冲突不降hub floor |
| C05 手动/触摸 | **管理端选择固件保守首窗口方案**：仅远端base0/11，physical4单次且本地优先；remote4暂禁，UI“触摸专用”。本地首帧token ACK起241/24秒，重复触摸新token；到期回最新有效base，否则idle0 | G0-R2已实现显式first-window-review/1的入队/派发cached0/11门禁与内部manualChoices，默认通用46候选保持；local/token/到期用纯模型对照，**真实UI/物理触摸和设备适配仍未实现**。其他动作随G4另扩；不改变旧v5/PC角色策略 |
| C06 首帧/维护 | **设计一致**：playing来自刷新提交及完整command/context/generation；local事件只更新actual，不回发4。loading/verifying/saving冻结最后有效画面，wall time不当动画elapsed | 现render在lv_refr_now路径后记presented_*，局部记录不是完整新身份，非面板扫描结束证明。同像素/同帧、旧token、维护恢复及独立display_seq需共同向量/钩子 |
| C07 wire/兼容 | **R3管理端提案已交付**：round-pet-native360-wire/1、/hub-device/v1路径、request_seq、完整能力/包、base_loop/descriptor、deferred_local、storage2命中/取消/未知、touch/display及固定错误/HTTP/恢复表；R4修订2的80正/62反经Node与独立C++宿主逐字节对照 | [合同/向量](../../protocol/round-pet-wire-v1.md)SHA需固件共同审阅；C++仅本仓库宿主oracle，非固件实现。旧A4/旧v5未改，临时hello/exchange runtime/schema2映射已由R4接入；生产runtime/GET/真实UI、设备可信来源/时间/证书/提交/RTOS未装配，不能换名直连 |
| C08 取消/写预算 | **接受双边界设计**：取消准入gate与持久marker分开；gate前已观测取消不进入提交，gate后取消不承诺撤销保存，只禁止旧目标激活。marker/读回未知不得报未保存 | 管理端R2已补逻辑gate/取消后保存及恢复I/O/floor对照；固件persist仍只在commit前查取消，commit内部无回调，真实gate原子性/错误阶段钩子待实现。12次是启动内易失固定窗（首尝试起一小时），非滑动/跨重启硬限额；普通60秒，load完成约5秒且已呈现/非local才判断；installation仅维护、失败也占预算。G1实测与不可抢占上界仍缺 |
| C09 调度/期限 | **结构一致**：单在途control、单未派发latest、单待段，renew/cancel/revoke有界旗标，段后先exchange，不用8 FIFO | RTOS owner/让出/退出硬上界待实现实测。包括commit残余、全验/擦写与host磁盘成本；500ms poll/1s段仅假设。缺上界NO_GO，不延lease/放宽deadline掩盖排队 |
| C10 身份/认证 | **方向一致**：单TLS/HTTP owner，TLS1.2/P256仅探针候选，认证失败不降级IP/Bearer/明文 | 正式可信时间、密钥/证书/epoch持久提交、撤销/重绑定/丢钥恢复还缺可审查Spec与资源预算。RAM凭据探针不是配对，G2前不能开真实通道 |
| C11 资源/G1/G2 | **口径一致**：P3显式PSRAM6916777含64KiB read-ahead；保留内部≥48KiB、PSRAM≥1MiB/块≥512KiB、main栈≥1KiB及2MiB应用余量目标 | 最新G1并未通过全维护：fc55低水位门禁停止，后续A/B中断只覆盖A准入/待机，未缓存切换/点击，B未测。TLS峰值/最大内部块/新栈/清理未知；P3和loopback均不能放行 |
| C12 控制源/回退 | **设计一致**：启动网络owner前选择旧v5或新hub，断线不自动切源，不停整个pet/bridge；新session新hello/库存/控制，不重放旧命令 | 选择形式/持久策略/核验机制未实现；A5仅宿主OFF恢复。中断现场恢复需另获设备窗口授权，app/配置内容/凭据epoch/缓存分别恢复核对，不擅自触碰NVS/服务或整片恢复 |

## 下一次可独立验证的小切片

G0-R2已完成[35项离线对照](../../reports/2026-10-30-round-pet-g0-r2.md)：显式首窗口入队/派发门禁、profile固定/选主隔离、local/latest寿命、取消gate、marker未知与I/O/floor恢复；仅原创媒体/临时环境，无生产通道。旧R1未实现状态已[归档](../history/round-pet-g0-r2-evolution.md)，不重做该切片。
G0-R3已完成[24专项/双语言字节合同](../../reports/2026-11-02-round-pet-g0-r3.md)，旧未定义wire状态已[归档](../history/round-pet-g0-r3-evolution.md)。这是管理端提案，不代固件签核。

1. **共同评审与临时GET/分段衔接**：R4已完成默认OFF临时hello/exchange adapter、schema2投影及取消/命中/迟到/unknown/A8故障验证；见[API](../../protocol/round-pet-wire-review.md)。固件任务需核修订2合同SHA/80正62反与资源可行性，不把本仓库C++ oracle当签核。管理端下一先Spec/Diff，复用A4既有Range/4KiB授权检查与实际I/O退出机制接新路径/许可/有界调度，仅临时loopback；新adapter目前不发read_permit/无GET handler。真实UI/生产/设备消费另验，不能换名直连。
2. **真实素材独立批准**。G0-R1身份已固定，下一补原始许可链/用途/署名与分发范围记录，再选择是否建立**仅offline-validation**的A2批准并测试真实完整库导入/重开。approval由独立审阅输入提供，不把本复核JSON/哈希自封为批准；任何生产/商业分发另审。
3. **等待固件资源证据**。G1维护、G2时间/凭据/单owner/TLS/有限清理通过后，才准备G3真实缓存0/11+physical4方案/具体回退和单独窗口。G4再未缓存下载、校验、首帧、保存、淘汰、断连/重连。400/跨角色/多设备/BLE/OTA/音频不合并。

## 联合关闭与回退

联合G0仍**未关闭**：C02用途批准、C07修订2的固件共同签核/固件消费与生产装配（临时宿主hello/exchange已实现），以及C04/C08/C09/C10/C12具体边界/身份设计还缺交付。G1/G2是独立执行门禁，不能以设计一致替代实测。管理端不改固件回复中的旧hub快照，由固件任务下次读取本交付自行刷新；本轮没有发送消息。

本轮无外部运行变化；撤回显式profile/局部门禁或关闭自有临时owner即可，无数据格式/TTL迁移或应用/配置/NVS/缓存恢复操作。未来实物操作前以最新矩阵+独立读回冻结现场、保护67/a7与窗口前完整备份；仅恢复app不等于恢复配置/绑定/缓存。当前临时端点/服务属于另一窗口，本轮不启动、停止或清理它们。

管理端R2[API](../../protocol/round-pet-g0-r2.md)明确：cachedHitInventoryOnly仅本地模拟结果，不是新的storage ACK；R3现已定义取消/命中与pending的独立关联表达并做宿主对照，已由R4临时adapter消费验证，待共同签核/设备消费。本轮gate并非固件RTOS锁或Flash字节实现，不豁免G1/G2、许可批准及设备窗口。
```
