# 共同G0证据核定演进

2026-11-02。以下为本轮核定前的R1外部引用/R7交接状态。只替代“未新读固件、A/B现场未收尾、原许可声明未直读、下一进行证据核定”部分；R7同步模型通过和G0/G1/G2限制继续有效。最新[报告](../../reports/2026-11-02-round-pet-g0-closure-review.md)、[C表](../plans/round-pet-g0-handoff.md)。历史链接按原文件位置解释。

## 原 docs/context/native360-baseline.md

```text
# 当前正式目标：1.75C-EN／原生360

2026-10-30 G0-R1只读外部快照；G0-R2仅刷新管理端门禁状态，未重新访问固件或设备。设备实时版本的唯一外部矩阵是固件仓库docs/context/current-status.md；本页为管理端引用快照，不是本任务读Flash／串口结果。管理端差异和实施入口见[对齐表](round-pet-hub-baseline-alignment.md)、[Spec](plans/round-pet-single-device-spec.md)、[复核报告](../reports/2026-10-30-round-pet-g0-reconciliation.md)，旧快照已[归档](history/round-pet-g0-reconciliation-evolution.md)。

| 项目 | 当前引用与验证范围 |
| --- | --- |
| 目标 | 一块ESP32-S3-Touch-AMOLED-1.75C-EN；旧128/240仅历史兼容，不改它 |
| 最新部署引用 | 矩阵顶部/缓冲A/B Spec记窗口中断，最后核对cbdf3169…维护候选及临时端点，未恢复67；A准入/待机通过，切换/点击及B未执行，串口已关闭。下方“当前67”旧行不覆盖顶部；本轮不新读设备/恢复服务 |
| 已验播放基线/恢复目标 | 前瞻应用SHA256 67e1af88f9f5d933ca9a9da08e2e5c64e5e74d4cc075fa99d0e8aa6a7faa4100，1320048B；P1/P2与TIMING，P3三配置各600秒及用户实屏通过；不是此刻驻留或完整联网维护／发布／8小时验收 |
| 精确回退报告 | a7d1c0541f9c392462b7ae35c06c88711f0dea74c0052e3e855383a2c771f879，1300512B；当前源码不能重建后冒充a7。旧a2625a整片含2c，不是当前前瞻＋缓存的快照 |
| 几何／素材 | 466×466屏，360×360 PET4 center(53,53)，24fps／241帧、flag1/key12/tile20；当前固定角色46个原编号动作，PC库225509627B。通用parser范围不放宽生产约束 |
| 存储 | 32MiB Flash／8MiB OPI PSRAM，既有2MiB应用＋28MiB V2素材区；4活跃root引用＋1暂存，当前缓存动作0/4/1/11，0/4保护、1/11可轮换。不是4个RAM槽，也不能全库离线 |
| 工作集／内存 | 单encoded最大5865472B，三RGB＋history等907200B，FAST read-ahead65536B；P2显式PSRAM6916777B／系统前余1471831B。P3最低PSRAM空闲1404660B、最大块1376256B、内部59035B、main栈2376B，均非TLS峰值／可分配上界 |
| 性能报告 | 正常点击23.73源FPS，恢复约24；同代最大70.47ms、跨代118.02ms，未承诺严格24fps／面板FPS或无停顿。网络关联及旧服务失败重试存在，不是成功联网维护 |
| 当前网络代码 | 旧v5 HTTP Bearer／整文件下载／played/touch；不支持新hub完整context/lease/mTLS或saved线上确认。现行control与loader可分别发请求，不符合新单TLS owner设计 |
| 首闭环计划 | 首窗口设计选远端0/11＋physical4，remote4暂禁；R2已验显式离线gate与内部选项，真实UI/固件适配未实施；再未缓存／保存／淘汰／重连。G0 wire/批准未关闭，G1完整维护和G2 TLS/可信时间/秘密／取消资源待验，真实通道仍关闭 |
| 回退边界 | 保留前瞻和a7，恢复前另核设备身份／表／双根／当时备份；应用回退不自动撤销新凭据或还原NVS／素材。不改分区、namespace，不自动擦Flash |

来源根：/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio。本轮核对current-status、指定三份规划、新G0回复/输入、设备目录后的Store/播放器/策略/HTTP与媒体导出源码；当前读取HEAD9816317…，不代替dirty文件或部署身份。精确SHA见[G0-R1报告](../reports/2026-10-30-round-pet-g0-reconciliation.md)，原P2/P3指标仅沿用对应历史证据。

G1轻量fc55曾联网60秒通过，但缓存挥手后SDK历史低水位46527B＜48KiB，素材下载/保存尝试0；后续缓冲A/B中断，完整维护未通过。SDK区域历史低点之和不等于同刻全局最低/泄漏证明，TLS峰值/最大内部块/栈/退出硬上界保持待验。真实库46文件/11086帧全CRC/index及46源blob身份本轮已核定，独立许可批准/真实A2导入未执行；原始形象声明需直接核验。400/78与分层候选不改变本正式目标。

旧docs/protocol/transport-budget.json及预算脚本本轮未改，里面6851241B等是历史输入，少65536B read-ahead，不代表本页新前瞻资源准入。旧140KiB预握手／32KiB余量只作历史假设；当前保留固件内部≥48KiB、PSRAM≥1MiB／最大块≥512KiB、main栈≥1KiB，TLS最大连续块和新任务栈待G2定版。不能单算术通过或延TTL掩盖未知资源／排队。

本轮只改文档／原创摘要向量并跑既有宿主回归，不构建或运行固件、连接／烧录设备、启动生产listener、安装插件或修改DSH/pet/bridge配置。
```

## 原 docs/context/round-pet-hub-baseline-alignment.md

```text
# 管理端 G0 基线与契约差异表

2026-11-02 G0-R7刷新同步gate失联/暂停恢复；外部事实仍为G0-R1只读快照，本轮未访问固件/设备。[Spec](plans/round-pet-g0-reconciliation-spec.md)/[Diff](plans/round-pet-g0-reconciliation-diff.md)、[报告](../reports/2026-10-30-round-pet-g0-reconciliation.md)、[C01–C12权威交接](plans/round-pet-g0-handoff.md)。旧管理端快照已[归档](history/round-pet-g0-reconciliation-evolution.md)，A1–A10与认证/承载优化保持。固件回复中的hub469/385项仅是历史读取，不覆盖当前工作区。

## 固定输入与验证层次

| 输入 | 已确认事实 | 限制 |
| --- | --- | --- |
| 管理端 | A1–A10离线资源/导入/观察/pull/OFF装配/执行/根权威/减量已实现；Node24.14.1/npm11.11.0，最新全套见当前系统 | HEAD a5a2cff…不能复现主要未跟踪实现；R4/R5新增内部默认OFF临时hello/exchange/GET adapter，复用已有owner，不装配生产入口、不重做优化 |
| 固件快照 | 读取HEAD9816317ae5ac6f86c982ef773461de595f407747；代码已迁入devices/esp32s3-touch-amoled-175c及common；源码/回复各文件SHA见报告/向量 | dirty工作区不由HEAD完整表示，旧G0文件路径/SHA不能直接当当前实现 |
| 部署引用 | current-status顶部及缓冲A/B Spec记最后核对cbdf3169…、临时端点保留，未恢复67，串口owner关闭；A联网准入/待机，切换/点击和B未执行 | 这是上游记录快照，本轮未新读设备；下方“当前67”旧行不覆盖顶部中断结论。67是P3性能基线/恢复目标，a7保留 |
| G1/G2 | fc55 G1曾联网准入通过、缓存挥手后SDK历史低水位46527B＜49152，未下载/保存；后续A/B中断，完整维护未通过 | SDK历史低位不等于同刻全局最低/泄漏证明；TLS/可信时间/凭据/最大块/清理上界均不能从旧P3推得 |
| 正式媒体 | 466²屏／360² center53、PET4/24/241/flag1/key12/tile20；46原ID、225509627B/11086帧 | 400/78与分层候选保持隔离，不改正式角色/尺寸或V2 N |
| 存储/内存 | 28MiB V2、4活跃+1暂存、按动作ID保护0/4；单encoded5865472B，stride5869568，read-ahead65536；显式PSRAM6916777 | 能力数值表不是完整hello；P3内部59035B是旧播放样本，非TLS准入；完整46库不在设备离线缓存 |
| 真实身份 | 管理端独立重算P=3afe4578…、M=9045bd6b…、N=dfc829e1…、源SHA=a6a2ddae…；46文件全F/CRC/index和46源视频git blob/源SHA一致 | license_ref原为upstream-reference-only，不创建独立approval，不真实导入CAS或生成设备指令；完整值/逐动作证据见[复核向量](../protocol/vectors/round-pet-g0-real360-review-v1.json) |

外部只读根：/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio。G0-R1指定三份规划和current-status、G0 reply/inputs、G1-lite/内存报告及实际Store/播放器/策略/导出代码均核对；未调用导入器/固件测试或构建，不读运行凭据/配置。上游固定README与git目录只读取回，设备验证始终离线。

## 实现／决定／未决差异

“设计一致”是两份立场相符，不能提升成新wire或实体能力。完整12项及下一证据以交接表为准。

| 项目 | 管理端已实现/本轮确认 | 待实现／待确认 |
| --- | --- | --- |
| schema2 | parser/推荐/几何＋A1独立单RAM/Flash模型，A6执行链已离线验证；固件数值一致 | 旧DeviceModel仍schema1；固件完整hello身份/媒体扩展/实体执行和资源报告缺失，不能只因parser通过称闭环 |
| F/M/P/N及来源 | A2分域/严格导入/provenance已有，R1真实46字节/源blob/ID/recipe确认，V2 N保持 | R3合成Node-C++宿主wire向量已交付；许可链/用途/独立approval、真实完整库A2导入/恢复及固件消费未完成，不从哈希生成批准 |
| 接纳/首帧/实际画面 | A3认证proof/目标/序列/查询投影及只读UI，A6模型首帧已验；固件有局部刷新提交钩子 | R3已定义完整context/generation/刷新结果表示，R4已接临时schema2到A3投影，设备钩子/真实输入未实现；旧played/HTTP/PC preview不能代替，同像素真实首帧提交仍待验 |
| 保存/淘汰/恢复 | A1/A3 root_commit/独立库存/当前性，A7/A8同binding根floor与durable发布保持 | 固件bool不能区分marker/读回未知与I/O恢复失败；须分提交阶段/完整根再判saved，不直接套模型或旧日志“保留旧根” |
| 手动/触摸 | **R2已实现（离线）**：A5显式first-window-review/1只允许cached0/11，入队/派发都验；local4优先/首ACK寿命/latest/失效回idle用有界core模型对照，manualChoices内部投影 | 通用46候选缺省保持，正式UI/实体触摸/设备wire运行适配仍未实现；不得靠默认候选绕过首窗口。deferred_local/base_loop字段已由R3定义，R4临时adapter已接入，真实UI/设备消费未接入 |
| 取消/维护 | **R2已实现（模型）**：显式gate；gate前取消无新root，gate后可saved但旧播放cancelled；recoverStorage清volatile，I/O未知保持blocked/不补saved/不降floor | 固件commit内部不可取消，R7同步模型已验证失效本地收尾；真实gate原子性/错误阶段/不可抢占残余仍需固件实现验证，不把逻辑步进当RTOS/Flash证据 |
| wire/版本 | A4 loopback round-pet-pull-candidate/1、下一HTTP回执、分页/Range/单在途已验；A5默认OFF | R3新合同已定义/hub-device/v1、wire/1、字段/错误/版本和Node/C++宿主向量；旧A4仍无这些新字段，不自动转换。R4临时hello/exchange adapter已完成，R5临时GET已完成，固件签核/设备与生产装配未完成，不得换名直接接ESP |
| 调度/授权 | 单pending/latest/普通、紧急旗标、scoped每scope/4KiB完整元数据、动态日期/撤销及完整deadline；A10 extra315→0且保护成本保持 | 固件当前旧v5多HTTP/整文件路径非单TLS owner；RTOS/Flash让出/cleanup上界未知，不能延TTL或用loopback样本准入 |
| 身份/恢复/控制源 | 管理端binding CAS、hello/session、A5 OFF恢复、A8根权威/低root失效已有 | 正式可信时间/秘密/epoch持久化/撤销重绑定；设备端新旧owner互斥和中断现场恢复须固件/独立窗口；无自动降floor/清锁/格式化 |
| 生产准入 | 当前deviceTransport=false，无生产listener/真实设备闭环；730是A10阶段证据，本轮回归数见报告 | 修订2共同签核/生产装配及许可批准、G1全维护/G2资源通过后，才另授权G3/4；物理掉电/冷盘/多日/多设备等仍未覆盖 |

## 审查结论与下一入口

真实库**身份核定完成、批准与联合G0未完成**。G0-R2已完成[35专项](../reports/2026-10-30-round-pet-g0-r2.md)，R3已交付[新表达/24专项](../reports/2026-11-02-round-pet-g0-r3.md)，R4已接临时hello/exchange与schema2投影；R5又接临时GET/分段；R6已补A1 actor新wire全链；R7已补同步gate收尾；下一共同G0/资源许可证据核定（先Spec/Diff）；不重做A2机制或A10承载优化。C02用途批准及原始声明直接核验并行补齐；等待固件G1/G2，不主动处理当前A/B中断现场。具体小切片/验收/回退见[C01–C12交接](plans/round-pet-g0-handoff.md)。
```

## 原 docs/context/plans/round-pet-g0-handoff.md

```text
# 给固件任务：G0 契约决定／待确认项

2026-11-02 G0-R7刷新；外部事实仍限定G0-R1只读快照，本轮未新读固件/设备。管理端已只读复核固件[回复](/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio/docs/protocol/round-pet-native360-g0-reply.md)及[输入向量](/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio/docs/protocol/vectors/round-pet-native360-g0-inputs.json)，并独立重验真实360/46库。[管理端报告](../../reports/2026-10-30-round-pet-g0-reconciliation.md)、[基线差异表](../round-pet-hub-baseline-alignment.md)、[无批准的身份复核向量](../../protocol/vectors/round-pet-g0-real360-review-v1.json)为本轮证据。旧交接全篇已[归档](../history/round-pet-g0-reconciliation-evolution.md)。本文是可交付文档，**未发送消息、不是共同签核/生产wire装配或设备操作授权**；固件仓库未修改。真实身份与外部事实在G0-R1核对，本轮仅补同步actor的gate失联/暂停本地收尾；修订2合同/向量及GET关联规则仍须共同审阅。

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
| C08 取消/写预算 | **接受双边界设计**：取消准入gate与持久marker分开；gate前已观测取消不进入提交，gate后取消不承诺撤销保存，只禁止旧目标激活。marker/读回未知不得报未保存 | 管理端R2/R7已补逻辑gate/取消后保存、失效时一次本地收尾和恢复I/O/floor对照；固件persist仍只在commit前查取消，commit内部无回调，真实gate原子性/错误阶段及已授权收尾/撤销边界仍待固件确认。12次是启动内易失固定窗（首尝试起一小时），非滑动/跨重启硬限额；普通60秒，load完成约5秒且已呈现/非local才判断；installation仅维护、失败也占预算。G1实测与不可抢占上界仍缺 |
| C09 调度/期限 | **结构一致**：单在途control、单未派发latest、单待段，renew/cancel/revoke有界旗标，段后先exchange，不用8 FIFO | RTOS owner/让出/退出硬上界待实现实测。包括commit残余、全验/擦写与host磁盘成本；500ms poll/1s段仅假设。缺上界NO_GO，不延lease/放宽deadline掩盖排队 |
| C10 身份/认证 | **方向一致**：单TLS/HTTP owner，TLS1.2/P256仅探针候选，认证失败不降级IP/Bearer/明文 | 正式可信时间、密钥/证书/epoch持久提交、撤销/重绑定/丢钥恢复还缺可审查Spec与资源预算。RAM凭据探针不是配对，G2前不能开真实通道 |
| C11 资源/G1/G2 | **口径一致**：P3显式PSRAM6916777含64KiB read-ahead；保留内部≥48KiB、PSRAM≥1MiB/块≥512KiB、main栈≥1KiB及2MiB应用余量目标 | 最新G1并未通过全维护：fc55低水位门禁停止，后续A/B中断只覆盖A准入/待机，未缓存切换/点击，B未测。TLS峰值/最大内部块/新栈/清理未知；P3和loopback均不能放行 |
| C12 控制源/回退 | **设计一致**：启动网络owner前选择旧v5或新hub，断线不自动切源，不停整个pet/bridge；新session新hello/库存/控制，不重放旧命令 | 选择形式/持久策略/核验机制未实现；A5仅宿主OFF恢复。中断现场恢复需另获设备窗口授权，app/配置内容/凭据epoch/缓存分别恢复核对，不擅自触碰NVS/服务或整片恢复 |

## 下一次可独立验证的小切片

G0-R2已完成[35项离线对照](../../reports/2026-10-30-round-pet-g0-r2.md)：显式首窗口入队/派发门禁、profile固定/选主隔离、local/latest寿命、取消gate、marker未知与I/O/floor恢复；仅原创媒体/临时环境，无生产通道。旧R1未实现状态已[归档](../history/round-pet-g0-r2-evolution.md)，不重做该切片。
G0-R3已完成[24专项/双语言字节合同](../../reports/2026-11-02-round-pet-g0-r3.md)，旧未定义wire状态已[归档](../history/round-pet-g0-r3-evolution.md)。这是管理端提案，不代固件签核。

1. **共同G0收口与证据核定**：R7已补同步模型gate失联/lease/暂停/迟到回执/新会话竞争及close实际退出，见[API](../../protocol/round-pet-gated-recovery.md)。gate仅授权一次本地完成，失效终态不回旧会话，unknown只能恢复读；token是模型内部能力，不是拟新增wire字段。下一先Spec/Diff，只读对照固件最新实现/回复/报告，确认不可取消写与凭据撤销边界、异步RTOS实际退出/最坏上界、GET关联/R3修订2字段及恢复库存策略；单方宿主通过不能关闭联合G0。再结合真实许可/G1/G2/精确回退安排另审设备窗口，本轮不操作现场。
2. **真实素材独立批准**。G0-R1身份已固定，下一补原始许可链/用途/署名与分发范围记录，再选择是否建立**仅offline-validation**的A2批准并测试真实完整库导入/重开。approval由独立审阅输入提供，不把本复核JSON/哈希自封为批准；任何生产/商业分发另审。
3. **等待固件资源证据**。G1维护、G2时间/凭据/单owner/TLS/有限清理通过后，才准备G3真实缓存0/11+physical4方案/具体回退和单独窗口。G4再未缓存下载、校验、首帧、保存、淘汰、断连/重连。400/跨角色/多设备/BLE/OTA/音频不合并。

## 联合关闭与回退

联合G0仍**未关闭**：C02用途批准、C07修订2的固件共同签核/固件消费与生产装配（临时宿主hello/exchange已实现），以及C04/C08/C09/C10/C12具体边界/身份设计还缺交付。G1/G2是独立执行门禁，不能以设计一致替代实测。管理端不改固件回复中的旧hub快照，由固件任务下次读取本交付自行刷新；本轮没有发送消息。

本轮无外部运行变化；撤回显式profile/局部门禁或关闭自有临时owner即可，无数据格式/TTL迁移或应用/配置/NVS/缓存恢复操作。未来实物操作前以最新矩阵+独立读回冻结现场、保护67/a7与窗口前完整备份；仅恢复app不等于恢复配置/绑定/缓存。当前临时端点/服务属于另一窗口，本轮不启动、停止或清理它们。

管理端R2[API](../../protocol/round-pet-g0-r2.md)明确：cachedHitInventoryOnly仅本地模拟结果，不是新的storage ACK；R3现已定义取消/命中与pending的独立关联表达并做宿主对照，已由R4临时adapter消费验证，待共同签核/设备消费。本轮gate并非固件RTOS锁或Flash字节实现，不豁免G1/G2、许可批准及设备窗口。
```

## 原 docs/context/current-system.md

```text
用户选择1.75C-EN／原生360，正式仍466²屏／360²PET4/24fps/241帧、46动作，V2 28MiB/4活跃＋1暂存、按ID保护0/4。G0-R1只读最新固件矩阵顶部/缓冲A/B Spec：窗口中断、最后核对cbdf3169…维护候选及临时端点，未恢复67；A准入/待机通过，切换/点击与B未执行。67仍是P3播放基线/恢复目标，a7精确回退保留，不能把下方旧“当前67”行当实时驻留。旧v5不等于hub-device/1；本轮未新读设备或处置现场。来源/恢复边界见[基线](native360-baseline.md)与[G0差异表](round-pet-hub-baseline-alignment.md)。

2026-11-02 [G0-R7 gate失联/暂停一致性](../reports/2026-11-02-round-pet-g0-r7.md)已补显式新wire executor的单个本地提交任务：失联/lease/暂停清旧权威但保留gate完成能力，新会话等实际同步commit退出后查新库存；旧saved/playing拒绝、unknown不重复写、close不提前释放medium。30专项、check及全套940/940通过，监督正常/取消清理通过。A1核心、R3修订2/80正62反、session/guard与宿主R4/R5不改，旧executor缺省保留；R6完整下载/校验/独立首帧/保存/淘汰/重连保持。等待4000ms仅诊断，不放槽/延TTL。原缺口已[归档](history/round-pet-g0-r7-evolution.md)。这是同步内存Flash模型，ESP异步RTOS/物理掉电/休眠及硬时限仍未验；下一优先共同G0契约/真实素材许可/固件G1/G2证据核定，再另审真实窗口，默认OFF/无设备或生产入口不变。

2026-10-30 G0-R1身份基线（历史回归数对应其报告）：[只读契约/真实素材复核](../reports/2026-10-30-round-pet-g0-reconciliation.md)完成本轮范围，先补Spec/Diff，无生产代码更改。check（仅.mjs语法）和含构建test746/746通过（含并行素材切片）；独立46 PET4/11086帧全F/CRC/index及46源视频SHA/固定86181ce git blob均匹配，9项摘要/格式/缺批准负例通过。P=3afe4578…、M=9045bd6b…、N=dfc829e1…、源SHA=a6a2ddae…分域确认，详见[复核向量](../protocol/vectors/round-pet-g0-real360-review-v1.json)。license_ref仍upstream-reference-only，**未创建独立approval、未真实A2导入或生产批准**；原始形象声明本次直读失败，许可链/用途/分发范围待补证。
```

## 原 docs/context/current-todos.md

```text
1. **共同G0契约收口与真实素材/资源准入核定**：R7[同步模型gate恢复/30专项](../reports/2026-11-02-round-pet-g0-r7.md)已验证失联/lease/暂停、迟到回执及新会话竞争，不再以R6缺引用状态为当前缺口；R4–R6下载/校验/首帧/保存/淘汰保持。下一先Spec/Diff，只读核对固件最新回复/实现/报告，更新C01–C12差异与共同决定：gate前已授权的一次本地完成及凭据撤销/不可取消写边界、同步与异步退出/硬上界、新库存恢复、GET关联及R3修订2/80正62反是否被固件采纳。不给模型token新增wire字段，不从本仓库通过推导签核或设备准入。真实360/46身份已核，原始形象声明直读、用途/署名传播范围与独立offline-validation approval仍缺，批准后另审真实A2全库导入/重开。固件G1/G2证据/现状与回退需重新冻结；未满足前仍NO_GO，不连接/恢复设备现场或改现有服务。若继续异步设备模型，必须另Spec/Diff验证真实任务退出与等待边界，不延TTL或强清gate。
2. **实体资源与执行门槛**：管理端默认OFF宿主候选已交付；联合G0/固件适配交付后，仍需单独设备窗口授权与具体恢复步骤，不自动启用真实listener。最新A/B中断现场不由本任务恢复；固件G1完整维护、G2 TLS峰值／可信时间／凭据持久化与撤销、通信栈／取消上界须有证据；PSRAM6916777B含read-ahead，保留内部48KiB等门槛，旧预算JSON需后续独立更新才可引用。helper签名／秘密、设备窗口与前瞻／a7恢复分别审查，不自动启动／接设备。
3. **分层角色包宿主接入设计**：L1–L3当前桌面工具及[高分屏显示/放大检查](../reports/2026-10-30-character-hidpi.md)已完成，见[L3宿主验收](../reports/2026-10-30-layered-character-l3.md)。下一先写Spec/Diff，确定日常角色管理/独立窗口的入口、新包类型、PET4与分层的单一画面所有权、异步资源交接/回退及持久确认；不重复包导出/独立加载或同后端等效原型。跨浏览器/设备、长期资源仍待验；360/46动作/11发束保持，真实音频继续延后真机。
```

## 原 THIRD_PARTY.md

```text
许可依据仍为[固定README](https://github.com/PC2005-cloud/dsh-pet/blob/86181ce1660a57ab27336630bab5b344de71b28c/README.md#许可)对素材非商业/公开衍生标源及形象CC BY-NC-SA的声明，署名上善无形/ZipZipPipe/PC2005-cloud/dsh-pet。原始B站声明及CC官方条款页本次工具503未直接读到，不能声称独立取得原作者声明/新法律授权。license_ref=upstream-reference-only不升级为批准；无A2真实库approval或分发，具体用途/传播范围/原文证据待补，修改许可引用须重算M/P重新审阅。详见[报告](docs/reports/2026-10-30-round-pet-g0-reconciliation.md)。
```

## 原 docs/protocol/round-pet-gated-recovery.md 下一入口

```text
下一优先共同G0交接与资源/素材批准缺口核定，形成可交固件的精确决策/待确认项；单方宿主通过不放行真机。若继续扩异步设备模型，须另Spec/Diff证明实际任务退出和有界等待，不能沿同步样本推导硬时限。回退仅撤回新wire提交任务/fixture，关闭自有资源并等待已授权工作退出；无格式/namespace/TTL/外部配置迁移。

```

## 原 docs/protocol/round-pet-wire-execution.md 下一入口

```text
30专项及通过/未覆盖见报告；新增闭环不代固件协议互操作或物理资源准入。R7同步gate失联/暂停已另验，下一优先共同G0/资源许可证据核定，保留原有门禁而不扩TTL；共同G0/GET合同、真实许可、固件G1/G2与设备窗口并行待验。回退关闭自有lab并等实际I/O退出，撤回executor显式模式/fixture及loading/EMPTY窄修正，无格式或期限迁移。

```

## 原 docs/protocol/round-pet-wire-get.md 下一入口

```text
R6已接同一A1 actor经新wire GET的[执行闭环](round-pet-wire-execution.md)，继续复用actor/A8；R7已补同步gate失联收尾，下一共同G0/资源证据核定先Spec/Diff，保持离线边界。真实来源与设备验收另审。
```

## 原 docs/context/plans/round-pet-single-device-spec.md 末尾入口

```text
[最新基线](../native360-baseline.md)引用A/B中断cbdf临时驻留未恢复67，旧67仅性能基线/恢复目标；不由本任务恢复现场。R2离线执行边界已完成，R3 wire提案/宿主字节对照已交付，R4临时hello/exchange/schema2 adapter已完成，R5临时GET已完成，R6已补actor对照，R7已补同步gate收尾，下一固件评审/资源与许可核定，均先Spec/Diff；不改变A1–A10或固件实现。本轮[报告](../../reports/2026-10-30-round-pet-g0-reconciliation.md)/[Diff](round-pet-g0-reconciliation-diff.md)另记。

2026-11-02 R3：管理端[正式wire提案](../../protocol/round-pet-wire-v1.md)与78正/62反Node/C++宿主向量已交付，R3当时旧候选/设备未适配、联合G0未关闭；后续R4已接临时宿主adapter，不启真实通道。
```
