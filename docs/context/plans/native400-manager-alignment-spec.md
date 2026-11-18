# 管理端400×400／78动作规划对齐 Spec（实施前）

2026-11-04当前覆盖：用户已改设备主线为明文LAN TCP，优先缓存remote0/1/11、4物理触摸；已确认板上f553与未部署a74f分账，旧6882/HTTPS/mTLS/Range及其预算只作历史，不再作当前默认或前置。当前共同待定与下一入口以[TCP-01对齐](../../protocol/native400-tcp-alignment.md)为准；下方旧阶段表保留追溯，不推导已支持新TCP/保存或取消管理页面权限。broker/native选源后置且独立。

2026-11-02。用户明确后续管理端主线对齐已批准400素材；360保留兼容与回退。先读AGENTS、README、当前上下文、开发/维护规则及既有400交接。本轮仅规划、只读证据和文档，不改生产实现/固定协议字节/依赖，不使用子智能体，保留所有已有修改。

## 范围

1. 冻结现有400 compact78批准版的manifest、library78/role8 index与provenance摘要和0–77逐文件身份；以本仓库已批准交接为输入，只读核实际文件SHA/长度/头/帧表/tag，不重编码、搬运媒体或真实导入A2。区分源manifest、宿主index I、运行时manifest M、固件package P和namespace N；缺正式400 P/N/recipe不从360或文件名补造。视觉批准、内部用途批准、设备准入分开。
2. 明确400/466居中(33,33)、24fps、42号118帧/其余241帧、tile20/8000B、palette256/8位索引、额外tag0与完整索引/XOR选择；保留原ID/八语义。核对当前PET4/parser/仓库/角色激活已支持范围，以及A1/A2/R3–R7专用360限制，不能只改width/动作数量称400闭环实现。
3. 只读固件最新矩阵、400报告/资源与相关profile/Store/网络边界；按文件SHA与并发变化标明读取快照。核对单encoded旧360与400帧窗口/三RGB/数据池/栈/Flash/HTTP/TLS预算差异。400无Wi-Fi样本不能证明G1/G2；不复用360 N解释400缓存、不要求改分区或迁移现有V2缓存。
4. 建立当前400目标基线，更新现有共同G0 C01–C12与差异表：管理端已实现/需适配/待固件确认/真机待验。定义新旧profile显式选择、资源报告、包身份批准、播放/保存/库存/维护/取消/重连证据边界与回退。现有360代码/合同/向量保持，不用旧sim_A宿主通过代表A1设备执行。
5. 将下一实现拆为可独立离线验收的小片：身份/recipe/profile，纯core资源/可变时序，codec/字节向量，默认OFF装配/actor与恢复；固件资源/持久化与授权窗口单列。400/78是目录目标，不把全部78同时装入28MiB或首窗口一并开放；分层360不在本轮迁移。

## 输出与验收

- 本Spec/Diff先于审计和更新；报告/去敏证据保存身份、预算算术/来源与未决项，不复制媒体、凭据/配置/原始设备响应。
- README、index、current-system/todos、roadmap及共同G0交接直接替换旧“下一360主线”的当前规划；旧360报告/合同不改历史测试结论，归档被替代记录。360兼容/回退独立保留，400目标不自动变为已部署/验收。
- 核对实际78媒体的文件身份/头/帧数/offset/tag，复用已有18675帧CRC/索引/RGB/seek证据并注明未重复项；摘要改变则停止继承旧证据。使用本仓库工具/标准库，不import或执行固件脚本/测试/构建，不创建固件缓存。
- 按仓库要求运行npm run check与npm test（含构建）。本轮无行为变更，不新增复述规划的测试；核对文档链接、JSON、空白、既有源码与360合同身份。

## 边界与回退

不接设备/串口、不烧录、不启生产listener、不安装插件、不改固件/pet/bridge/DSH配置或现有服务、不提交推送。媒体只在既有忽略目录只读，临时审计输出在自有忽略.cache。回退仅本轮规划/文档，无运行数据/批准/格式迁移；未来设备回退必须按当时现场分别核验app/配置语义/绑定epoch/完整缓存，不能用旧360镜像或旧N覆盖新设备状态。

## 对齐后的合同草案

以下是管理端规划选择，待后续实现Spec和固件共同确认；不是新增可调用协议。

### 身份、版本与来源

- 现有400宿主素材profile保留native400-candidate-v1，制作recipe为native400-compact-approved-v1；名字中的candidate不妨碍它成为当前开发目标，也不证明设备验收完成。78 ID严格0–77，八语义0/4/1/11/43/58/7/55保留；role8是宿主语义子集，不替代全78目录或假定8项全离线。
- 已交付的原始source manifest SHA、library78/role8 index原字节I、各自runtime M与provenance逐域保留。manifest内继承的catalog_sha256是来源目录身份，不能当新P/M；provenance/视觉批准也不是A2独立用途批准。
- 400-01已交付[离线身份recipe](../../protocol/native400-identity.md)，下述设备候选规则已有实现：catalog含显式400媒体profile、几何、78个F/bytes和license_ref；timing逐动作给fps/frames/index SHA，语义及source原字节SHA进入package content。M_device=SHA(C(该设备catalog))、P400=SHA(C(新package content))；不得直接用含package_schema=2/loop字段的M_host替代。闭合字段、候选P/M/N_offline见400-01 API/报告；正式固件N及共同签核仍未完成，真实用途批准未产生。
- N400必须与360的dfc829e1…及早期fixture的5dd9df30…分别建模。现compact固件报告namespace=null/未安装，fixture N只对应只读诊断，不是生产N。新N/根geometry/validator及缓存共存/恢复由双方确认；不在本轮改分区、写N或迁移/清空V2。旧360缓存不能变成新400库存，回退也不能跨N自动降floor。
- 未来wire提案使用独立400 profile（建议round-pet-native400-wire/1，未分配/签核），媒体profile、能力schema、USB诊断ACK V2及hub JSON revision2各是独立版本轴。现360 round-pet-native360-wire/1合同和80正/62反保持原字节；不能扩大旧profile的const或复用旧approval让400通过。

### 能力与工作集

管理端以最新400帧窗口作为待适配执行方向：单有界压缩窗口＋三RGB，其中三RGB已含前瞻；文件大小、压缩窗口容量、解码缓冲和持久槽分别上报。旧schema2把max_asset_bytes限制为playback_bytes以内，无法如实表达最大5.57MB文件/1MiB窗口，不能谎报5.86MB播放RAM或把像素缓冲填成encoded容量。

新能力正式合同仍待定；400-02已另行实现[本地schema3 review](../../protocol/native400-window.md)，以下是规划口径：显式execution_model=frame_window、素材400/物理屏466/center33、file上限、compressed_window_bytes、rgb_frames=3及单帧320000B、history160000B、tile8000B、metadata/IO/read-ahead独立预算、逐动作实际帧数及extra_keyframes支持。persistent=null表示尚无该profile的持久执行；4活跃＋1暂存、payload5865472/stride5869568/28MiB仅是保留的几何目标，正式确认后才能声称支持保存。窗口缓冲不是额外Flash槽或四个RAM槽，完整文件上限也不证明任意24帧窗口可容纳。

旧360完整encoded模型/schema2继续工作。400若未来选择完整encoded模式，必须独立报实际工作集与资源证据，不能把它的容量/旧内存低点移植给帧窗口模式。新cap schema及兼容拒绝向量须在400-02/03共同定版，不给旧parser加缺省兜底。

### 完整性、播放及维护

- PET4头固定256项RGB565/8位索引、key12/flag1/tile20；每tile8000B，压缩块上界8047B。0/12/24…必须tag0，其他帧可tag0或tag1；按tag解完整索引或XOR，不依据帧号推断delta。index_order的morton/nearest等是调色板索引排列方案，不是改变400空间坐标的显示模式。
- 42号仅118帧（末帧117、时长118/24秒）；其余241帧（末帧240、时长241/24秒）。循环/一次结束规则取版本化语义，不静默补帧/截断/变速，首次循环/跨尾恢复/seek都核实际frames。新帧token及generation、首帧软件提交仍是playing必要证据，不把网络ACK/PC预览当设备提交。
- **窗口播放与全文件验证不是同一事件。** 最新固件窗口可先逐帧CRC呈现、最后才完成整文件SHA；旧R6模型则先完整verify再submit。下一协议必须显式决定是否允许authenticated progressive playback并表示完整性状态，或采用先完整验证再重读/暂存的路径及额外成本。metadata-ready/单帧CRC/USB Done不得冒充整文件verified，末尾SHA失败保最后有效画面并失效该源，不能事后伪造旧verified。此决定未关闭前，不开放新hub未缓存渐进播放。
- saved仍须完整F/媒体校验＋持久root提交/读回；offline_available来自当前同N完整库存，淘汰撤销当前可用。流式encoded=0不代表已实现边播边Flash保存；staging、全验、gate、root与read lease的400实现待审，不复用旧bool。
- 欠载/重填可保front并平移播放时钟，不累计等待为动画elapsed；设备状态应区分priming/buffering/resuming和保存维护，不将所有loading套为旧360统一freeze或承诺持续动画。触摸/会话失效优先、最新base、旧帧/旧回执拒绝、R7本地一次收尾原则保留；真实400保存/撤销原子gate与实际退出须另验。

## 下一实现小切片与验收

| 切片 | 可先离线的工作与最小验收 | 等待/保持的门槛 |
| --- | --- | --- |
| 400-01 身份/profile（离线已完成） | 独立recipe/78清单/可变timing、P/M/N_offline、400严格A2导入主入口/缓存恢复及30专项已交付；真实仅核候选 | 正式N及设备字段共同采纳、真实用途输入仍待审，不以离线N或视觉批准启生产 |
| 400-02 纯core执行/能力（离线已完成） | 实际ring/file分离、本地schema3 review、118/241/extra/XOR、缓冲/首帧/取消/退出及两种完整性对照已验；见[48专项报告](../../reports/2026-11-02-native400-02.md) | schema2不改义；是否允许渐进播放/何时verified要双方先选，不从USB模型推导新wire事实 |
| 400-03 独立review wire/向量（离线已完成） | 独立review profile/version/hello、4项20页/118尾帧、固定全验重读/验证引用/维护、HTTP表示及94正116反Node/C++同字节；见[报告](../../reports/2026-11-02-native400-03.md) | 现revision2/80正62反属于360兼容；增加新向量而不覆写历史。新能力schema/回执版本共同签核 |
| 400-04 默认OFF装配/actor（离线本片已完成） | 已复用原session/guard/A2 reader/A4 lane/queue与新400投影/actor，临时TLS/20页/双遍/首帧/未知存储/新会话/实际退出37专项通过；400-05调度后续见下 | 真实400持久保存/恢复及namespace选择由固件交付；不可用USB成功或旧sim_A激活代替 |
| 400-05 调度收敛（离线已完成） | 一个原窗口/显式local4源、latest/deferred/取消/旧帧/周期proof、loop/once_hold/欠载/renew与原截止35专项、监督CLI/check/1126回归通过；[报告](../../reports/2026-11-03-native400-05.md) | 可信代码开关不是能力协商；真实触摸/初始0/4/N/Flash/物理预算/正式策略仍需共同G0及资源证据 |
| 固件资源/设备窗口 | 固件任务另Spec/Diff，先宿主/构建，再获准测400@24、网络/TLS/可信时间/凭据/持久化/撤销与恢复 | 当前无Wi-Fi400样本不能放行，G1/G2门禁重新按400工作集冻结；本任务只读不操作现场 |

首闭环仍可保守限制0/11远端base、physical4，不因目录78就开放全动作/下载/保存；这些动作的400缓存必须先经新N下合法安装与库存确认，旧360命中不算。完整78/未缓存/保存依次扩大范围，不重做已批准画质处理。

## 本轮状态（规划轮历史，后续400-01/02/03/04本片已离线完成）

2026-11-02规划对齐/只读核对已完成，未实施400专用core或wire。78文件及两个角色目录身份、42帧数/额外tag0/压缩窗口已核，22份固件文件中采样期间四份源码及矩阵并发变化已重读/分列SHA，补读执行中0dcdf6be清单（无新FPS）；预算只绑定已报告构建。check/含构建940项通过，旧实现与360合同保持；当前摘要/C表已更新，被替代记录已归档。详见[报告](../../reports/2026-11-02-native400-manager-alignment.md)。

## 400-15后的当前入口（2026-11-03）

400-01至05、07至10/12及13/14对应离线范围保持，06/11评审有效；[400-15](../../reports/2026-11-03-native400-15.md)已补安装DSH rc.5静态核对/可信provider决定及独立浏览器真实共享DOM，10专项/1405回归，既有生产代码/原wire不改。原rc.3宿主/manifest不自动扩rc.5，真实DSH身份/native picker/profile仍未验，CTL整体不能标完成。下一400-16可信本地broker交接适配器先Spec/Diff，先离线验证单会话/选源晚结果/撤销/到期，真实用途/G0/资源/设备另审。