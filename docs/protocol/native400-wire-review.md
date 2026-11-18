# 400-03 独立400协议／宿主字节审阅合同

2026-11-02。[Spec](../context/plans/native400-03-spec.md)/[Diff](../context/plans/native400-03-diff.md)、[实施报告](../reports/2026-11-02-native400-03.md)、[固定表](../../packages/core/native400-wire-contract.json)、[94正／116反向量](vectors/native400-03-wire-v1.json)。本合同是**管理端离线review提案及宿主实现**，不是双方签核、ESP实现、正式协议分配或生产入口。旧360协议/80正62反保持原字节。

## 身份与版本

| 轴 | 本次固定值与边界 |
| --- | --- |
| envelope | protocol=hub-device/1、profile=round-pet-native400-wire-review/1、schema_version=1 |
| 合同表 | native400-wire-review-table/1、revision1；表/向量SHA在报告与测试中固定。未来改义须显式修订并保留旧证据，不原地把本profile转生产 |
| scope/namespace | namespace_scope=offline-candidate，N=dd0f19bfdc4bed608ddf18baf095fd6c8b53217bbb59d8f0238e51460e2c0ff8；P/M来自独立批准400-01元数据，不能拿M_host/I/F代替。正式N未定/未安装 |
| 执行profile | native400-full-offline-review/1，只表示离线完整目录范围，非授权设备开放78动作；真实首窗口仍保守0/11＋physical4另审 |
| 版本表 | capabilities3/control1/lease1/playback3/display3/storage0/inventory0/touch1/cancel2/error1，闭合不降级 |
| 能力 | 原400-02 round-pet-native400-window-review/1/schema3：file5865472、ring1048576、3RGB×320000、history160000、tile8000、packed8064、raw头表2464、收据7712，persistent=null。不是通用schema2、不是设备内存实测 |
| lease记录 | native400-review-lease/1（独立wrapper），既有request/kind/context/control/lease_ms字段语义；数值不替代原guard或可信时间 |

所有封套字段闭合：protocol/profile/schema_version/type/request_id/request_seq/context/payload。context为device_id/binding_id/binding_epoch/boot_id/session_id/controller_id/service_instance_id；epoch/revision/seq用uint64十进制字符串，不转Number。request/stream/commit序列正值，binding_epoch允许0作语法表达，不代表实际允许绑定。hello.begin的context=null；不可解析error可用null关联，其余须完整context。实际7字段归属/挑战匹配、证书/撤销/lease/旧序列/dispatch关联由400-04复用现有owner/guard，codec没有认证能力。

UTF8 fatal、无BOM/decoded重复key、仅安全整数且无浮点/指数/-0别名；canonical ASCII对象key排序、数组顺序保留、无空白/换行。JSON body 1..4096B，合同有限深度/节点；C++独立解析/闭合表与语义，无第三方JSON库。原parser/matcher为本仓库MIT代码复用，旧oracle不改；不涉及固件库复制。

## 完整性选择与状态字段

**本review wire只接受verified-replay。** hello begin/challenge/confirm/ready及playback.set均显式携带该策略，progressive-review被拒绝。管理端400-02的渐进模式继续仅作离线对照；选择其生产语义要双方另冻版本/可信帧链/失败画面恢复，不借“设备支持CRC呈现”自动降级。

默认第一遍完整F＋全部CRC＋连续index/RGB SHA＋extra key校验，再显式重读逐帧比对压缩SHA收据，之后独立首帧提交。初始两遍读取/解码/帧SHA、最多7712B收据及每loop再次读取是实在成本。wire证明字段只做形状/一致性检查，不会执行SHA、证明固件做过校验或给素材许可；400-04必须从已批准metadata与真实actor确认派生，不能接受设备任意自报哈希或拿HTTP成功补verified。

| 记录／字段 | 可表达事实 | 不可替代的边界 |
| --- | --- | --- |
| playback.set.target／display.desired | 本会话请求目标与revision，目标含character/variant/M/action/F | desired不是actual；未发/拒绝/晚命令不能由display回填执行 |
| playback.report accepted | admission=ready或deferred_local；integrity=pending，verification/verification_seq=null | 接纳不意味着下载、全验、刷新或保存 |
| playback.report verifying | 第一遍验证中，仍pending，无verification | metadata/部分CRC不是whole F |
| playback.report verified | integrity=verified，verification_seq正值；proof含whole_file_and_media、F/index/RGB、实际frames/extra且与descriptor一致 | 此报文不产生playing；自报一致不等于已对批准metadata/actor核验 |
| asset.verified | 独立verification_seq＋package/asset/descriptor/proof；用于没有远端命令的本地0/4等素材 | 不造remote4命令，不代表本地4已经安装/可用；仍须当前会话证据与来源批准 |
| display.report actual | origin、source_context、control/source_target、asset、frame_index、first_frame_committed=true、first_frame_commit_seq/commit_seq、verification_seq、display_integrity=verified、historical | 验证序列应解析到同session/P/M/N/F/descriptor的已接纳全验证据；token/软件提交仍非物理面板扫描证明 |
| display_state/maintenance | unknown必须actual=null；playing仅maintenance=none且非historical；held可用于维护、欠载、结束或旧会话画面 | 不承诺旧动画在下载/保存期间持续播放；本profile没有保存维护实现 |
| storage.status | capability=unsupported、inventory_known=false、saved/offline_available=null | 不是saved=false/已知空库存，不允许save/evict命令或成功回执；持久化须新能力/版本/根证明 |
| cancel.report | execution_invalidated=true，outcome=cancelled/already_terminal，io_exited分别false/true | 失效先发生，实际退出后才可回收owner。该布尔字段本身不执行或证明RTOS/I/O退出 |
| touch.event | local action4 started/ended及最新base_target，可为null；不能ack dispatch | local4优先/回最新base/期限/旧命令处理仍由执行调度验证；本片只冻结表示 |

verified proof固定字段：evidence/file_sha256/index_sha256/rgb565_sha256/frames/extra_keyframes。descriptor还含bytes/width400/height400/fps24/codec_flag1/key_interval12/tile_rows20。42严格118帧、末帧117；其他241/240，extra≤frames−ceil(frames/12)。逐帧tag0/XOR以及时间计算的执行证据见400-02，不在codec内重复解码。取消前未完成全验的playback.report/cancelled表示pending；已verified后的取消走cancel.report，不把已验历史改成未发生。

远端actual的control身份匹配source_context，source_target的action/F/manifest匹配actual资产/包；current还须source_context等于外层context且desired等于该target。历史可保旧session的held画面，不得称playing；本profile只处理同包历史，不含跨角色/多包切换。local actual只许0/4、control/source_target均null。所有真实刷新序列/当前目标和旧结果拒绝仍待400-04 owner装配，单包解码不执行序列防重放。

## 消息、目录与读取

消息8类：hello.begin/challenge/confirm/ready、exchange.request/response、manifest.page、error。控制7类：lease.acquire/renew、playback.set/cancel、query.display/storage、binding.revoke。playback.set只接受base_loop/once_hold，remote4拒绝；语法全目录不代真实首窗口策略。每个exchange最多一个observation，response的control/read_permit互斥。pending/最新意图、控制优先、单HTTP/lease续期和跨报文状态仍由后续actor/owner维护；这里没有新队列、listener、自动重试或TTL延长。

新路径前缀`/hub-device/native400-review/v1/`，仅本地提案，不与旧/hub-device/v1混用：

| 请求 | 表达与限制 |
| --- | --- |
| POST hello / exchange | JSON≤4096B；未来外层mTLS/单socket/实际请求头≤8192、无content/transfer encoding，不能从profile推定身份 |
| GET manifests/{M}?offset={0..77}&limit={1..4} | 单次manifest permit；page回显permit_id及授予exchange的request_id/seq/context/package，连续原ID/total78、next_offset=实际末位置，末页null |
| GET assets/{F} | 单次asset permit含control/P/M/N/target/[start,end]/total_bytes/remaining_ms。显式单Range、1..32768B且end<批准总长，If-Range为F强ETag；段后回exchange，不能把URL/F当许可 |

78项固定上限4，每整库20页（19×4＋2）；极值身份/seq下4条3019B，8条4675B超4096，故不复用旧8条。最大固定正例display3792B；另测最大query/维护/尾帧显示3877B和最大descriptor四项尾页3039B，均在4KiB内（后者仅容量反例输入，不代表真实素材批准）；不为省字节重排ID或把118补241。descriptor包含index/RGB和extra，来自400-01批准元数据。目录只在hub，不要求设备常驻全部78 descriptor。

asset响应206，Content-Length=end−start＋1、Content-Range=`bytes start-end/total`、强ETag=`"F"`，头X-Pet-Hub-Read/Request-Id/Request-Seq精确回显同permit/grant exchange。Node函数验证已解析头列表，大小有界、大小写不敏感去重，拒CRLF、redirect/200/弱ETag/任何content-encoding/transfer-encoding及错许可/范围/总长；不是原始HTTP解析器或body证明。实际If-Range请求头、真实status行/头限额、段数据长度/SHA、一次许可消费与socket/块前后guard在400-04复用现有承载实现；本片不声称已做实际HTTP测试。

400-04还须分别冻结接纳ACK、全验/重读作业期限、read permit与当前lease horizon。20页目录、两遍媒体和本地验证/首帧回执增加exchange成本，不能把原4秒ACK当完整下载/全验期限，也不能把旧6页/loopback样本或400-02虚拟时间当最坏延迟。需要续租时必须经原认证owner合法renew、逐块重新授权，并始终受独立作业截止约束；不延长TTL掩盖排队/长验证，不因模型deadline较长忽略外部guard失效。网络/CPU/磁盘/ESP测量未知继续NO_GO。

## Node入口与C++宿主范围

packages/core/native400-wire.mjs：validate/encode/decodeNative400Wire、native400WireContract/Error/Budget、classifyNative400Request、native400ManifestPage、validateNative400AssetResponse、validateNative400MaterialRefs。后者以调用方可信、独立批准400-01 metadata核P/M/N/character/variant、F、descriptor各域及permit.total_bytes；只比对，不发现许可、不hash媒体/认证、不消费许可或更新实际状态。输出clone，拒绝不变更输入。

native/native400-wire-check.cpp读取固定合同文件和stdin≤4096B：接受输出同canonical字节/exit0，peer报文拒绝输出reject/exit2，配置/合同错误exit3且无输出。编译C++17/Wall/Wextra/Werror到自有临时目录。Node和C++分别实现语义，测试不调用Node替C++判结果。HTTP路径/头和metadata批准比对是Node单独边界，不混写成C++网络/密码学/身份互操作。

复现`node scripts/verify-native400-03.mjs --output .cache/native400-03/results.json`。生成golden的脚本只生成原创描述/协议字节，无媒体/I/O监听；固定SHA变更须显式审阅。完整性/状态向量不是ESP固件解析器、TLS/资源、24fps或实体屏证据。

## 交固件的决定／待确认项（尚未共同签核）

| ID | 管理端已实现的离线选择 | 待固件确认／交付 |
| --- | --- | --- |
| W01 | 独立review profile/revision1、scope/N_offline、固定版本，不改360 | 正式profile/版本/namespace与N/Store共存策略；不能把离线N写入设备 |
| W02 | 仅verified-replay，两遍＋帧SHA收据，无progressive wire | 接受首帧延迟/带宽/每loop重读与7712B成本；若选渐进，另交可信头帧链/状态/晚失败恢复，不能悄悄降级 |
| W03 | 新cap显式工作集、persistent=null；schema2拒新语义 | 实际RAM区域、IO/read-ahead/table/对齐/摘要/栈/TLS峰值及最大块；旧2322168B无网络数据不能直接合并新收据 |
| W04 | 78/118/extra/hash descriptor、4项20页与≤4KiB | 端侧分页/有限descriptor/头表与range装配、版本/错误表采纳及自身Node-C++/固件向量结果 |
| W05 | accepted/verified/首帧/历史/维护分轴、verification_seq及local asset.verified | 真实CRC/F/像素全验/软件刷新完成的产生点、touch4返回最新base、迟到/失效不复活；首帧软件边界与物理刷新区分 |
| W06 | unsupported saved/库存，仅null不合成成功 | 400持久化/新N/V2几何/全验/提交gate/root读回、unknown/淘汰/保存结果版本及恢复；未交前不扩storage0 |
| W07 | cancel失效与io_exited分开表达，不超期释放 | 端RTOS/读取消/任务实际结束、旧session/新目标竞争及资源保护证据；若Flash接入，gate后一次收尾另定 |
| W08 | 新review路径/Range/ETag/permit/相对预算表示 | 单TLS/单HTTP owner、控制/段优先、逐块撤销/期限与实际退出、最坏等待/漂移预算；不以loopback或延TTL作上界 |
| W09 | context/control/lease形状与P/M/N/元数据pin，不做认证 | 可信时间/证书/秘密/epoch持久化、撤销重绑定/断线与休眠恢复，以及真实握手/内存G1/G2/24fps |
| W10 | 所有样本原创MIT、真实素材只沿原400-01候选身份 | 真实用途批准、共同G0逐项接受/拒绝/修订理由及精确文件/构建/合同SHA；独立设备窗口另授权 |

本文件未向固件任务发送消息或修改其仓库。下一400-04可先接本候选的默认OFF临时宿主链，明确未签核/未知资源，不能因此启真实设备通道。回退仅移除本轮独立文件；无格式/namespace/缓存/运行配置迁移，既有pet/bridge/DSH不动。
