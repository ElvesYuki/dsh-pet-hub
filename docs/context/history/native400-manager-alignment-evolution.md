# 管理端400目标对齐演进

2026-11-02。用户明确管理端主线对齐400×400/78动作；以下记录此前仍以360/46为当前实施入口的规划。本轮只替代目标/下一入口，不推翻360/R7/940测试及上游驻留事实，不将400提升为已实现/验收。当前[400基线](../native400-baseline.md)、[Spec](../plans/native400-manager-alignment-spec.md)、[报告](../../reports/2026-11-02-native400-manager-alignment.md)。历史链接按原位置解释。

## 原 docs/context/plans/round-pet-g0-handoff.md

```text
# 给固件任务：G0 契约决定／待确认项

2026-11-02共同G0证据核定刷新。先补[Spec](round-pet-g0-closure-review-spec.md)/[Diff](round-pet-g0-closure-review-diff.md)，只读核对固件最新代码/回复/矩阵及G1/400收尾报告；[本轮报告](../../reports/2026-11-02-round-pet-g0-closure-review.md)与[38文件SHA/身份/门槛摘要](../../protocol/vectors/round-pet-g0-closure-review-v1.json)为最新证据。固件G0回复仍原R1单方立场，未新增对R3–R7的签核；本仓库R7及940项不由其旧hub快照覆盖。**联合G0未关闭、G1完整维护未过、G2缺证**。本文可交固件任务，未发送消息、未代双方签核或操作设备。被替代快照已[归档](../history/round-pet-g0-closure-review-evolution.md)。

## 当前边界

- 正式闭环仍是一块1.75C-EN、360²/24fps/241帧/46原ID；466²居中、单encoded、V2 28MiB/4活跃＋1暂存、保护动作0/4，不改N/分区/格式。400/78与分层角色是独立候选。
- 管理端A1–A10宿主候选已实现，scoped/静态证书减量与逐次动态授权保持，生产通道默认关闭。固件回复中的469或385项是旧hub快照，不重做已完成承载优化；最新全套数见[当前系统](../current-system.md)。
- 最新矩阵/compact78报告记录400窗口已关闭，原cbdf3169…完整2MiB应用恢复、system/28MiB缓存一致，启动前32MiB归档7a4fb43b…与窗口前相同；随后cbdf/id0启动8秒、串口释放。它替代A/B中断现场未收尾的旧引用，不代表切回67；本任务未新读设备。67 P3/a7回退仍保留，fc55 G1低位46,527B未过48KiB；400无Wi-Fi内存和低于24fps结果不覆盖G1/G2。

## C01–C12：复核后的决定与缺口

表中“设计一致”指固件单方回复与本轮管理端选择相符，不代表代码/wire或资源验收已完成。

C02本轮重新读取的是46个F/长度、P/M/N/source及元数据；11086帧全CRC/index和46源视频blob证据沿用R1，未在本轮重新解码/读视频。C07的JSON修订2与R5 HTTP关联必须一起答复；新400候选的USB ACK V2是独立版本轴，不是hub协议采纳证据。

| ID | 已确认／管理端本轮决定 | 仍待确认或实现；下一证据 |
| --- | --- | --- |
| C01 能力执行 | **数值/模型确认**：schema2单encoded=playback/max/slot 5865472B；persistent 4+1、stride5869568、partition29360128，center53；媒体360/24/241/flag1/key12/tile20。A1/A6与固件常量一致 | 固件仅给capability_values表，缺protocols/firmware_version/board_profile，不能直接作为hello。R3已定义完整extensions/版本/identity；R4临时宿主同socket hello绑定已实现，实际能力上报及实体装配待实现，未知能力拒绝 |
| C02 F/M/P/N | **真实字节身份已独立确认**：P=3afe4578…、M=9045bd6b…、N=dfc829e1…、源SHA=a6a2ddae…；46原ID/225509627B/11086帧全F/CRC/index通过；46源视频SHA256和固定86181ce提交git blob一致 | `license_ref=upstream-reference-only`原样保留，**无独立approval/真实CAS导入**。本次已直读ZipZipPipe原声明和CC官方条款，非商业/署名/SA边界确认；内部offline-validation审阅输入、署名/转换说明及传播范围仍待交付；改license_ref/目录字段须重算M/P并重新批准 |
| C03 metadata/信任 | **设计一致**：受信hub完整核P/M/F/源与媒体；设备持会话批准(P,M,N)+单descriptor，不收全46工作集；页≤8条且整个body≤4096B，超限减条目 | R3管理端选offset/next_offset/完整descriptor/(P,M,N)闭合分页；R5临时宿主分页/许可已实现，固件消费/实际许可绑定仍待实现；设备当前v5大目录路径不能作为新owner预算，G2说明实际释放/复用，不能假定已经节省RAM |
| C04 状态/恢复 | **证据语义一致**：accepted/verified/playing、display actual、storage saved及当前inventory独立；saved仅marker后元数据读回确认，命中已存不伪造新提交；淘汰同根更新available | 管理端R2逻辑gate/unknown恢复已验证；R6新wire/actor提交阶段结果已宿主验证，设备钩子仍待实现。marker可能写入或确认失败→outcome_unknown/阻止新写；当前bool恢复把I/O失败与坏根折叠，不能直接把recover=true当未知已消除。低root/同seq冲突不降hub floor |
| C05 手动/触摸 | **管理端选择固件保守首窗口方案**：仅远端base0/11，physical4单次且本地优先；remote4暂禁，UI“触摸专用”。本地首帧token ACK起241/24秒，重复触摸新token；到期回最新有效base，否则idle0 | G0-R2已实现显式first-window-review/1的入队/派发cached0/11门禁与内部manualChoices，默认通用46候选保持；local/token/到期用纯模型对照，**真实UI/物理触摸和设备适配仍未实现**。其他动作随G4另扩；不改变旧v5/PC角色策略 |
| C06 首帧/维护 | **设计一致**：playing来自刷新提交及完整command/context/generation；local事件只更新actual，不回发4。loading/verifying/saving冻结最后有效画面，wall time不当动画elapsed | 现render在lv_refr_now路径后记presented_*，局部记录不是完整新身份，非面板扫描结束证明。同像素/同帧、旧token、维护恢复及独立display_seq需共同向量/钩子 |
| C07 wire/兼容 | **R3管理端提案已交付**：round-pet-native360-wire/1、/hub-device/v1路径、request_seq、完整能力/包、base_loop/descriptor、deferred_local、storage2命中/取消/未知、touch/display及固定错误/HTTP/恢复表；R4修订2的80正/62反经Node与独立C++宿主逐字节对照 | [合同/向量](../../protocol/round-pet-wire-v1.md)SHA需固件共同审阅；C++仅本仓库宿主oracle，非固件实现。旧A4/旧v5未改，临时hello/exchange runtime/schema2映射已由R4接入；R5又补临时GET/逐块授权；生产runtime/设备GET/真实UI、设备可信来源/时间/证书/提交/RTOS未装配，不能换名直连 |
| C08 取消/写预算 | **接受双边界设计**：取消准入gate与持久marker分开；gate前已观测取消不进入提交，gate后取消不承诺撤销保存，只禁止旧目标激活。marker/读回未知不得报未保存 | 管理端R2/R7已补逻辑gate/取消后保存、失效时一次本地收尾和恢复I/O/floor对照；固件persist仍只在commit前查取消，commit内部无回调，真实gate原子性/错误阶段及已授权收尾/凭据撤销边界仍待固件确认；管理端建议gate后仅原事务本地收尾、不授权新payload/网络/播放，尚无新固件答复。12次是启动内易失固定窗（首尝试起一小时），非滑动/跨重启硬限额；普通60秒，load完成约5秒且已呈现/非local才判断；installation仅维护、失败也占预算。G1实测与不可抢占上界仍缺 |
| C09 调度/期限 | **结构一致**：单在途control、单未派发latest、单待段，renew/cancel/revoke有界旗标，段后先exchange，不用8 FIFO | RTOS owner/让出/退出硬上界待实现实测。包括commit残余、全验/擦写与host磁盘成本；500ms poll/1s段仅假设。缺上界NO_GO，不延lease/放宽deadline掩盖排队 |
| C10 身份/认证 | **方向一致**：单TLS/HTTP owner，TLS1.2/P256仅探针候选，认证失败不降级IP/Bearer/明文 | 正式可信时间、密钥/证书/epoch持久提交、撤销/重绑定/丢钥恢复还缺可审查Spec与资源预算。RAM凭据探针不是配对，G2前不能开真实通道 |
| C11 资源/G1/G2 | **口径一致**：P3显式PSRAM6916777含64KiB read-ahead；保留内部≥48KiB、PSRAM≥1MiB/块≥512KiB、main栈≥1KiB及2MiB应用余量目标 | G1未通过全维护：fc55门禁停止、后续A/B仅A准入/待机，M2–M7未执行；400收尾不补齐。G2无新探针/动态TLS报告；需构建/输入/阈值绑定的TLS峰值/最大内部块/栈/清理上界，P3/loopback/400样本均不能放行 |
| C12 控制源/回退 | **设计一致**：启动网络owner前选择旧v5或新hub，断线不自动切源，不停整个pet/bridge；新session新hello/库存/控制，不重放旧命令 | 选择形式/持久策略/核验机制未实现；A5仅宿主OFF恢复。400窗口已恢复原cbdf，未来新窗口仍须重新冻结当时现场、另行授权；app/配置内容/凭据epoch/缓存分别恢复核对，不擅自触碰NVS/服务或整片恢复 |

## 下一次可独立验证的小切片

G0-R2已完成[35项离线对照](../../reports/2026-10-30-round-pet-g0-r2.md)：显式首窗口入队/派发门禁、profile固定/选主隔离、local/latest寿命、取消gate、marker未知与I/O/floor恢复；仅原创媒体/临时环境，无生产通道。旧R1未实现状态已[归档](../history/round-pet-g0-r2-evolution.md)，不重做该切片。
G0-R3已完成[24专项/双语言字节合同](../../reports/2026-11-02-round-pet-g0-r3.md)，旧未定义wire状态已[归档](../history/round-pet-g0-r3-evolution.md)。这是管理端提案，不代固件签核。

1. **真实360独立offline-validation审阅输入**（可先离线）：许可原文已直读，P/M/N/F/source不变；下一交审阅责任/日期、署名/转换说明/传播范围及精确身份绑定的A2 reviewed-upstream approval。它是受信内部审阅，不要求作者逐次另发授权，也不能自取账本批准。保持license_ref即可，改目录字段需重算P/M。批准后另Spec/Diff测试完整真实库私有A2导入/重开，本轮不导入。
2. **固件共同G0答复**（可先离线、待固件任务交付）：逐项接受/拒绝/修订R3 revision2与R5 HTTP附录，绑定合同SHA与80正/62反向量；确认gate原子性、提交阶段/unknown和恢复读I/O分类、失联/暂停/撤销后一次本地收尾与实际退出、新库存及floor。R7模型token不新增wire字段，不重做既有loopback；签核缺失不能由管理端补签。
3. **固件C09/C10/C12与G1/G2证据**：先默认OFF的单owner/期限/可信时间/凭据epoch持久化/撤销重绑定/唯一控制源Spec、预算与宿主失败向量/构建，再另授权设备窗口复测G1全维护与G2峰值/实际退出；TLS内部最大块/新栈和最坏延迟须先定阈值，不能延TTL或拿400内存样本准入。满足后才准备G3缓存0/11＋physical4的具体方案/回退和独立窗口，G4再下载/保存/淘汰/重连。400/跨角色/多设备/BLE/OTA/音频不合并。

## 联合关闭与回退

联合G0仍**未关闭**：C02原文已核但内部用途批准、C07修订2的固件共同签核/固件消费与生产装配（临时宿主hello/exchange已实现），以及C04/C08/C09/C10/C12具体边界/身份设计还缺交付。G1/G2是独立执行门禁，不能以设计一致替代实测。管理端不改固件回复中的旧hub快照，由固件任务下次读取本交付自行刷新；本轮没有发送消息。

本轮仅文档/只读证据，无外部运行变化；回退仅本轮文档/摘要，不撤回R7实现或改批准/格式/TTL。未来实物操作前以最新矩阵+授权独立读回冻结现场、保护当时app及67/a7与窗口前完整备份；仅恢复app不等于恢复配置/绑定/缓存。原端点/服务本轮不启动、停止或清理。

管理端R2[API](../../protocol/round-pet-g0-r2.md)明确：cachedHitInventoryOnly仅本地模拟结果，不是新的storage ACK；R3现已定义取消/命中与pending的独立关联表达并做宿主对照，已由R4临时adapter消费验证，待共同签核/设备消费。本轮gate并非固件RTOS锁或Flash字节实现，不豁免G1/G2、许可批准及设备窗口。
```

## 原 docs/context/round-pet-hub-baseline-alignment.md

```text
# 管理端 G0 基线与契约差异表

2026-11-02共同G0证据核定刷新。[Spec](plans/round-pet-g0-closure-review-spec.md)/[Diff](plans/round-pet-g0-closure-review-diff.md)、[报告](../reports/2026-11-02-round-pet-g0-closure-review.md)、[38证据摘要](../protocol/vectors/round-pet-g0-closure-review-v1.json)、[C01–C12权威交接](plans/round-pet-g0-handoff.md)。只读固件最新实现/报告及正式素材，不接设备；R7/A1–A10/承载减量与并行素材工作保留。旧外部引用已[归档](history/round-pet-g0-closure-review-evolution.md)，固件文档hub快照不当当前工作区。

## 固定输入与验证层次

| 输入 | 已确认事实 | 限制 |
| --- | --- | --- |
| 管理端 | A1–A10离线资源/导入/观察/pull/OFF装配/执行/根权威/减量已实现；Node24.14.1/npm11.11.0，最新全套见当前系统 | HEAD a5a2cff…不能复现主要未跟踪实现；R4/R5新增内部默认OFF临时hello/exchange/GET adapter，复用已有owner，不装配生产入口、不重做优化 |
| 固件快照 | HEAD9816317ae5ac6f86c982ef773461de595f407747/初读dirty186；选定38文件SHA，R1共有21份仅current-status变化；实际设备目录Store/控制/播放与旧G0回复未变 | dirty工作区不由HEAD完整表示，旧G0文件路径/SHA不能直接当当前实现 |
| 部署引用 | current-status顶部及最新compact78报告记400窗口已关闭，原cbdf3169…/2MiB恢复，system/完整28MiB及启动前32MiB归档7a4fb43b…与窗口前一致；随后id0启动、串口释放 | 上游报告引用，未新读设备；正常启动后未再次全片读取。67不是驻留，P3/a7保留；400无Wi-Fi指标不替代G1/G2 |
| G1/G2 | fc55 G1曾联网准入通过、缓存挥手后SDK历史低水位46527B＜49152，未下载/保存；A/B仅A准入/待机，完整维护未通过；400窗口恢复不补M2–M7 | SDK历史低位不等于同刻全局最低/泄漏证明；TLS/可信时间/凭据/最大块/清理上界均不能从旧P3推得 |
| 正式媒体 | 466²屏／360² center53、PET4/24/241/flag1/key12/tile20；46原ID、225509627B/11086帧 | 400/78与分层候选保持隔离，不改正式角色/尺寸或V2 N |
| 存储/内存 | 28MiB V2、4活跃+1暂存、按动作ID保护0/4；单encoded5865472B，stride5869568，read-ahead65536；显式PSRAM6916777 | 能力数值表不是完整hello；P3内部59035B是旧播放样本，非TLS准入；完整46库不在设备离线缓存 |
| 真实身份 | 管理端独立重算P=3afe4578…、M=9045bd6b…、N=dfc829e1…、源SHA=a6a2ddae…；46文件全F/CRC/index和46源视频git blob/源SHA一致 | license_ref原为upstream-reference-only，不创建独立approval，不真实导入CAS或生成设备指令；完整值/逐动作证据见[复核向量](../protocol/vectors/round-pet-g0-real360-review-v1.json) |

外部只读根：/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio。本轮指定三份规划/current-status、既有G0 reply/inputs、G1-lite/内存和新400收尾报告及实际Store/播放器/策略/导出代码均核对；未调用导入器/固件测试或构建，不读运行凭据/配置。采样期间matrix/todos变化已重读，新增400-pipeline-ack报告/JSON并入38份证据，候选未部署，不影响本闭环结论；并非全仓库冻结。固定README/原作者声明/CC条款只读取回，未重读上游源视频目录或操作设备。

## 实现／决定／未决差异

“设计一致”是两份立场相符，不能提升成新wire或实体能力。完整12项及下一证据以交接表为准。

| 项目 | 管理端已实现/本轮确认 | 待实现／待确认 |
| --- | --- | --- |
| schema2 | parser/推荐/几何＋A1独立单RAM/Flash模型，A6执行链已离线验证；固件数值一致 | 旧DeviceModel仍schema1；固件完整hello身份/媒体扩展/实体执行和资源报告缺失，不能只因parser通过称闭环 |
| F/M/P/N及来源 | A2分域/严格导入/provenance已有，R1真实46字节/源blob/ID/recipe确认，V2 N保持 | R3合成Node-C++宿主wire向量已交付；许可原文已直读；内部用途审阅/独立approval、真实完整库A2导入/恢复及固件消费未完成，不从哈希生成批准 |
| 接纳/首帧/实际画面 | A3认证proof/目标/序列/查询投影及只读UI，A6模型首帧已验；固件有局部刷新提交钩子 | R3已定义完整context/generation/刷新结果表示，R4已接临时schema2到A3投影，设备钩子/真实输入未实现；旧played/HTTP/PC preview不能代替，同像素真实首帧提交仍待验 |
| 保存/淘汰/恢复 | A1/A3 root_commit/独立库存/当前性，A7/A8同binding根floor与durable发布保持 | 固件bool不能区分marker/读回未知与I/O恢复失败；须分提交阶段/完整根再判saved，不直接套模型或旧日志“保留旧根” |
| 手动/触摸 | **R2已实现（离线）**：A5显式first-window-review/1只允许cached0/11，入队/派发都验；local4优先/首ACK寿命/latest/失效回idle用有界core模型对照，manualChoices内部投影 | 通用46候选缺省保持，正式UI/实体触摸/设备wire运行适配仍未实现；不得靠默认候选绕过首窗口。deferred_local/base_loop字段已由R3定义，R4临时adapter已接入，真实UI/设备消费未接入 |
| 取消/维护 | **R2已实现（模型）**：显式gate；gate前取消无新root，gate后可saved但旧播放cancelled；recoverStorage清volatile，I/O未知保持blocked/不补saved/不降floor | 固件commit内部不可取消，R7同步模型已验证失效本地收尾；真实gate原子性/错误阶段/不可抢占残余仍需固件实现验证，不把逻辑步进当RTOS/Flash证据 |
| wire/版本 | A4 loopback round-pet-pull-candidate/1、下一HTTP回执、分页/Range/单在途已验；A5默认OFF | R3新合同已定义/hub-device/v1、wire/1、字段/错误/版本和Node/C++宿主向量；旧A4仍无这些新字段，不自动转换。R4临时hello/exchange adapter已完成，R5临时GET已完成，固件签核/设备与生产装配未完成，不得换名直接接ESP |
| 调度/授权 | 单pending/latest/普通、紧急旗标、scoped每scope/4KiB完整元数据、动态日期/撤销及完整deadline；A10 extra315→0且保护成本保持 | 固件当前旧v5多HTTP/整文件路径非单TLS owner；RTOS/Flash让出/cleanup上界未知，不能延TTL或用loopback样本准入 |
| 身份/恢复/控制源 | 管理端binding CAS、hello/session、A5 OFF恢复、A8根权威/低root失效已有 | 正式可信时间/秘密/epoch持久化/撤销重绑定；设备端新旧owner互斥及未来现场冻结/分别恢复须固件Spec与独立窗口；无自动降floor/清锁/格式化 |
| 生产准入 | 当前deviceTransport=false，无生产listener/真实设备闭环；730是A10阶段证据，本轮回归数见报告 | 修订2共同签核/生产装配及许可批准、G1全维护/G2资源通过后，才另授权G3/4；物理掉电/冷盘/多日/多设备等仍未覆盖 |

## 审查结论与下一入口

真实库**身份/许可原文核定完成、内部用途批准与联合G0未完成**。G0-R2已完成[35专项](../reports/2026-10-30-round-pet-g0-r2.md)，R3已交付[新表达/24专项](../reports/2026-11-02-round-pet-g0-r3.md)，R4已接临时hello/exchange与schema2投影；R5又接临时GET/分段；R6已补A1 actor新wire全链；R7已补同步gate收尾；本轮证据核定完成，下一真实360内部用途批准输入与固件共同答复/资源方案；不重做A2机制或A10承载优化。C02原文已核，下一内部用途审阅/批准输入及固件C07/C04/C08共同答复；等待单owner/身份Spec与G1/G2证据，不处理设备或服务。具体小切片/验收/回退见[C01–C12交接](plans/round-pet-g0-handoff.md)。
```

## 原 README.md

```text
当前已完成宿主离线管理、mTLS/会话一致性及选主后managed review装配；基础设施包括单实例Unix socket服务、鉴权IPC、状态来源装配、配置CAS和插件管理设置区。候选已通过临时独立DSH Web profile的加载、热重载和卸载验证；现有desktop未安装，无设备通信和BLE实现。正式设备目标现为**1.75C／原生360 production**，用户确认设备已切换；板级屏幕466×466、素材360×360。固件最新矩阵记录400窗口已收尾并恢复原cbdf3169…，启动前完整32MiB与窗口前一致，随后原id0启动、串口释放；新400可靠ACK/短锁仅宿主候选、未部署。67是P3播放基线/历史恢复目标，a7回退保留。本任务仅只读报告，未新读设备或调整现场；详见[当前正式基线](docs/context/native360-baseline.md)。旧128的240×240、约24FPS与四PSRAM槽仅作历史参考。
```

## 原 docs/context/current-system.md

```text
用户选择1.75C-EN／原生360，正式仍466²屏／360²PET4/24fps/241帧、46动作，V2 28MiB/4活跃＋1暂存、按ID保护0/4。2026-11-02只读固件最新矩阵与compact78报告：400窗口已关闭、原cbdf3169…完整应用恢复，system/28MiB及启动前32MiB归档7a4fb43b…与窗口前一致，随后原id0启动8秒、串口释放；未恢复67、启动后未再全片读取。67仍为P3基线/a7精确回退保留。核定期间上游又增400可靠ACK/短锁宿主候选，已重读且未部署，不改变驻留引用或G1/G2。旧A/B中断记录不作当前现场，本任务未新读设备/配置或处置服务。见[基线](native360-baseline.md)、[最新核定](../reports/2026-11-02-round-pet-g0-closure-review.md)。

2026-11-02[共同G0/真实许可/G1-G2核定](../reports/2026-11-02-round-pet-g0-closure-review.md)完成本轮只读范围，先补Spec/Diff。38份选定固件证据/21份R1共有文件仅矩阵内容变化；期间matrix/todos又并发更新，已重读新增400宿主报告，生产Store/HTTP/播放器与旧G0回复保持。真实46 PET4共225509627B的F/长度及三元数据原SHA、P=3afe4578…/M=9045bd6b…/N=dfc829e1…/source=a6a2ddae…复核保持；R1全11086帧/源blob证据沿用，未重复解码/源视频读取。固定上游README及ZipZipPipe原声明/CC官方条款已直接取得，非商业/署名/SA原文缺口已补，license_ref保持upstream-reference-only。**内部offline-validation approval/真实A2导入、联合G0签核均未完成**；G1 fc55缓存挥手后SDK低位46527＜49152B/写尝试0，M2–M7缺证；G2无可交付设备TLS/时间/持久凭据/实际退出报告。下一真实360审阅输入与固件C07修订2/GET附录、C04/C08分类/撤销边界及C09/C10/C12单owner/安全Spec答复，不重复R7。check及含构建940/940通过（无新增测试）；[证据摘要](../protocol/vectors/round-pet-g0-closure-review-v1.json)、[被替代记录](history/round-pet-g0-closure-review-evolution.md)。

- [400原像素素材候选](plans/native400-material-spec.md)：400裁区(124,-6,400,400)、466屏偏移33，无额外安全圆；用户已确认[全量压缩版并合并](../reports/2026-11-02-native400-compact-merge.md)。78文件348737057B均在旧cap内，最大67号5569645B；全部18675帧及宿主78角色激活／恢复通过，42仍118帧。新规范库及两个角色目录的摘要／来源链见[当前交接](../protocol/native400-device-handoff.md)，全部78与role8身份均已更新；旧12项优化合并库保留为历史／回退。设备侧400缓冲／额外tag0／真实显示／RAM／Flash及性能继续验证，正式360／46动作及分层360保持。黑边易压缩不等于无解码／内存成本。
```

## 原 docs/context/current-todos.md

```text
1. **真实360用途审阅输入与固件共同G0答复**：[本轮核定](../reports/2026-11-02-round-pet-g0-closure-review.md)已只读确认最新外部实现/报告、许可原文及缺证，P/M/N/F/source保持，不重复R7或旧身份审计。下一可先离线交付精确360/46身份、用途offline-validation、传播范围、署名/转换说明及审阅责任/日期；受信独立A2 reviewed-upstream approval尚未创建，不伪填审阅人、不从账本自取批准、不要求作者逐次另发授权。批准齐备后另Spec/Diff实施真实全库私有A2导入/重开，保留license_ref即可，改catalog字段需重算P/M。并行等待固件按[C01–C12交接](plans/round-pet-g0-handoff.md)绑定管理端合同/向量SHA，确认或修订C07 revision2和R5 GET关联；补C04/C08原子gate/结果未知/恢复读I/O、失联/暂停/凭据撤销后的本地收尾与实际退出、新库存/floor。不把R7 token加为wire字段，不代固件签核；生产装配、真实UI/设备仍未接通。
2. **实体资源与执行门槛**：管理端默认OFF宿主候选已交付；联合G0/固件适配交付后，仍需单独设备窗口授权与具体恢复步骤，不自动启用真实listener。最新400窗口上游已恢复原cbdf并收尾，非67；未来窗口须重新冻结当时实际app/配置语义/epoch/完整缓存与备份，不由本任务操作现场；先由固件交C09/C10/C12单owner/可信时间/凭据epoch持久化/撤销重绑定/唯一控制源Spec、宿主负例与构建；G1 M2–M7仍缺，G2无设备TLS报告，内部最大连续块/新栈阈值及最坏I/O退出上界须先固定后实测；PSRAM6916777B含read-ahead，保留内部48KiB等门槛，旧预算JSON需后续独立更新才可引用。helper签名／秘密、设备窗口与前瞻／a7恢复分别审查，不自动启动／接设备。
3. **分层角色包宿主接入设计**：L1–L3当前桌面工具及[高分屏显示/放大检查](../reports/2026-10-30-character-hidpi.md)已完成，见[L3宿主验收](../reports/2026-10-30-layered-character-l3.md)。下一先写Spec/Diff，确定日常角色管理/独立窗口的入口、新包类型、PET4与分层的单一画面所有权、异步资源交接/回退及持久确认；不重复包导出/独立加载或同后端等效原型。跨浏览器/设备、长期资源仍待验；360/46动作/11发束保持，真实音频继续延后真机。

正式及分层素材继续沿用现有360大小、原画布中心、固定镜头及圆形安全区；400原像素为独立待评估候选，不由规划自动替代正式约束。现行路径仍需审查全帧、循环和24fps/241帧正式路径约束。扩展动作时另写Spec/Diff评审目录数量、ID、容量、许可和回退；当前已有分层候选纯数据包及同Canvas后端验证，未扩展46动作或授权固件操作。

```

## 原 docs/context/index.md

```text
管理端最新（2026-11-02）：[共同G0/许可/G1-G2核定报告](../reports/2026-11-02-round-pet-g0-closure-review.md)、[Spec](plans/round-pet-g0-closure-review-spec.md)/[Diff](plans/round-pet-g0-closure-review-diff.md)、[38文件/门槛证据摘要](../protocol/vectors/round-pet-g0-closure-review-v1.json)、[共同G0交接](plans/round-pet-g0-handoff.md)、[被替代引用归档](history/round-pet-g0-closure-review-evolution.md)。正式360身份及许可原文已核；上游400窗口恢复原cbdf、新宿主候选未部署。内部用途批准/固件修订2及GET共同签核仍缺，G1全维护未过/G2缺证，默认OFF。R7同步模型30专项保持，本轮文档回归check/940项通过；下一真实360审阅输入及固件结果分类/单owner/身份Spec交付。

当前正式目标：[175C／原生360基线](native360-baseline.md)、[切换Spec](plans/native360-baseline-spec.md)、[Diff](plans/native360-baseline-diff.md)。用户确认设备已切换；旧128和RAM EVAL报告均为历史参考。
```

## 原360单设备Spec末尾入口

```text
[最新基线](../native360-baseline.md)已由2026-11-02[共同G0/许可/G1-G2核定](../../reports/2026-11-02-round-pet-g0-closure-review.md)刷新：上游400窗口已收尾恢复原cbdf，67仍历史性能基线/恢复目标，后续新400宿主候选未部署；本任务未新读设备或处置服务。正式360/46身份保持，原声明/CC条款已直读，内部用途批准及联合签核仍缺；G1全维护未过、G2无设备TLS证据。R2–R7离线范围已完成，下一真实360用途审阅输入、固件C07/C04/C08共同答复与C09/C10/C12身份/单owner资源Spec，不重复A1–A10或改固件。实施先Spec/Diff，具体入口/回退以[交接](round-pet-g0-handoff.md)为准。
```
