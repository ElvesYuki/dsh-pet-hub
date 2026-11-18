# G0-R1共同契约复核演进

2026-10-30。以下是复核前管理端快照，**已被G0-R1替代**；旧部署67、真实P/ID未知、C05未选及取消到marker前等表述仅按历史语境。A1–A10实现/验证仍有效。最新[基线](../round-pet-hub-baseline-alignment.md)、[交接](../plans/round-pet-g0-handoff.md)、[报告](../../reports/2026-10-30-round-pet-g0-reconciliation.md)；未改变任何外部服务/设备。

## 原 docs/context/round-pet-hub-baseline-alignment.md

```text
# 管理端G0基线与契约差异表

2026-10-30。固件基线来自G0阶段对指定规划／实际源码／最新P3报告的只读核对；A1–A10更新本仓库状态；A2曾只读media_contract形状，A3/A4/A5/A6/A7/A8/A9/A10未访问固件或设备/部署矩阵。管理端[Spec/Diff](plans/round-pet-single-device-spec.md)、[共同字段提案](../protocol/round-pet-single-device-v1.md)、[固件交接](plans/round-pet-g0-handoff.md)和[G0审查证据](../reports/2026-10-30-round-pet-g0.md)为入口；A1新增证据见下表。

## 输入基线及证据层次

| 输入 | 当前核对结果 | 证据范围 |
| --- | --- | --- |
| 管理端工作区 | HEAD a5a2cff…，实现主要未跟踪；Node24.14.1/npm11.11.0，零依赖；当前730项宿主测试（含A1/A2各35项、A3 46项、A4 48项、A5 41项、A6 30项、A7 24项、A8 34项、A9 14项、A10 24项），scoped减量保持 | HEAD不能复现工作区；本轮源码摘要见报告，不按固件规划内的385项快照回退判断 |
| 固件工作区 | 本次读取HEAD 4cf4b4e…；P2源码25fadc87…，规划文档后续变化 | 版本矩阵／文件SHA分别记录，不能把当前HEAD当设备镜像或完整dirty内容 |
| 已部署报告 | current-status/P3记前瞻67e1af88f9f5…，1320048B、TIMING；保留a7d1c054…精确回退 | 上游有界三镜像各600秒／实屏证据；本管理端没有新读设备或烧录，实时版本仍以固件矩阵和下一窗口读回为准 |
| 硬件／素材 | 1.75C-EN，32MiB Flash／8MiB PSRAM，466²屏／360²PET4居中，24fps／241帧，46动作225509627B在PC | 单设备固定角色；28MiB仅子集，不承诺全46离线或严格每帧24fps |
| 缓存／工作集 | V2 4活跃引用＋1暂存；已缓存动作0/4/1/11，保护动作0/4；encoded5865472B，Flash read-ahead65536B | 固件源／报告能力；A1资源模型已支持逻辑工作集/缓存，A6已接隔离模拟执行，实体执行/通道未装配。动作ID与物理slot编号分开 |
| 内存／性能 | 显式PSRAM6916777B，系统前余1471831B；P3最低空闲1404660B／最大块1376256B、内部59035B、main栈2376B，正常点击23.73源FPS | 非TLS峰值／可分配量／面板FPS，不是联网下载／写入或长测；旧hub静态JSON漏64KiB read-ahead，不能用来准入 |

固件外部根：`/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio`。指定输入是docs/context/plans下round-pet-hub-baseline-alignment、single-device-spec、single-device-diff及docs/context/current-status；报告还核对apps/round-pet/reports/2026-10-30-native360-{ahead-p2,predecode-p3}.md。它们的hub状态只作读取快照，本表管理端状态来自本仓库实际文件。

## 逐项契约差异

“已实现”限定括号中的层次；“待固件确认”不是已经获准实施。G0管理端方案交付不关闭联合G0。

| 项目 | 管理端状态及实际入口 | 固件已知事实／待固件确认 | 管理端处理 |
| --- | --- | --- | --- |
| schema2解析／几何 | **已实现（元数据）**：core/protocol.capabilities/presentation、MaterialCatalog接受单playback＋persistent字段，支持center | **待固件确认**实际hello及媒体扩展；当前生产没有hub能力报告 | 沿用解析器，补固定241/24/flag/key/tile profile限制 |
| schema2执行 | **已实现（A1/A6离线）／待实体执行**：独立Native360DeviceModel＋FlashModel完成单encoded、4/1、root/lease/恢复；旧DeviceModel仍schema1 | 固件已有单encoded/V2；能力wire/资源仍**待固件确认** | [35专项/434全套](../reports/2026-10-30-round-pet-a1.md)为原资源模型；[A6对照](../reports/2026-10-30-round-pet-a6.md)已接模拟承载，不声称设备执行完成 |
| Registry能力／状态 | **已实现（A3候选）／待接实体**：独立观察reducer分四流/当前性；旧Registry.expect仍保留模拟accepted | 新命令/首帧/库存流仍**待固件确认** | 新request/sent不冒充accepted，A4/A5已接真实loopback session/guard，实体回执仍待确认 |
| 真实设备UI／IPC | **已实现（A3/A5只读候选）／待接实体**：显式默认OFF装配、GET status/宿主白名单/共享展示；顶层devices仍空，无页面启用/控制写路由 | 无新实体通道；A6首帧/保存来自模型操作再经TLS证明，仍非物理证据 | 明确非实物，无新POST/控制按钮；设备会话/服务连接分开 |
| 完整46包／streaming | **已实现（宿主）**：流式CAS／SHA／PET4全帧CRC和许可批准；曾验225509627B库 | 文件241生产约束已有；真实当前46映射**待固件确认** | 复用仓库；固定角色只读新provenance，不重导入到RAM32MiB快照 |
| 包runtime导入互操作 | **已实现（A2离线）／待确认（真实包/跨端）**：专用API映射最小index，worker严格241/CRC/index SHA、CAS/provenance/无源重开；旧入口保持 | media_contract导出catalog.sha=P；真实P/ID/来源批准及Node/C++golden仍**待固件确认** | [35专项/469全套](../reports/2026-10-30-round-pet-a2.md)用原创包，不称真实库或设备互操作已通过 |
| F/M/P/N | **已实现（A2宿主）**：P/M独立计算、F逐文件核、N固定及I/provenance；外部许可/来源批准必需 | 固件P包含catalog/timing/semantics/source；N固定；实际P仍**待固件确认** | 真实独立批准后另审计，不从文件自算摘要生成信任，不改V2 N |
| accepted | **已实现（A3候选投影）／待接实体**：requested/sent独立，精确proof/target/control才接纳报告；旧模拟不转换 | 设备身份/lease接纳后新报告待实现/共同确认 | HTTP成功/旧expect不能升级成设备接纳 |
| verified | **已实现（宿主／模型）／待实现（设备反馈）** | Network全帧CRC，Flash有效根链＋帧0/运行CRC，已有源代码 | 重用证据链，不要求每次缓存点击全库重验；线上的身份／序列待确认 |
| playing／actual | **已实现（A3候选）／待接实物**：verified后显式首帧，display独立更新actual；终态/旧目标/旧刷新拒绝 | animate提交钩子/完整context仍待确认 | playing不替代display，重连snapshot不补旧成功；本地画面不生成远端动作 |
| saved／offline_available | **已实现（A1资源/A3投影）／待接实体**：root_commit证据/有界操作、历史保存与完整根映射分离，同root核对象generation | Store提交/根清单新wire仍待固件实现 | unknown失效查询/库存；新根重查，晚旧saved不覆盖当前库存 |
| 本地触摸 | **已实现（A3只读候选）／待接实体**：local4/idle画面只更新actual、不改base或回发；未实现物理寿命/仲裁 | 物理touch/LocalPlayback已有，新完整事件待确认 | 不套宿主冷却；触摸结束回最新base须由固件证据，不由UI推测 |
| 维护画面 | **已实现（A1模型/A3只读UI）／待接实体**：held_last_valid明确暂停、host不累加elapsed；恢复须新refresh代数 | load/persist冻结与新观测钩子/代数规则待C06确认 | 不承诺旧动画持续；没有报告保持unknown |
| 会话／认证减量 | **已实现（宿主）**：mTLS／scoped、动态日期／撤销、binding CAS、hello、独立时钟guard及回收 | ESP可信时间、秘密持久化、epoch／撤销恢复**待固件确认／验证** | 直接复用，不重做优化、不把RAM证书探针等同正式绑定 |
| 单TLS／单HTTP | **已实现（A4/A5离线候选）／待生产准入**：单UDS赢家整合磁盘CAS/四流/pull，显式启用后仅临时loopback handler；单socket/HTTP/实际退出，deviceTransport=false | 现行v5两任务整文件请求，不是新owner；ESP连接/清理上界待固件确认 | [48专项](../reports/2026-10-30-round-pet-a4.md)仅Node mock，不推导实物；[A5装配/恢复41专项](../reports/2026-10-30-round-pet-a5.md)已验，不开启生产listener |
| 队列／截止／重试 | **已实现（A4候选）／待生产**：1 pending/1 latest/1普通、有界旗标；每页/段前exchange、绝对deadline/相对permit/unknown/实际退出；自动重试0 | RTOS/Flash维护让出/清理硬上界仍待固件确认 | 不用旧8 FIFO；预算未知不发permit、不延TTL；A5已验新hello库存/uncertain门禁、OFF恢复/不重放；自动重试0/无自动联网退避 |
| 根检查点／回滚维护 | **已实现（A8显式权威候选）／待生产准入**：同文件绑定/根CAS、floor/完整根/commit对象、新owner查询、低root与同根冲突拒绝、只读维护步骤 | 固件会话/恢复/重新建立信任及物理持久化**待确认** | [34项对照](../reports/2026-10-30-round-pet-a8.md)仅临时新profile；旧v1无迁移；无降floor/rebind写入口、无自动防回滚 |
| 根持久化成本 | **已实现（A9宿主样本）／物理上界未知**：v1/v2×1/64登记同负载；load225→308，v2 7次同步/1次noop，max-field 64登记/63根 | ESP维护/RTOS/冷盘/网络与同步FS硬退出仍**待确认** | [14项报告](../reports/2026-10-30-round-pet-a9.md)：R100假设已使4s回执不fit，不能用15s TTL掩盖；样本不准入 |
| 根重复工作 | **已实现（A10宿主）**：锁内验证/CAS后noop省编码、同次已验摘要复用；full参考保留 | 冷盘/物理时延/可信锚仍**待确认** | [24专项/730全套](../reports/2026-10-30-round-pet-a10.md)：315额外摘要→0，完整load/hash/动态授权/同步保持，格式/TTL无变化 |
| 资源／维护准入 | **待实现／待验证**：旧预算输入不是新板TLS资源证据 | G1维护、G2 TLS／最大内部块／栈／正式凭据均未通过新通道验证 | 保留内部48KiB等固件门槛，不用旧32KiB覆盖；不延TTL掩盖排队 |
| 回退／新通道启用 | **已实现（A5宿主恢复）／待实现（生产切换）**：关闭等实际I/O再释放pin，休眠/退出/无源重开仍OFF，真实通道仍关闭 | 前瞻／a7／分区／双根恢复物已登记，新绑定NVS恢复**待固件确认** | 独立设备窗口前另备身份／备份／撤销方案；A7同actor/boot新owner与临时根检查点已验；默认无自动持久，缓存/NVS恢复仍须实体证据 |

## 本轮审查结论

A1–A10宿主候选已完成；A10局部重复成本已减量且对照通过，下一共同关闭wire/真实包、可信恢复与实体资源；未测物理最坏等待；A4真实pull为独立Node loopback，仍无ESP/生产准入结论。G0联合定版仍需固件答复C01–C12；G3/G4真实执行还需G1/G2、适配交付与单独设备授权。现有源码/测试通过不意味着任一新增行已实现，交付后以各切片报告升级状态。

并发输入说明：收尾观察到固件任务增加PET_NATIVE360_MAINTENANCE_TRACE、main观测钩子及maintenance头，已只读复核，不是本任务差异，也没有新部署报告。其短sha_tag/事件seq和日志仍不能当新wire完整身份或saved回执；新增观测开销须由该任务新构建/设备报告另验。各时刻摘要及未变化的矩阵/profile/Store见G0报告。
```

## 原 docs/context/plans/round-pet-g0-handoff.md

```text
# 给固件任务：G0契约决定／待确认项

2026-10-30。管理端静态审查交付，**不是已发送消息／双方签字或设备实施授权**。固件输入：round-pet-hub-baseline-alignment、single-device Spec/Diff和current-status；管理端方案见[Spec](round-pet-single-device-spec.md)、[字段提案](../../protocol/round-pet-single-device-v1.md)、[差异表](../round-pet-hub-baseline-alignment.md)。固件仓库本轮未修改。

## 已核对、建议沿用的共同约束

- 固件当前矩阵报告前瞻应用67e1af88…（TIMING）及a7精确回退；保留原生360／24fps／241帧、46个原编号动作、466²居中、V2格式和固定namespace，不改分区。不是本管理端重新读设备得出的部署证据。
- 0/4保护指动作ID，不是物理slot 0/4；4个root活跃引用＋1暂存，Flash挥手read lease必须保留。单encoded RAM工作集不能伪报四槽。
- 复用首帧刷新提交与Store root提交两个不同钩子；本地触摸权威、维护冻结显式展示，不承诺下载／擦写时旧动画持续播放。
- 管理端当前730项宿主证据（含A1/A2各35项、A3 46项、A4 48项、A5 41项、A6 30项、A7 24项、A8 34项、A9 14项、A10 24项）、scoped保持；固件规划中的385项／无认证缓存为旧hub读取快照。无需固件任务重做hub优化；新scope仍完整查元数据，动态日期／撤销不缓存。

## 待双方确认的具体决定

“管理端已选方案”不等于固件已接受；请对下表逐项给出接受或替代方案及源码／向量证据。未决项不得默认为兼容。

| ID | 管理端已选方案／需要固件答复 | 状态及阻塞 |
| --- | --- | --- |
| C01 能力执行 | schema2：playback_bytes=max_asset_bytes=slot_bytes=5865472，persistent={active_slots:4,staging_slots:1}，center(53,53)，媒体241/24/flag1/key12/tile20；保护按动作ID。固件确认实际值、media扩展与read lease／root序列语义 | parser/推荐及A1离线资源模型已实现；runtime未装配；待固件确认，候选参数不冻结wire |
| C02 三摘要／N | F为文件，P=SHA(C(export.content))，M=SHA(C(content.catalog))；P不能作为M。N固定dfc829e13e7c25d732ae0c0afd011f1232419e603ba06c225104645ea668bdf6，不写新M/P进旧root。请核定真实46动作源SHA/P及ID集合、批准许可引用 | A2候选recipe/严格导入35专项已通过；真实包映射/许可未共同核定，阻塞真实包批准／G3 |
| C03 manifest／资源 | hub全验P/M/F与241帧，ESP保留批准(P,M,N)及单动作descriptor，metadata按≤8动作／≤4KiB分页；不新增全46条缓冲。若设备必须自行重算整包P，请给元数据驻留／流式hash设计与内存预算 | 待双方确认；G2前关闭，不能把PC完整元数据常驻成本漏算 |
| C04 三条状态轴 | playback schema1维持原phase；另storage.report/inventory.snapshot/display.report schema1，显式版本协商。saved=成功有效root持久提交；offline_available=当前根仍引用同N/id/F；root_seq/object_generation均uint64串。现有save_root在marker写入后仍读回，bool=false可能结果未知；请确定提交钩子/错误阶段、根查询／淘汰事件及commit_unknown分类 | A3管理端对象候选/只读UI已离线完成；真实wire/固件钩子待实现，仍阻塞G4，不能复用旧phase |
| C05 手动／触摸 | 提议remote manual始终更新循环base（含4），physical 4是单次约241/24秒并回最新有效base；首窗口优先0/11＋physical4，手动4需UI明确。不同意时请在G0选择“手动4禁用”或给明确单次语义，不沿用PC once_idle/once_hold测试策略 | 待固件／产品共同确认；未定不对该动作发命令 |
| C06 首帧／维护 | 完整command/context＋generation在刷新提交后发playing；需要防同帧／旧token误关联。local display事件不得回生成remote4；维护loading/verifying/saving区分冻结最后帧/未知，回执不能重置本地寿命 | 首帧／冻结代码已有，完整新上下文钩子待固件实现；管理端独立A3投影已拆requested/sent，旧模拟不转换 |
| C07 wire方向／错误 | hello显式选round-pet-native360/1；设备POST exchange，响应≤1 control，下一exchange交回执；lease复用native360-v5-lease/1候选子记录，不等于旧v5。确认外层字段、type、错误码、分页、各stream seq和控制4KiB／头8KiB限额，提供Node/C++同一字节golden | A4已验Node loopback实际pull/下一HTTP回执及显式候选版本；路径/profile/remaining_ms及A5可选victim_action_id仍是独立候选，阻塞共同wire/Node-C++互验与联合G0关闭 |
| C08 取消／保存预算 | 原写预算12次尝试/小时，非安装60秒间隔／稳定5秒等保持，失败也占尝试。commit前取消不发新root，commit后取消不撤销事实；过时saved不激活旧目标，淘汰同次更新库存。确认有限commit最坏耗时和不可中断区 | 源码策略已读，G1实测未验；阻塞G4，不能每次点击强制写盘 |
| C09 排队／租约 | 不将离线8控制FIFO作为生产默认；1个在途control、1个未派发latest base、1个待段，renew/cancel/revoke有界优先。段后立即exchange；验证／擦写维护也需给通讯机会，范围／poll／cleanup上界未实测不准入。不能延TTL替代预算 | A4宿主队列/相对许可/段间控制已验，仍待固件RTOS／I/O让出及硬上界答复；G0定设计，G2/G3验证数值 |
| C10 认证／持久化 | 单TLS／单HTTP owner；TLS1.2/P256候选，精确服务名／CA／指纹绑定。需可信时间引导、设备私钥／证书／epoch持久提交、撤销／重绑定及密钥丢失恢复方案；RAM凭证探针只验证可行性，不是正式绑定 | ESP均待资源／实现确认；G2前设计关闭、实测后才能启用G3 |
| C11 资源与现行维护 | P3显式PSRAM6916777含65536 read-ahead；内部最低59035B不是TLS可分配量。保留内部≥48KiB等门槛，最大连续块／新任务栈未知不放行。G1由固件任务验证旧v5下载／保存／淘汰，不启动hub通道 | 待固件G1/G2报告；阻塞任何真实listener／设备闭环启用 |
| C12 控制源／恢复 | 新旧v5显式互斥，不靠停止整个pet/bridge服务；前瞻结束态、a7回退均保留。需要设备端关闭旧poll／新通道的可核验机制；应用恢复与NVS/绑定/缓存恢复分列 | A5宿主默认OFF/初始库存/退出后重连/不重放已验；仍待固件给设备窗口／NVS恢复步骤，本轮不执行，阻塞D1/D2操作 |

## 建议先交换的最小数据

1. C01能力对象、C02真实P／源SHA／46个(action_id,F,bytes,241,24)的无秘密清单及许可引用；不得发送素材大文件、凭证、SSID或本机endpoint。N已按现有identity计算，双方独立核对。
2. C04/C06成功及失败回执样本：同会话首帧、local挥手＋新base、save_deferred、commit完成后取消、淘汰victim、重连库存snapshot；说明是模拟还是设备日志重建，不能以日志本身代替未来wire。
3. C07同一虚构身份的字节golden与错误表，确认旧端看到新profile时拒绝的方式。新实现前，先分别过SD向量，不能运行另一仓库导入器来“互操作”。
4. C09–C12资源／时钟／凭据设计和G1/G2报告；资源未过仅继续离线对照，不能绕过安全认证直接走旧Bearer做新协议闭环。

## 联合G0关闭与责任

管理端：负责A1–A5、导入／状态UI、服务owner及协议宿主对照；固件任务负责现有播放器／Store钩子、能力／会话／Flash语义、IDF资源／构建及设备报告。两端共同维护一份已选择字段／recipe／版本和正反向量，注明各自源码摘要，不能只引用dirty仓库HEAD。

当前结论是“管理端G0审查交付，联合G0仍待确认”。C01–C08的具体wire/语义及C09–C12的设计／准入责任关闭后才可称联合定版；动态门槛在G2/G3仍需另验。固件任务的旧hub快照不改写，由其下轮读本交付刷新；本任务不直接修改它。

并发复读：固件任务收尾新增维护trace工程，管理端只读观察并保留。Trace当前使用局部request/touch及短sha_tag/日志，不能直接序列化成新协议的完整身份/uint64回执，也不替代G1/G2验收；请在后续交付提供冻结的新源码/构建/报告，不用旧P3内存结论覆盖新增观测开销。

## A5管理端补充交接

管理端默认OFF候选已完成，详见[A5 API](../../protocol/round-pet-a5.md)与[41项报告](../../reports/2026-10-30-round-pet-a5.md)，不是生产准入。请共同确认：新hello必须新完整inventory；EMPTY仅0／IDLE_READY仅0和4；OFFLINE_READY后允许固定角色；旧F仍占root槽，同ID换F原子更新可不淘汰其他动作，新增动作满4槽需显式victim_action_id且不得0/4。该可选字段只进入候选storage.save，不要求当前v5支持。

保存需当前verified/playing与有效控制权，缓存命中不重复强制写；unknown须查询新完整根，旧saved不解除当前未知。设备Store仍须独立执行写尝试/磨损/稳定窗口、read lease与提交规则。管理端pin/磁盘fd证据不替代ESP的Flash保护。resume只恢复管理端readiness、不启用通道；真实设备也需给出旧任务退出与新hello前的有界清理证明。上述均待C04/C05/C07–C12共同确认，未发送任何设备命令。

## A6执行对照交接

[A6模型驱动30项](../../reports/2026-10-30-round-pet-a6.md)已把A1 root/刷新/保存事实接回A5/A3，仍非固件实现。C07/C12下一需冻结：A1 actor revision与hub owner revision的生命周期不同，hub重启/设备不停机时必须给出会话命名空间/重置规则，不能依赖模拟reboot或复用旧命令。

模型可恢复有效旧root；若hub已确认更高root_seq，当前候选拒绝回滚并使库存unknown。请明确真实设备回滚后的维护/重新建立信任流程，不能静默降低高水位。marker错误保持outcome_unknown，恢复查询不把历史未知补成saved；丢回执后不重放save。deferred可表示未完成提交并允许拉取cancel，但提交前/后竞态与实际让出须C04/C08/C09共同确认。物理面板、V2/NVS、磨损和G1/G2均未关闭。

## A7候选决定交接（未共同定版）

[A7](../../protocol/round-pet-a7.md)已离线验证：revision按完整context命名，新认证会话可从1开始；A1切换volatile工作而不reboot/重扫Flash，旧context回调/票据不得注入新会话。请C07/C12确认固件认证边界、context切换和旧任务退出机制，不能仅信wire声称new session。

根状态候选以binding/N为scope保floor、最后完整根及尚未查询的floor_commit对象。管理端仅临时caller文件交接，生产权威持久化未实现；请共同确认saved先于inventory、低root/同seq冲突、系统回滚与撤销重新绑定边界。维护不降floor：先保全/只读核对，恢复已批准相同/更高根，或独立授权撤销旧binding后重建信任，无自动清文件/格式化。

deferred不是提交；cancel先于commit不发新root，commit先于cancel不撤销saved，marker未知不伪造cancel成功。本轮同步模型/Node TLS不证明ESP互斥、让出与最坏延迟，C04/C08/C09及G1/G2继续待确认。无设备操作授权或固件修改。

## A8显式权威交接

[A8](../../protocol/round-pet-a8.md)已在自有临时新profile验证同文件绑定/凭据/root CAS，投影在同步耐久成功后发布；旧v1不迁移。根确认落盘不代替设备saved或素材批准，跨owner仍新hello/库存；进程崩溃不等于物理掉电。当前实例可检旧revision，新进程无法识别合法整盘回放，可信锚/恢复批准仍需另审。

同步锁/fsync/投影复验增加了管理端成本，下一先测同负载与最坏等待；不能据旧loopback预算或延TTL启用设备。请C04/C07/C08/C12保持共同确认，固件G1/G2、真实包/字节golden和独立设备窗口不因新profile通过而放行。

## A9成本交接

[A9](../../reports/2026-10-30-round-pet-a9.md)已量化显式持久profile宿主成本：同负载load225→308、64登记逻辑读24.03MB、7次同步/1次noop；单peer非64连接。root_commit样本max14.323ms不是上界，未改TTL/队列。沿旧B1900假设加R100ms即RTT4002超过4s回执，lease仍有余不能替代较短deadline；client1500/server2000另有限制。

最大字段64登记仅63根可持于129724B，第64根超131072B保持文件；不是全64最大字段保证。A10已完成局部减noop编码/重复摘要并保完整验证和失败关闭，不能据主机样本豁免ESP维护让出/可信时间/秘密/退出硬上界；C04/C07/C08/C12、G1/G2和设备窗口保持待验。

## A10交接决定

[A10](../../reports/2026-10-30-round-pet-a10.md)新跑full/reduced同负载，额外摘要315→0、noop省77934B（64档），仍完整读盘/hash308次、动态日期/撤销/锁/CAS及7次同步。策略仅hub内部成本差，文件/协议/队列/TTL不变，无固件改动请求，不需固件重做管理端优化。

下一需固件共同确认C01–C12/真实46包N/F/M/P/原ID/许可批准及Node-C++向量；本轮未新读固件/设备，不能从宿主减量推断ESP单TLS内存、可信时间、凭据持久化、维护/取消上界或G1/G2已通过。现有前瞻/a7恢复及独立设备窗口保持门禁；不自动启动listener或接设备。
```

## 原 docs/context/native360-baseline.md

```text
# 当前正式目标：1.75C-EN／原生360

2026-10-30 G0只读刷新。设备实时版本的唯一外部矩阵是固件仓库docs/context/current-status.md；本页为管理端引用快照，不是本任务读Flash／串口结果。管理端差异和实施入口见[对齐表](round-pet-hub-baseline-alignment.md)、[Spec](plans/round-pet-single-device-spec.md)，旧记录[归档](history/round-pet-g0-evolution.md)。

| 项目 | 当前引用与验证范围 |
| --- | --- |
| 目标 | 一块ESP32-S3-Touch-AMOLED-1.75C-EN；旧128/240仅历史兼容，不改它 |
| 当前部署报告 | 前瞻应用SHA256 67e1af88f9f5d933ca9a9da08e2e5c64e5e74d4cc075fa99d0e8aa6a7faa4100，1320048B；P1/P2与TIMING，P3三配置分别600秒及用户实屏通过；不是联网维护／无TIMING发布／8小时验收 |
| 精确回退报告 | a7d1c0541f9c392462b7ae35c06c88711f0dea74c0052e3e855383a2c771f879，1300512B；当前源码不能重建后冒充a7。旧a2625a整片含2c，不是当前前瞻＋缓存的快照 |
| 几何／素材 | 466×466屏，360×360 PET4 center(53,53)，24fps／241帧、flag1/key12/tile20；当前固定角色46个原编号动作，PC库225509627B。通用parser范围不放宽生产约束 |
| 存储 | 32MiB Flash／8MiB OPI PSRAM，既有2MiB应用＋28MiB V2素材区；4活跃root引用＋1暂存，当前缓存动作0/4/1/11，0/4保护、1/11可轮换。不是4个RAM槽，也不能全库离线 |
| 工作集／内存 | 单encoded最大5865472B，三RGB＋history等907200B，FAST read-ahead65536B；P2显式PSRAM6916777B／系统前余1471831B。P3最低PSRAM空闲1404660B、最大块1376256B、内部59035B、main栈2376B，均非TLS峰值／可分配上界 |
| 性能报告 | 正常点击23.73源FPS，恢复约24；同代最大70.47ms、跨代118.02ms，未承诺严格24fps／面板FPS或无停顿。网络关联及旧服务失败重试存在，不是成功联网维护 |
| 当前网络代码 | 旧v5 HTTP Bearer／整文件下载／played/touch；不支持新hub完整context/lease/mTLS或saved线上确认。现行control与loader可分别发请求，不符合新单TLS owner设计 |
| 首闭环计划 | 先缓存命中手动＋本地触摸，再未缓存／保存／淘汰／重连；G0双方定版待确认，G1维护和G2 TLS/可信时间/秘密／取消资源待验，真实通道仍关闭 |
| 回退边界 | 保留前瞻和a7，恢复前另核设备身份／表／双根／当时备份；应用回退不自动撤销新凭据或还原NVS／素材。不改分区、namespace，不自动擦Flash |

来源根：/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio。只读核对current-status、round-pet-hub三份规划、pet_native360_{main,profile,store,catalog,policy}、media_contract及P2/P3报告；精确源码／文档摘要见[G0报告](../reports/2026-10-30-round-pet-g0.md)。P2构建源25fadc87…与本次固件HEAD4cf4b4e…分开，不能只用HEAD还原dirty内容或设备镜像。

旧docs/protocol/transport-budget.json及预算脚本本轮未改，里面6851241B等是历史输入，少65536B read-ahead，不代表本页新前瞻资源准入。旧140KiB预握手／32KiB余量只作历史假设；当前保留固件内部≥48KiB、PSRAM≥1MiB／最大块≥512KiB、main栈≥1KiB，TLS最大连续块和新任务栈待G2定版。不能单算术通过或延TTL掩盖未知资源／排队。

本轮只改文档／原创摘要向量并跑既有宿主回归，不构建或运行固件、连接／烧录设备、启动生产listener、安装插件或修改DSH/pet/bridge配置。
```

## 原下一入口

```text
1. **联合G0与真实素材批准**：持久化成本及局部减量已完成[24专项/730全套](../reports/2026-10-30-round-pet-a10.md)，不再重做A2磁盘reader/共享owner。下一按[C01–C12](plans/round-pet-g0-handoff.md)冻结共同wire、手动4与victim字段、初始库存/重连语义，核定真实46原ID、P/源SHA、许可/署名与固定N。真实库专项只读审计先写Spec/Diff，不执行固件导入器、不自动批准。
```

## 原正式目标引用与下一入口

```text
用户选择1.75C-EN／原生360。固件最新矩阵/P3报告记前瞻67e1af88…（1320048B，TIMING）与a7精确回退；466²屏／360²PET4/24fps/241帧，V2 28MiB／4活跃＋1暂存，动作0/4保护、1/11可轮换。当前网络仍旧v5，不是hub-device/1。此为本轮上游报告引用，未新读设备；正式来源／恢复边界见[基线](native360-baseline.md)与[G0差异表](round-pet-hub-baseline-alignment.md)。
A8显式同文件绑定/根CAS、私有候选后durable发布、新owner恢复继续有效；默认v1不迁移，v2仍OFF/新库存/控制，无公开清floor/rebind/生产listener，deviceTransport=false。新进程不能识别同盘合法旧文件回放，SHA/fsync不是批准或物理掉电证据；同步FS不可由JS timer硬中断。局部重复工作切片已闭合；下一共同G0 C01–C12/真实包批准与Node-C++向量，冷盘/真实时延/可信锚、G1/G2及设备窗口保持NO_GO。
```
