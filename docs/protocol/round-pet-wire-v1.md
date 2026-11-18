# round-pet-native360-wire/1 管理端冻结提案

2026-11-02，R3提案／R4修订2。状态：**字节合同及显式临时宿主hello/exchange adapter已验证，待固件共同确认；未装配设备/生产HTTP**。[Spec](../context/plans/round-pet-g0-r3-spec.md)/[Diff](../context/plans/round-pet-g0-r3-diff.md)、[报告](../reports/2026-11-02-round-pet-g0-r3.md)、[权威闭合表](../../packages/core/round-pet-wire-contract.json)、[固定字节向量](vectors/round-pet-wire-v1.json)。表与下列选择构成管理端提案，不宣称双方签核。旧G0草稿wire部分已被本文替代，媒体/身份/资源不变。

## 版本、路径与信任

外层protocol=hub-device/1、profile=round-pet-native360-wire/1、schema_version=1；媒体profile仍round-pet-native360/1，capability schema2，PET4 flag1，旧HTTP v5、A4 round-pet-pull-candidate/1及lease子profile分别建模。旧A3/A4/lease parser不放宽、不改名/自动翻译新包；新codec拒绝旧信封。核心API为encodeDeviceWire/decodeDeviceWire/validateDeviceWire、固定合同/错误/数值预算/相对路径检查及纯往返账本；R4另有显式临时宿主adapter，不注册listener/CLI/UI路由。

| 请求 | 冻结的相对路径与用途 |
| --- | --- |
| POST hello | /hub-device/v1/hello；begin/challenge、confirm/ready两次往返 |
| POST exchange | /hub-device/v1/exchange；设备主动拉取，响应≤1 control，下一请求交观察 |
| GET metadata | /hub-device/v1/manifests/{M}?offset={0..45}&limit={1..8}；固定(P,M,N)及本次许可 |
| GET asset | /hub-device/v1/assets/{F}；单显式bytes=start-end、长度≤32768，不收任意URL |

同origin/认证socket、单TLS/单HTTP owner；TLS/绑定及可信时间不由JSON提供。身份/日期/撤销/租约、设备来源与动作/资源准入仍由既有guard/R2/A2处理。包(P,M,N)是经受信owner独立批准的会话输入，不是自签许可；F/长度/PET4全验依旧必需。缺省execution_profile=first-window-review/1，R2只准缓存0/11、physical4不反射；R4修订2仅另允许测试owner显式固定full-offline-review/1验证保存等离线路径，不在会话中切换、无生产入口。codec能描述G4动作不等于已获执行授权。

## 共同表示和资源限额

所有消息均为{protocol,profile,schema_version,type,request_id,request_seq,context,payload}，字段不可缺省/未知；request_seq为非零uint64十进制串，兼作该会话请求/心跳新鲜度，不再另加heartbeat_seq。响应回显本次id/seq；无法解析/关联的error用id=null、seq=null，不编造关联。hello.begin的context=null，认证owner产生challenge后才有完整context；error可null，其他消息必须完整。

context闭合7字段：device_id/binding_id/binding_epoch/boot_id/session_id/controller_id/service_instance_id。id为1..80 ASCII字母数字下划线/横线；epoch/stream/root/generation用规范uint64串，拒绝数值代替、前零、溢出。SHA为64小写hex。数值仅安全整数、有界本地elapsed/remaining，禁绝对expiry、浮点/指数/-0、BOM、坏UTF8/孤立surrogate、重复解码key。JSON按A2受限canonical：对象ASCII键排序、数组原序、紧凑UTF8无尾LF；解析后重新编码必须逐字节相同。序列化不替调用方重排数组修身份。

control body实际编码≤4096B，HTTP头≤8192B，Range≤32768B/应用写块4096B；remaining_ms/lease_ms表示1..30000的相对时长，实际15秒租约/发送预算由既有guard限得更紧，不能靠格式上限延长TTL。page最多8项且每个实际body仍≤4096，超限减少limit。最大字段八动作末页向量3075B是合成表示样例，不是CPU/RAM/网络最坏时延。

classifyDeviceWireRequest只验证相对方法/路径/query/Range形状/上限；deviceWireBudget只验证数值限额，**不是HTTP解析器/认证/头截断/I/O实现**。未来adapter仍需实际头8KiB、Content-Length/完整体、总文件长度/ETag/许可/截止、禁redirect/压缩/chunked/多Range及实际退出检查，不能因helper通过省略它们。

## Hello 与能力协商

hello.begin payload={boot_id,capabilities,versions,package_ref}，capabilities为完整schema2身份/466² center/单encoded5865472/Flash4+1/max_downloads1/touch/display；extensions.round_pet含media profile、固定N、360/24/241/flag1/key12/tile20及同一versions。固定版本集：capabilities2、control1、lease1、playback2、display2、storage2、inventory1、touch1、cancel1、error1，整集显式选择，不对未知版本猜默认。

hello.challenge={challenge_id,versions,package_ref,execution_profile}，context来自已认证绑定；confirm回显challenge_id/versions/package_ref及context，ready确认同选择/包/固定执行profile（缺省首窗口）。request id/seq各往返回显。实际owner必须将选择/包绑定到同TLS socket、挑战和认证context，拒绝替换/重放/跨socket；R4临时adapter现将该表示显式映射到既有session begin/confirm并绑定同socket/挑战/选择；session新增按socket丢弃未完成挑战，旧begin/confirm闭合入口继续拒绝新字段。不能直接发送此JSON到旧候选或设备。

## 控制与记录的闭合字段

exchange.request.payload={observation:null或{dispatch_id:null或id,record}}；exchange.response.payload={control:null或{dispatch_id,kind,payload},read_permit:null或许可,poll_after_ms:0..500}。control与read_permit互斥；有关联回执时echo派发ID，touch必须dispatch_id=null。不能用HTTP200代替业务接纳或首帧。

| 控制kind | payload |
| --- | --- |
| lease.acquire/renew | request_id/request_seq/expected_epoch/lease_id/lease_ms；acquire lease_id=null，renew非空 |
| playback.set | control/target/package_ref/asset_descriptor/mode=base_loop |
| storage.save | operation_id/target/package_ref/victim_action_id，后者显式null或可淘汰ID，禁止0/4及目标自身 |
| playback.cancel | operation_id/完整target/control，不用裸command_id跨会话取消 |
| binding.revoke | operation_id；本记录只请求本地fence，不代表正式解绑/凭据持久撤销完成 |
| query.display/query.inventory | query_id |

control={controller_id,service_instance_id,control_epoch,lease_id}须匹配外context。target沿用7个字段command_id/revision/character_id/variant_id/manifest_sha256/action_id/asset_sha256；M必须与package_ref相同。package_ref={namespace,firmware_package_sha256,hub_manifest_sha256}；descriptor={bytes,width,height,fps,frames,codec_flag,key_interval,tile_rows}固定原生360规格，长度544..5865472。没有文件路径/URL、绝对截止或本机端口。

| record | 版本与新增表达 |
| --- | --- |
| lease.granted | 原native360-v5-lease/1 JSON子记录，显式字段/相对lease_ms；直接对象而非base64。内context必须等于外context，守卫仍须独立验证来源/日期/请求/epoch/期限 |
| playback.report | schema2：report_seq/target/control/package_ref/phase/elapsed_ms/admission/first_frame。phase保持accepted/downloading/verified/playing/failed/cancelled/ended；accepted admission=ready或deferred_local，其他null；playing要求正refresh_generation/first_frame_seq，其他first_frame=null |
| display.report | schema2：保display_seq/kind/query_id/origin/asset_ref/source_command/refresh_generation/frame_seq/elapsed_ms/display_state；maintenance变为{phase,generation,reason}且phase/reason固定none/loading/verifying/saving/recovering/blocked。unknown无资产/来源；local仅0/4、无source_command；remote source_command={context,target}可标历史会话，不给旧命令补playing；playing不能同时maintenance |
| storage.report | schema2：storage_seq/operation_id/source_target/package_ref/status/commit_stage/commit，具体下表 |
| inventory.snapshot | schema1：inventory_seq/query_id/known/namespace/root_seq/root_state/active≤4。完整同根、按action_id升序、不重复，generation>0且≤root；EMPTY空、IDLE_READY仅0、OFFLINE_READY含0/4。unknown无root/条目，不把部分列表当淘汰 |
| touch.event | schema1：event_seq/local_token/phase=requested或playing或ended/refresh_generation/elapsed_ms/base_target(null或target)。event_seq每条递增，local_token标本地一次手势；playing有刷新证据，elapsed本地相对值；只观察不产生remote4 |
| cancel.report | schema1：cancel_seq/operation_id/target/control/effect=cancelled_pre_gate或playback_only或outcome_unknown，清相应cancel dispatch，不借此宣称保存取消成功 |
| control.receipt | schema1：receipt_seq/operation_id/kind=binding.revoke/result=fenced_local；旧绑定/凭据元数据撤销仍需可信持久流程，不把这个结果写成已解绑 |

新版本未知即拒绝；旧A3 ingest继续拒绝schema2，R4通过显式openWire/ingestWire/prepareIngestWire验证原记录与proof后集中规范化。display的event query_id=null、snapshot有query_id；历史source context允许不同于当前外context以如实描述旧画面，不能用于恢复控制权。schema/字段验证不核当前包F白名单/回执来源/实际刷新，必须经既有授权、A3投影、A8durable顺序与R2门禁；R4复用这些owner，没有替换其认证/提交语义。

## 保存、缓存命中与取消

| status | commit_stage | commit含义 |
| --- | --- | --- |
| saved | confirmed | {evidence:root_commit,root_seq,object_generation}；本次实际有效新根提交并确认 |
| already_available | not_started | {evidence:inventory_reference,root_seq,object_generation}；命中当前有效对象，没有新提交，不可冒充saved |
| deferred | pre_gate | null，操作已接纳但未完成；后续可用同operation_id的dispatch=null结果 |
| failed | pre_gate或post_gate | null，确证未尝试marker；不能仅从固件bool=false得出 |
| cancelled_pre_gate | pre_gate | null，gate前确证取消；gate后不得发这个状态 |
| outcome_unknown | marker_attempted | null，marker/确认可能已改变根；阻新写/盲重试，只查询恢复 |

saved及already_available的object_generation>0且≤root_seq；F/N/bytes来自对应target/批准目录/根，actual与库存独立。deferred与保存终态是同operation的不同消息，终态需更高storage_seq；旧session终态丢弃后只能新库存查询补事实，不补历史saved。取消独立effect：gate前取消可cancelled_pre_gate；gate后最多playback_only，持久工作仍可saved/unknown。过期/晚saved不激活旧base，淘汰在新完整库存投影，R2/固件提交钩子继续负责事实。

## 分页与二进制读取

manifest.page payload={package_ref,offset,total_actions:46,next_offset,actions}；每动作{action_id,asset_sha256,asset_descriptor}。actions升序、1..8；next_offset=offset+本页数，恰46为null，超46拒绝。页/相对GET/许可与会话批准(P,M,N)绑定，消费者不按N相同就信任新包。设备只保单descriptor，不以页重建46条常驻库；hub发布前完整核P/M/真实库。二进制asset不套JSON，仍需完整F/长度/PET4/CRC及已认证Range许可，不因分页合法而取得下载权。

## 错误/HTTP/恢复动作

error.payload只含固定code；没有cause、私钥、路径、URL或可任意设置retry。HTTP只表达承载，调用方按固定恢复动作处理，不编自动重试。TLS握手拒绝时可能根本没有HTTP错误体，不能依赖error JSON完成认证失败处理。

| code | HTTP | 恢复动作（均非自动重放） |
| --- | ---: | --- |
| invalid_message | 400 | none |
| unsupported_encoding | 400 | none |
| authentication_failed | 401 | new_session |
| stale_binding | 403 | none |
| unapproved_package | 403 | none |
| touch_only | 403 | none |
| first_window_action | 403 | none |
| stale_session | 409 | new_session |
| stale_control | 409 | new_session |
| stale_revision | 409 | none |
| idempotency_conflict | 409 | none |
| unsupported_profile | 409 | none |
| unsupported_feature | 409 | none |
| cache_busy | 409 | query_only |
| lease_expired | 412 | renew_then_new |
| deadline_exceeded | 412 | none |
| message_too_large | 413 | none |
| incompatible_asset | 422 | none |
| queue_full | 429 | none |
| maintenance_busy | 503 | query_only |
| storage_outcome_unknown | 503 | query_only |
| temporarily_unavailable | 503 | bounded_read_same_session |

none拒绝本操作；new_session销毁旧上下文后经认证新握手；renew_then_new须先可信续租并生成当前意图的新命令；query_only只查询实际根/画面，不重试未知副作用；bounded_read_same_session也只允许同会话、幂等query/read、剩余期限内有限重试且实际I/O已退出。自动重试在所有表项均false；codec/账本没有实现重连退避或重试线程。内部解析错误在未来adapter转invalid_message/size类，不能把内部error.code/cause直接透传。

## 往返账本与边界

createDeviceWireLedger({context,packageRef,initialRequestSeq})只供已认证owner；initialRequestSeq缺省0，R4从已确认hello序列设高水位，拒绝跨握手回放。receiveRequest/receiveResponse核完整context、单在途HTTP、严格新request_seq及echo、单未确认control、关联dispatch/operation/target/包、grant acquire epoch+1或renew原epoch/lease，以及各流新序列；无效输入保持状态，不清pending。deferred/命中/取消等正确关联可释放相应control以让续租继续，后续事件dispatch=null。它不激活动作、不落盘、不提供真实TLS/控制权/时钟或批准；caller须在binding/日期/撤销/lease/power/session失效时销毁账本，复用现有guard/投影/存储。

snapshot仅有闭包状态副本，最多1 HTTP/1 control/7个流高水位；close清pending并拒绝晚结果，无历史队列/自动重放。新认证会话使用新账本，uint64不经Number转换。身份/来源证明、命令幂等窗口/全资产白名单、完整operation生命周期及错误关闭策略由R4临时adapter/既有owner负责（未做生产装配），不能只凭账本boolean接收设备事实。

## 验证与回退

修订2共80正向/62反向固定向量（原78正例逐字节保持，新增2个full-offline选择）包含canonical UTF8或非法hex、长度/SHA及合同SHA；Python一次生成后固定，Node及独立C++17宿主解析/字段/关系检查对同字节往返。C++实现仅stdlib、临时编译，不是固件/ESP实现，也没有C++会话/Flash/TLS栈。24专项和监督入口见[报告](../reports/2026-11-02-round-pet-g0-r3.md)。

```sh
npm run check
npm test
node scripts/verify-round-pet-g0-r3.mjs --output .cache/round-pet-g0-r3/results.json
```

字节专项自身无listener/socket/固件构建/新真实素材读取（R4另用独立临时loopback TLS），编译器产物仅自有临时目录，监督取消删除进程组/目录，不动外部服务。回退撤回独立codec/提案/向量即可，旧A1–A10/R2没有数据/配置/版本迁移。R4默认OFF临时adapter已复用session/guard/A2/A3/R2/A8，见[API与限制](round-pet-wire-review.md)。下一共同审阅修订2合同SHA/向量，R5已另接临时GET/分段与取消I/O，R6已完成新wire A1 actor对照，R7已补同步gate收尾，下一共同G0/资源核定先Spec/Diff；独立许可批准、G1/G2及设备窗口继续必需，联合G0未关闭。


R3原始合同/向量按原SHA[归档](../context/history/round-pet-g0-r4-evolution.md)，旧报告的78/62与源码SHA仅对应当时版本，不追写为当前修订。R4未改变已有消息字节/字段位置；修订2是共同评审输入，不从单方修改推导双方同意。
