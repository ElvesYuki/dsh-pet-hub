# round-pet 原生360单设备契约提案 v1

2026-11-02 R3更新。**管理端wire提案/宿主向量已交付，双方未共同签核、生产通道未开放；A1–A10宿主候选已另行实现，均不是生产wire。** 不代表现行v5或当前hub已接受这些字段。责任／停止项见[交接清单](../context/plans/round-pet-g0-handoff.md)，源码与状态见[对齐表](../context/round-pet-hub-baseline-alignment.md)。基础hub-device/1、能力schema2、角色package_schema=2、PET4 codec flag1、旧固件HTTP v5及本提案版本是不同版本轴。

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

## 3. 正式wire提案与旧候选兼容

2026-11-02 G0-R3已冻结管理端[round-pet-native360-wire/1提案](round-pet-wire-v1.md)、[闭合表](../../packages/core/round-pet-wire-contract.json)及[字节向量（R4修订2为80正/62反）](vectors/round-pet-wire-v1.json)。**正式表达已交付，固件共同签核/设备适配仍未完成；R4已另接临时宿主hello/exchange，不是生产通道。** 本节旧草案已[归档](../context/history/round-pet-g0-r3-evolution.md)，不同时维护另一套字段表。

外层protocol=hub-device/1，profile=round-pet-native360-wire/1、schema_version1；媒体仍round-pet-native360/1。hello完整schema2/媒体扩展与版本选择；exchange用request_seq表达请求/心跳新鲜度，无独立heartbeat_seq。播放/显示/保存新字段分别使用schema2，inventory/touch/cancel/control/error显式版本，缺版本拒绝，不扩大A3/A4旧闭合入口。

固定/hub-device/v1/hello、exchange及按M/F寻址的metadata/asset相对路径；控制4KiB/头8KiB/Range32KiB/写块4KiB保持。metadata采用offset/next_offset+46总数，每页最多8个完整descriptor并核实际body，不给设备全目录工作集。hello选择和(P,M,N)必须后续绑定同认证socket/挑战；现有session-runtime未接入新信封。

storage区分saved(root_commit)、already_available(inventory_reference)、deferred、failed、cancelled_pre_gate及outcome_unknown；cancel.report独立表达gate前取消/仅取消播放/未知。deferred_local只在accepted admission字段；display明确维护及历史来源context；touch只观察不反射；binding.revoke的fenced_local不是持久解绑。精确字段、HTTP/恢复表以新合同为准。

旧A4 round-pet-pull-candidate/1、/offline-round-pet/v1及native360-v5-lease/1子记录都不等于正式新信封，旧v5更不能改名升级。新codec/Node往返账本与独立C++宿主检查器只做离线格式/数值/关系/关联对照，不是证书/许可/真实刷新/Flash事实来源。A1–A10/R2的动态授权/模型/门禁和实际提交顺序保持，正式runtime转换和固件消费需后续独立实施。

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

G0联合关闭要求C01–C08及身份/资源设计C09–C10有共同决定和字节级正反向量；G0-R1已对照固件回复并完成真实媒体/来源身份核对；R3已交付管理端字段/错误与Node/C++宿主字节对照；固件未签核/未消费，不能称ESP新wire互操作。G1是现行维护验证，G2包括TLS峰值/最大内部连续块、可信时间、凭据持久化/撤销恢复和有界I/O；临时RAM凭证探针不等于正式绑定。G3/G4还需用户独立设备窗口授权、固件新适配及管理端装配交付。保留内部≥48KiB门槛，不用旧32KiB设计余量覆盖。

始终保持现有V2 namespace／格式、前瞻／a7回退和新通道默认OFF；任何身份／根／资源不一致停止写入，不自动格式化、迁移分区或重置凭据。后续扩展协议只能显式协商新版本；旧客户端看到未支持的saved/库存／维护不能猜测成功。

## 旧候选与R3表达差距（2026-11-02）

[最新交接](../context/plans/round-pet-g0-handoff.md)替代旧C05/取消边界与真实摘要未知状态。A4候选仍是round-pet-pull-candidate/1和/offline-round-pet/v1；其playback.set只有target/control/package_ref，没有本提案mode/asset_descriptor，playback.report没有deferred_local字段，touch不是独立record，A4 exchange虽同样有request_seq，但封套/协商/记录不因此兼容R3。A4旧候选storage取消只有通用ack/播放cancelled；R3新合同已增加独立表达，没有自动转换旧候选。不要把上述提案或固件输入表直接POST到任何设备。G0-R2已完成[执行边界离线对照](round-pet-g0-r2.md)，R3字段/错误/最大报文与宿主双语言golden已交付；R4修订2及默认OFF临时宿主hello/exchange已实现，下一共同评审、临时GET/分段、真实UI及独立许可/资源门槛。后续先Spec/Diff，不改现有候选schema来假装兼容。
