# G0-R3 wire 提案演进

2026-11-02。以下为R3前的管理端快照。R3补闭合契约/错误表/Node与C++宿主向量，替代尚无正式wire表达的当前状态；不替代R2执行/来源/许可、固件签核/资源或设备准入限制。最新[报告](../../reports/2026-11-02-round-pet-g0-r3.md)、[契约](../../protocol/round-pet-wire-v1.md)。旧相对链接仅按历史语境。

## 原 docs/context/plans/round-pet-g0-handoff.md

```text
# 给固件任务：G0 契约决定／待确认项

2026-10-30 G0-R2刷新；外部事实仍限定G0-R1只读快照，本轮未新读固件/设备。管理端已只读复核固件[回复](/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio/docs/protocol/round-pet-native360-g0-reply.md)及[输入向量](/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio/docs/protocol/vectors/round-pet-native360-g0-inputs.json)，并独立重验真实360/46库。[管理端报告](../../reports/2026-10-30-round-pet-g0-reconciliation.md)、[基线差异表](../round-pet-hub-baseline-alignment.md)、[无批准的身份复核向量](../../protocol/vectors/round-pet-g0-real360-review-v1.json)为本轮证据。旧交接全篇已[归档](../history/round-pet-g0-reconciliation-evolution.md)。本文是可交付文档，**未发送消息、不是共同签核/新wire实现或设备操作授权**；固件仓库未修改。

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
| C04 状态/恢复 | **证据语义一致**：accepted/verified/playing、display actual、storage saved及当前inventory独立；saved仅marker后元数据读回确认，命中已存不伪造新提交；淘汰同根更新available | 管理端R2逻辑gate/unknown恢复已验证；设备新wire/提交阶段结果钩子待实现。marker可能写入或确认失败→outcome_unknown/阻止新写；当前bool恢复把I/O失败与坏根折叠，不能直接把recover=true当未知已消除。低root/同seq冲突不降hub floor |
| C05 手动/触摸 | **管理端选择固件保守首窗口方案**：仅远端base0/11，physical4单次且本地优先；remote4暂禁，UI“触摸专用”。本地首帧token ACK起241/24秒，重复触摸新token；到期回最新有效base，否则idle0 | G0-R2已实现显式first-window-review/1的入队/派发cached0/11门禁与内部manualChoices，默认通用46候选保持；local/token/到期用纯模型对照，**真实UI/物理触摸和设备适配仍未实现**。其他动作随G4另扩；不改变旧v5/PC角色策略 |
| C06 首帧/维护 | **设计一致**：playing来自刷新提交及完整command/context/generation；local事件只更新actual，不回发4。loading/verifying/saving冻结最后有效画面，wall time不当动画elapsed | 现render在lv_refr_now路径后记presented_*，局部记录不是完整新身份，非面板扫描结束证明。同像素/同帧、旧token、维护恢复及独立display_seq需共同向量/钩子 |
| C07 wire/兼容 | **方向一致、字段未冻结**：主动POST exchange、响应≤1 control、下一HTTP回传、显式版本/独立uint64流，旧端不协商拒绝 | hub候选profile=round-pet-pull-candidate/1、路径/offline-round-pet/v1；固件规划/hub提案另指正式/hub-device/v1，不能换名直连。heartbeat/request_seq、mode/descriptor、deferred_local、touch/cancel record、错误/HTTP映射与retry表仍缺共同决定和Node/C++字节golden |
| C08 取消/写预算 | **接受双边界设计**：取消准入gate与持久marker分开；gate前已观测取消不进入提交，gate后取消不承诺撤销保存，只禁止旧目标激活。marker/读回未知不得报未保存 | 管理端R2已补逻辑gate/取消后保存及恢复I/O/floor对照；固件persist仍只在commit前查取消，commit内部无回调，真实gate原子性/错误阶段钩子待实现。12次是启动内易失固定窗（首尝试起一小时），非滑动/跨重启硬限额；普通60秒，load完成约5秒且已呈现/非local才判断；installation仅维护、失败也占预算。G1实测与不可抢占上界仍缺 |
| C09 调度/期限 | **结构一致**：单在途control、单未派发latest、单待段，renew/cancel/revoke有界旗标，段后先exchange，不用8 FIFO | RTOS owner/让出/退出硬上界待实现实测。包括commit残余、全验/擦写与host磁盘成本；500ms poll/1s段仅假设。缺上界NO_GO，不延lease/放宽deadline掩盖排队 |
| C10 身份/认证 | **方向一致**：单TLS/HTTP owner，TLS1.2/P256仅探针候选，认证失败不降级IP/Bearer/明文 | 正式可信时间、密钥/证书/epoch持久提交、撤销/重绑定/丢钥恢复还缺可审查Spec与资源预算。RAM凭据探针不是配对，G2前不能开真实通道 |
| C11 资源/G1/G2 | **口径一致**：P3显式PSRAM6916777含64KiB read-ahead；保留内部≥48KiB、PSRAM≥1MiB/块≥512KiB、main栈≥1KiB及2MiB应用余量目标 | 最新G1并未通过全维护：fc55低水位门禁停止，后续A/B中断只覆盖A准入/待机，未缓存切换/点击，B未测。TLS峰值/最大内部块/新栈/清理未知；P3和loopback均不能放行 |
| C12 控制源/回退 | **设计一致**：启动网络owner前选择旧v5或新hub，断线不自动切源，不停整个pet/bridge；新session新hello/库存/控制，不重放旧命令 | 选择形式/持久策略/核验机制未实现；A5仅宿主OFF恢复。中断现场恢复需另获设备窗口授权，app/配置内容/凭据epoch/缓存分别恢复核对，不擅自触碰NVS/服务或整片恢复 |

## 下一次可独立验证的小切片

G0-R2已完成[35项离线对照](../../reports/2026-10-30-round-pet-g0-r2.md)：显式首窗口入队/派发门禁、profile固定/选主隔离、local/latest寿命、取消gate、marker未知与I/O/floor恢复；仅原创媒体/临时环境，无生产通道。旧R1未实现状态已[归档](../history/round-pet-g0-r2-evolution.md)，不重做该切片。
1. **离线G0-R3：完整wire定版**。以C07字段差异清单选择一个正式profile/版本、端点和闭合schema，明确错误/HTTP/retry、报告/取消/touch、metadata descriptor及最大报文；管理端先产无秘密正反字节golden，交给固件任务独立C++实现对照。固件输入数学向量不是wire向量，管理端不能代其签核。
2. **真实素材独立批准**。本轮身份已固定，下一补原始许可链/用途/署名与分发范围记录，再选择是否建立**仅offline-validation**的A2批准并测试真实完整库导入/重开。approval由独立审阅输入提供，不把本复核JSON/哈希自封为批准；任何生产/商业分发另审。
3. **等待固件资源证据**。G1维护、G2时间/凭据/单owner/TLS/有限清理通过后，才准备G3真实缓存0/11+physical4方案/具体回退和单独窗口。G4再未缓存下载、校验、首帧、保存、淘汰、断连/重连。400/跨角色/多设备/BLE/OTA/音频不合并。

## 联合关闭与回退

联合G0仍**未关闭**：C02用途批准、C07完整wire与双端向量，以及C04/C08/C09/C10/C12具体边界/身份设计还缺交付。G1/G2是独立执行门禁，不能以设计一致替代实测。管理端不改固件回复中的旧hub快照，由固件任务下次读取本交付自行刷新；本轮没有发送消息。

本轮无外部运行变化；撤回显式profile/局部门禁或关闭自有临时owner即可，无数据格式/TTL迁移或应用/配置/NVS/缓存恢复操作。未来实物操作前以最新矩阵+独立读回冻结现场、保护67/a7与窗口前完整备份；仅恢复app不等于恢复配置/绑定/缓存。当前临时端点/服务属于另一窗口，本轮不启动、停止或清理它们。

管理端R2[API](../../protocol/round-pet-g0-r2.md)明确：cachedHitInventoryOnly仅本地模拟结果，不是新的storage ACK；取消/命中如何关联pending继续由C07/R3定版。本轮gate并非固件RTOS锁或Flash字节实现，不豁免G1/G2、许可批准及设备窗口。
```

## 原 docs/protocol/round-pet-single-device-v1.md

```text
# round-pet 原生360单设备契约提案 v1

2026-10-30。**G0-R1已对齐部分设计，联合G0未关闭，wire未定版／未开放；A1–A10宿主候选已另行实现，均不是生产wire。** 不代表现行v5或当前hub已接受这些字段。责任／停止项见[交接清单](../context/plans/round-pet-g0-handoff.md)，源码与状态见[对齐表](../context/round-pet-hub-baseline-alignment.md)。基础hub-device/1、能力schema2、角色package_schema=2、PET4 codec flag1、旧固件HTTP v5及本提案版本是不同版本轴。

## 1. 固定能力与执行语义

能力schema2沿用现有字段，候选核心值为：display={width:466,height:466,shape:circle,pixel_format:RGB565}；presentation_modes=[center]；codecs=[PET4]；cache={playback_bytes:5865472,persistent:{active_slots:4,staging_slots:1,slot_bytes:5865472}}；max_asset_bytes=5865472；max_downloads=1；inputs=[touch]、outputs=[display]。protocols包含hub-device/1，firmware_version/board_profile使用严格标识，不把报告前缀当完整部署身份。

playback_bytes是**单份encoded RAM容量**，不含三RGB缓冲、解码history/tile或系统/TLS；绝不能表示4份RAM素材。Flash slot_bytes是payload上限；实际stride=0x599000，含4KiB对象头，双root另占8KiB，5对象共需29356032B，28MiB分区29360128B不变。4活跃引用不等于4个固定ID；保护动作0/4，现有1/11可替换；Flash stream read lease额外保护物理对象及generation。模型必须区分working、staging、committed root refs和retired对象。

媒体白名单固定360×360/24fps/241帧、PET4 codec flag1、key interval12、tile rows20，center偏移53，不缩放／裁切；完整46原编号动作，无重复、缺失／重编号。通用parser可接1–360帧不代表生产入口支持其他帧数。当前能力schema2没有这些媒体限制和维护模式字段，拟在受限extensions.round_pet中声明profile及版本；新执行层同时校验，不能只靠扩展声明。

上述资源规则已在[A1独立core模型](round-pet-a1.md)验证，尚未装配生产路径。RAM被替换不会自动删除Flash；reboot清RAM／lease／会话，Flash只从有效root恢复，不清成空数组。暂存对象、已写对象头但未被有效root引用的对象均不可离线播放。load／persist可能冻结，不能模拟“旧encoded被覆盖而旧动画仍继续”。

## 2. F／M／P／N与导入recipe

| 符号 | 范围／recipe | 用途和禁止项 |
| --- | --- | --- |
| F | SHA256(完整原始.pet字节) | action.asset_sha256／长度／V2对象SHA，逐帧CRC另外验证 |
| P | pet-package-v1-canonical-json：SHA256(C(package.content)) | 固件工具导出包身份；catalog.json.sha256也是P，不是M |
| M | hub-round-pet-catalog/1：SHA256(C(package.content.catalog)) | 生成hub最小manifest（不带sha256再算M）；等于现有manifestDigest对该精确manifest的结果 |
| N | SHA256(UTF8("round-pet/whale/native360/pet4/tile20/key12/v1")) | 既有V2 namespace，固定为dfc829e13e7c25d732ae0c0afd011f1232419e603ba06c225104645ea668bdf6；不得用F/M/P替换 |
| I | SHA256(实际index.json原始字节) | 仅本地导入快照／仓库版本，空白改变I，不等于manifest或包身份 |

C规则：UTF8、无BOM／尾随LF、递归对象键升序、无多余空白，数组保序；固定字段名ASCII，整数限安全范围，拒绝重复key、未知字段、NaN／浮点、无效Unicode和孤立surrogate，不做Unicode NFC或额外trim。Python导出ensure_ascii=False/排序紧凑JSON与本仓库manifestDigest在这个受限域一致；不能扩展成任意JSON都跨语言一致。输入catalog.actions和timing均要求ID严格升序；不能先排序导出content再验证旧P。

逐字段映射：catalog的character_id/variant_id/codec/display/license_ref/actions(id,bytes,sha256)原值生成hub manifest输入；sha256字段只在生成后填M。content.timing按ID一一匹配，核对width/height=360、fps=24、frames=241和index_sha256；media_profile必须PET4/flag1/key12/tile20/fps24，现有frame_limit=360是通用上限而非允许生产变帧。content.semantics核对现有8项0/4/1/11/43/58/7/55，source_manifest_sha256核对所选源文件原始字节。完整P覆盖timing/semantics/source，M不覆盖它们，故必须同时保留P而不是只凭M批准生产规格。

本闭环**不套用现有PC完整角色包的once_hold/once_idle测试策略**。MVP取最小manifest，不新增package_schema/semantics/loop到M；这些仍在P／profile provenance里。G0-R1管理端选择固件保守首窗口方案：远端仅0/11作为最新base循环，physical4单次并回最新有效base，remote4暂禁且UI标触摸专用。G0-R2已实现A5显式first-window-review/1的入队/派发门禁与内部选项投影；默认通用候选仍接受46目录，真实UI/设备适配仍未实现，不可直接启用。其他动作待后续范围/向量确认；旧PC角色包/预览/现行v5保持。

新round-pet导入适配应：先审核来源／许可和外部包P／源SHA→严格验证P及catalog一致→流式核对全部46文件F、长度、241帧CRC和时序→生成上述manifest、files:{action_id,path}和I→发布至既有CAS→单独持久记录profile、N、P、M、源SHA、recipe与许可批准。不得把未知来源自行算哈希当可信，不运行固件导入器，不复制原素材到Git；license_ref只引用批准，不能自行授予许可。provenance已在[A2专用API](round-pet-a2.md)独立有界发布，现有index根仍为闭合schema；真实包/许可共同批准及跨端互操作尚未完成。

设备root不存M/P，G0不改V2格式。会话内由已认证controller批准(P,M,N)及单动作descriptor，实际root对象必须匹配(N,action_id,F,bytes,object generation)。重启后以当前root清单重新映射到当前已批准M/P，不能按N相同就声称所有包相同。G0-R1已独立核定实际46动作的P、源SHA、ID及全F/CRC/index，完整值见[复核向量](vectors/round-pet-g0-real360-review-v1.json)；license_ref仍upstream-reference-only，无独立approval/真实A2导入或生产批准。

固定[recipe向量](vectors/round-pet-g0-identity-v1.json)包含UTF8文本、生成字节规则、完整content／manifest、正反期望SHA；只有2个假文件，故必须被生产PET4／46动作准入拒绝。它验证散列与映射，不验证媒体／真实库或已有跨端互操作。

## 3. 显式版本／端点与兼容

提议子profile=`round-pet-native360/1`，在hello capability.extensions.round_pet通告contract_version=1及playback/storage/inventory/maintenance各版本1、媒体profile/N。hub在challenge.extensions.round_pet选择版本，confirm原样回显，ready确认；这些额外字段当前hello闭合校验不支持，须在新profile明确实现，不能放宽所有旧hello。无版本／不支持storage等必需能力时，只允许诊断展示，拒绝新profile控制／保存，缺字段显示unknown而非false或推测成功。

继续使用单origin的POST /hub-device/v1/hello、POST /hub-device/v1/exchange，及经授权manifest／asset GET；它们是新通道，不等于/v5/*或电脑UDS。exchange外层拟为{protocol,profile,schema_version:1,type,request_id,context,payload}，strict字段、canonical JSON，总控制body≤4096B；type区分exchange.request/response和有界单个控制/观测记录。完整context沿用7字段device/binding/epoch/boot/session/controller/service_instance；有控制作用的记录另有control_epoch/lease_id、command_id、command revision及(P,M,N,action_id,F)。字段位置、错误码和逐字节样本列为C07，**联合定版前不得发到设备**。

基础phase只用于accepted/downloading/verified/playing/failed/cancelled/ended。新增saved不塞入这个枚举；采用storage.report schema1，另有inventory.snapshot schema1、display.report schema1。旧Registry.report闭合字段仍拒绝它们，新适配验证后交独立reducer。已有native360-v5-lease/1只编码候选管理租约，不是固件旧HTTP v5；提议作为严格子记录复用其uint64/context/相对lease_ms语义，不能把现行played或Bearer转换成可信lease proof。

待C07冻结的字段草案如下；record各自有schema_version=1/type，不因放在payload就允许未知字段。此表定义实现方向，下一切片仍需完整JSON Schema／字节golden，当前生产wire不接受这些record；[A3离线候选](round-pet-a3.md)只实现选定对象语义/查询规则，不是已协商的本表wire解析器。

| record／方向 | 拟定必要字段及约束 |
| --- | --- |
| exchange.request 设备→hub | payload={heartbeat_seq,observation:null或1条record}；外层request_id是本次设备HTTP关联，非lease.request_id。有效新heartbeat_seq才刷新活性 |
| exchange.response hub→设备 | payload={control:null或1条record,poll_after_ms}；echo当前request_id/context。续租／取消／回执待回传时poll_after_ms=0，普通值不得超过已验证poll预算 |
| lease.acquire／renew hub→设备 | lease.request_id/request_seq、expected_epoch或lease_id、提议lease_ms；设备持久acquire成功后回传严格native360-v5-lease/1 lease.granted。renew不逐次写NVS |
| playback.set hub→设备 | control、target（原7个目标字段）、package_ref={namespace,firmware_package_sha256,hub_manifest_sha256}、asset_descriptor={bytes,width,height,fps,frames,codec_flag,key_interval,tile_rows}、mode=base_loop；F取target.asset_sha256，不另造未核对的F别名 |
| playback.report 设备→hub | target/control/package_ref、report_seq、phase、elapsed_ms；playing还带refresh_generation/first_frame_seq。requested/sent只留hub本地，不作设备phase |
| display.report 设备→hub | display_seq、kind=event或snapshot、origin=remote或local、asset_ref={N,id,F,bytes}、source_command（remote完整身份或null）、refresh_generation/frame_seq、elapsed_ms、maintenance；snapshot与查询request_id关联，不给历史命令补成功 |
| storage.report 设备→hub | storage_seq、operation_id、source_target/package_ref、status=saved/deferred/failed/outcome_unknown；saved必须有root_seq/object_generation及持久commit证据类型；不靠phase排序驱动actual |
| inventory.snapshot 设备→hub | inventory_seq、query_id、root_seq、namespace、root_state、active≤4项(id,F,bytes,object_generation)；完整同一根快照，不把丢包／部分列表当淘汰，失效根标unknown |
| touch.event 设备→hub | event_seq/event_id、local token、phase、base revision引用；只观测、不回发新playback.set(4)。local token仍须关联当前设备绘制generation |

资产ref中的N/id/F是本表简写，wire实际键统一namespace/action_id/asset_sha256。所有uint64串不得转JS Number；elapsed等有界时间是各自本地单调相对量，不能比较绝对主机／设备时刻。root或commit结果未知时不发送status=saved。

错误方案：保留基础unsupported_protocol/invalid_message/stale_binding/stale_session/stale_control/lease_expired/incompatible_asset/idempotency_conflict/stale_revision/storage_failed/cache_busy；新profile增加unsupported_profile、unsupported_feature、maintenance_busy、storage_deferred、storage_outcome_unknown、deadline_exceeded、queue_full。新错误只在显式协商后使用，旧端不自动翻译成成功；HTTP只是承载状态，业务错误record必须匹配本请求／context，不能返回带原始配置／证书／URL的cause。具体HTTP映射及可重试清单须C07共同确认。

库存最大4活跃条目可放4KiB响应；46项manifest不能盲塞控制body。提议manifest≤8动作/页且每页≤4096B，以(M,P,页号/总页、单调游标)绑定，hub在发布前完整验M/P；设备页间固定检查已协商(M,P,N)，只接收当前授权资产descriptor，不让设备自选URL。HTTP头另限8KiB（须G2内存确认），Range≤32768B／写块4096B，拒绝redirect/压缩/chunked/多Range/错ETag，文件最终SHA和全帧CRC独立验。分页不能改变原M的actions数组顺序。首闭环提议由hub验证完整P/M，ESP只持有会话批准的三元组和单资产descriptor、校验真实F/PET4；不额外申请全46条元数据缓冲来重算P。若固件要求端侧完整重算，须先关闭C03并给出G2内存预算，不可在分页实现时偷加工作集。

## 4. 状态、证据与独立序列

| 状态 | 权威证据／投影 | 禁止推导 |
| --- | --- | --- |
| desired | hub当前已接受用户意图／revision，设备accepted可另记 | 不等于已发送、已播或已存；本地queued/sent不是设备accepted |
| accepted | 设备校验身份／租约／完整目标并接纳该command的认证报告，可标deferred_local | Registry.expect或HTTP200不能代替；需先修现有expect的本地accepted投影 |
| verified | 新文件完整F/长度／生产PET4/全241帧CRC；命中沿用有效root/validator版本/同F证据链＋运行CRC | 未验证缓存、下载结束或PC解码不行；已验证命中无需每次重新全库CRC |
| playing | 当前command／generation首帧在刷新路径提交后，携带首帧序列／elapsed和完整目标 | 不能用load、decoder ready、HTTP完成代替；不宣称面板扫描结束 |
| actual | 最近有效display报告的真实画面身份和origin(remote/local)、is_current/freshness | 本地4不能伪装成远端base已播；断连保留历史但标非当前／未知 |
| saved | storage.report的operation_id、原目标身份、N/F、root_seq/object_generation及持久commit成功 | 请求保存、日志、对象头已写或RAM verified不能代替；晚saved不提升playing |
| offline_available | 最新可信有效root inventory确实引用同(N,id,F)，含root_seq／库存快照序列 | saved历史事实不是永真库存；淘汰后false，断连库存当前性unknown／最后确认 |

playback target与存储操作是两条状态轴，不能规定saved必跟在playing后：一般新动作先首帧再后台保存，已有缓存点击可以早就saved。saved不可作为任意目标的可重放成功标记。保存失败／延后是RAM_ONLY/save_deferred/storage_failed，不得把播放成功降成未播或将RAM状态升成离线可用。

新流分别用report_seq(playback)、display_seq、storage_seq、inventory_seq、touch event_seq，均为当前boot/session范围的uint64十进制字符串；root_seq/object_generation来自Store持久uint64，不能拿root_seq当远端command revision。所有流验证当前binding/credential/boot/session；远端播放阶段还需当前command/control epoch/lease，低序列／旧session不推进任何当前投影。lease失效后允许新认证会话只读查询actual/inventory事实，不允许因此恢复控制权。新session重置瞬态流，但不把旧root序列自动视作当前库存，先查快照。

终态不能被迟到playing复活。被新目标替代的saved仅可记历史；权威当前inventory按新快照决定是否可用。旧session的save报告丢弃后，用新session库存查询补事实，不能特许绕过认证。有效root提交原子替换4条清单；一次替换使新对象available、victim unavailable，同次UI投影更新；旧Flash read lease存活也不意味着对象仍是当前离线库存。完整context、目标、stream序列、operation_id都参与幂等检查。display.report须区分event与新会话查询snapshot：后者可报告仍在播放的历史来源动作，但只更新实际画面，不补发旧command的playing成功；source_command身份保留为历史，controlled仍须新acquire。

## 5. 本地触摸、维护与时间

设备本地挥手权威，physical touch只作为观测回传，hub不再调用模拟scheduler.touch给它一次冷却或回发远端动作4。设备继续既有token/P1取消/P2寿命：241/24秒，自首帧软件提交起计；重复点击沿用固件当前重启本地动作规则，不由hub合并。remote只更新latest base；本地结束后核对当前base revision／session／lease，过期则回受保护idle0，不回旧base。

本地期间新base可accepted/deferred_local，准备和写Flash推迟到本地结束，避免抢Flash stream lease或freeze挥手；latest base替代旧base只取消旧远端准备，不取消当前本地动作。G0-R1首窗口remote4暂禁、physical4保持本地单次；未来若开放远端4，另定mode/origin/返回base与寿命向量。首次仅手动，不接DSH自动来源。

maintenance单独表示none/loading/verifying/saving/recovering/blocked，并带generation、reason及display_state=held_last_valid/playing/unknown。UI明确“维护中，保留最后有效画面；当前动画已暂停”，冻结期间不累加动画elapsed或伪造帧率；设备／维护wall时间另列。没有freeze确认不能仅据下载请求就标held，保守显示等待设备状态。Flash stream挥手与persist冲突必须延后／拒绝，不复制第二工作集来绕过lease。

取消准入gate与持久marker分开：gate前已被观测的取消不进入commit；gate后取消只阻止旧目标激活，不保证撤销持久结果。现有persist只在commit调用前检查，commit内部无取消回调，不能承诺直到marker前发生点击都可撤销；gate与目标更新的同步/结果钩子待实现。save_root写marker后读回，marker写失败或之后确认失败都可能outcome_unknown；库存当前性unknown、停止新写/盲重试，唯一Store owner重新读验预期根/对象后再定事实。当前recover把候选I/O失败与确证无效折叠bool，recover=true不自动消除未知；低根不降低hub floor，不改V2格式。

写预算为启动内易失固定窗口，自首尝试起一小时最多12次获准尝试（非滑动窗/跨重启限额），普通间隔60秒；load完成约5秒且已首帧/非local才判断保存，不是首帧后严格5秒。installation仅显式维护可绕60秒、失败也占12次；G1实测/不可抢占上界仍缺，不能每次点击强制安装。

## 6. 单连接拉取、排队与失败关闭

新设备通信任务唯一拥有一个HTTPS handle；同一时刻一个TLS、一个HTTP，接收控制/回传报告/取manifest/Range串行。旧v5控制任务与worker整文件下载可能有独立handle，当前并不满足此约束；切换必须显式选择控制源，不能双跑旧v5和新hub，不改旧bridge配置来模拟互斥。

设备主动exchange→hub响应至多一个control；设备执行后用下一exchange回传回执。控制派发与回执至少跨两个HTTP周期；旧loopback直接POST grant不覆盖它，[A4独立候选](round-pet-a4.md)已覆盖Node peer主动pull，仍不是共同定版wire/ESP证据。lease请求的host sent_at在实际派发前登记，非UI入队时间；控制回执／续租紧接下一exchange，不等普通poll间隔。发送时重新核对完整身份、当前revision和guard截止。

首闭环提议：hub只保留1个尚未派发latest base、1个在途control、1个待Range；renew/revoke/cancel各最多1个有界控制旗标；同一操作可去重，第二个不同的未确认有副作用操作明确queue_full，不能覆盖，FIFO中已派发有副作用操作不得合并／盲重试，latest替换在审计上将旧queued目标cancelled。设备每个段后先exchange处理控制；续租/紧急取消优先，普通base次之，素材最后。**不复用离线lane的8项控制队列为生产默认**；若需更多非幂等排队，重新证明预算。

每次派发Range前计算剩余可用窗口：必须覆盖当前不可抢占残余、最坏下一次exchange／设备处理、控制等待、guard安全余量及实际I/O退出上界；不足则不开始新段，先续租或停止。普通poll提议≤500ms、段≤1000ms、控制body≤4KiB只是待验证候选；同步全帧验证、Flash擦写/提交和OS调度也要给有界让出与通讯时机，不能漏算“网络以外的忙”。新下载／保存可能10秒以上，不把整个动作期限塞进一次控制RTT，也不能让维护阻塞续租。

预算仍用实际B=queue＋不可抢占工作＋poll＋网络/有限重试＋device校验，另算host RTT和双端漂移。历史B1900/RTT3802/T13074仅假设；8项深队列反例B9900/RTT19810/T5070仍不可用。不能延TTL掩盖未知排队。未定绝对上界时NO_GO；设备G2须证明接受校验、维护让出和cleanup界限，再固定数值，不以P3或loopback max定标。

取消／超时使generation任务失效并停止准入，主动终止handle，**实际I/O退出前不得释放槽或另开连接**；Flash commit已开始的副作用未知时，不报未保存或自动重试，重连后查root。只在同当前session且幂等的Range/查询可有限重试，任何新请求在剩余截止内；认证失败不降级旧v5/明文。重连候选退避1/2/4/8/16/30秒＋抖动，仅在自有旧连接清理后开始；新TLS/hello/能力协商/acquire和库存／actual查询，再按用户当前意图生成新命令。旧command/队列/lease不盲重放，服务重启的手动预览需重新确认。

## 7. 准入和版本冻结

G0联合关闭要求C01–C08及身份/资源设计C09–C10有共同决定和字节级正反向量；G0-R1已对照固件回复并完成真实媒体/来源身份核对；C07仍缺共同字段/错误与Node/C++字节向量，不宣称新wire已互操作。G1是现行维护验证，G2包括TLS峰值/最大内部连续块、可信时间、凭据持久化/撤销恢复和有界I/O；临时RAM凭证探针不等于正式绑定。G3/G4还需用户独立设备窗口授权、固件新适配及管理端装配交付。保留内部≥48KiB门槛，不用旧32KiB设计余量覆盖。

始终保持现有V2 namespace／格式、前瞻／a7回退和新通道默认OFF；任何身份／根／资源不一致停止写入，不自动格式化、迁移分区或重置凭据。后续扩展协议只能显式协商新版本；旧客户端看到未支持的saved/库存／维护不能猜测成功。

## G0-R1实现差距（2026-10-30）

[最新交接](../context/plans/round-pet-g0-handoff.md)替代旧C05/取消边界与真实摘要未知状态。A4候选仍是round-pet-pull-candidate/1和/offline-round-pet/v1；其playback.set只有target/control/package_ref，没有本提案mode/asset_descriptor，playback.report没有deferred_local字段，touch不是独立record，exchange以request_seq表达请求顺序而非上述payload heartbeat。storage取消只有通用ack/播放cancelled，尚缺commit结果独立表达。不要把上述提案或固件输入表直接POST到任何设备。G0-R2已完成[执行边界离线对照](round-pet-g0-r2.md)，下一G0-R3字段/错误/最大报文与双端golden，先Spec/Diff；不改现有候选schema来假装兼容。
```

## 原当前契约摘要

```text
[C01–C12交接](plans/round-pet-g0-handoff.md)已由G0-R2更新执行边界：A5内部显式first-window-review/1在入队/派发限制cached0/11，remote4及其他拒绝、保存禁用，profile固定并进入选主身份，内部manualChoices投影供未来UI。local4首ACK计时/latest/会话失效用有界core模型对照；A1显式gate后取消可继续saved但不能重活旧播放，recoverStorage只出完整库存，I/O未知不降级/不补saved，root floor保持。真实UI/触摸源、固件gate同步/结果分类和正式wire仍未实现，通用候选缺省仍46且生产通道OFF。capability_values缺完整hello封套；codec无mode/descriptor/deferred_local/touch等提案字段，不能换名直连，联合G0未关闭。下一G0-R3字段/错误/Node-C++golden及用途批准；G1/G2/窗口独立。R1原未实现摘要已[归档](history/round-pet-g0-r2-evolution.md)。
```

## 原下一入口（仅wire交付部分已替代，批准仍未完成）

```text
1. **G0-R3共同wire与用途批准**：G0-R2显式首窗口/逻辑gate及恢复[35专项](../reports/2026-10-30-round-pet-g0-r2.md)已交付，不重做；按[交接](plans/round-pet-g0-handoff.md)先Spec/Diff冻结正式profile/端点、能力扩展/字段、mode/descriptor、deferred_local/touch/取消、错误/HTTP/retry及4KiB最大报文，交付Node/C++正反字节golden；候选字段不能直接改名上线。首窗口manualChoices已供内部消费，但正式管理UI/设备触摸接线及cache-hit/取消的wire关联仍待实现。真实360/46的P/M/N/F/源/原ID已核，原始形象声明直读/用途/署名传播范围与独立offline-validation approval仍缺；批准后另审真实A2全库导入/重开，不把复核JSON当批准。
```
