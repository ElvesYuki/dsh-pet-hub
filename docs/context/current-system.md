# 当前系统（2026-11-18）

签名 DeepSeek Harness Desktop `0.2.2-rc.3` 现场留驻主 Hub `0.0.4` 和登记包 `0.0.2`，原 profile 补丁逐字节一致。「设置 → 桌面宠物设备」主卡已实测自动更新电池、离页再进重新采样、免码查询和持久绑定核对。再次离页后，连续 6 秒 12 次宿主检查均未见串口占用。归属未确认时查询结果独立展示。主包 `0.0.2` 已备份供回退。[电池实装验收](../reports/2026-11-18-vp8-desktop-battery.md#dsh-页面现场验收) · [合并页实装](../reports/2026-11-17-vp8-desktop-device-page.md)

Connection owner 继续自动托管免码 STATUS2 查询。此前已在真实 Desktop 验证停用释放 USB 和 IPC、重新启用恢复只读实例。应用退出由宿主测试覆盖。原手动命令和 pet 0.4.8 保留，显式 `start-wave` 继续使用原授权码。[免输入实测](../reports/2026-11-17-vp8-desktop-no-code.md) · [托管生命周期](../reports/2026-11-17-vp8-desktop-managed.md)

现场在原作用域验签、正常退出 DSH 释放登记 owner 后，用当前 CLI 完成长期私有备份，并核对六项文件的内容与权限。重新打开同一签名 DSH 后，profile 配置和原绑定索引逐字节一致，原作用域再次验签通过。实际设置页「验证绑定」确认设备持久绑定，随后串口释放。现场继续使用原活动目录。原路径恢复已在同机合成 Keychain 验证，现场恢复尚未执行。[现场备份与重开复查](../reports/2026-11-17-vp8-keychain-continuity.md#现场凭据备份与重开复查)

VP8 一键 USB 真板首绑由 CLI 完成。固件任务核对了 NVS 持久记录、拔插、设备复位及原 Keychain 引用。历史 BOOT 入口保留，未登记设备从真实设置页发起首绑仍待验证。[首绑实装](../reports/2026-11-17-vp8-usb-desktop-hotload.md)

1.75C-EN 现场运行 `0.1.6-battery-usb-pair-test`／`ota_0`，已从 `0.0.4` 设备页免码查回。固件任务实测恒流、恒压、限流及 60 秒内 13 次 5 秒 USB 轮询。57 个素材保留，`0.1.5-usb-pair-test`／`ota_1` 是板上回退，`0.1.4` 留本机完整槽备份。旧 `56644ffd` 动作 1 与 PET4/PMA1 保留兼容回退。[USB 电池与主包](../reports/2026-11-18-vp8-desktop-battery.md) · [0.1.4 OTA 验收](../reports/2026-11-16-vp8-ota14-dsh.md)

400×400 离线素材库共有 96 段。0–77 引用冻结的原 78 段，78–95 为从 dsh-pet 0.4.9 全部 114 段源素材中筛选的 18 段 VP8，已通过宿主双解码。当前板上可直接播放 57 段，新增片段待真机安装及调度验证。[400 素材复查与补录](../reports/2026-11-18-native400-upstream-action-review.md)

日常 Personal DSH Launcher active 为 `0.2.2-rc.1`。同一设置页的一键入口已通过该运行包的临时 profile 与双端口复验。默认无可信发布，保留人工查询；只有明确配置签名元数据、发布公钥及独立 SPKI 指纹并核对镜像后，才允许人工升级。日常 profile 无 Hub，未进行安装、重启或实体设备操作。[日常部署](../reports/2026-11-16-vp8-ota-daily.md)

持久绑定在带 132 的实板候选 `2ad12eb5` 验证一次 BOOT 首绑、同 boot 管理端重开、设备软件复位后免按键续接及错公钥拒绝。NVS 记录已读回，使用隔离测试签名器。Keychain、冷断电与实体解绑待验。阶段一依赖可信 USB 和单次 ARM。[实板证据](../reports/2026-11-13-native400-pma1-tail-timing.md) · [PTY 报告](../reports/2026-11-13-native400-pbp1-persistent-pty.md)

400×400 compact78 的 sender 已通过宿主 PMA1 认证 TCP/NOR、动作 1/11 和同配对代、boot、job 收据查询。管理端 PBP1 独占适配器及显式 `--button` 已通过 PTY 和模拟 USB，实体 BOOT 配对也已在两轮 PMA1 联调通过。按键模式保留身份与 HMAC 核验，等待匹配 Active 后发布 RAM 租用。完整保存、读回、维护画面停顿与常驻 LAN 准入待验证。[按键验证](../reports/2026-11-12-native400-pbp1-button.md) · [串口验证](../reports/2026-11-12-native400-pbp1-serial.md)

`2cc7060d` 为历史 PET4 回退版本。旧 PMA1 持久绑定及收尾限时证据适用于当时 PET4 候选。[当前 400 基线](native400-baseline.md) · [历史快照](history/tcp-media-evolution.md)

PTC1 播放控制继续走原 shared owner。TCP29 已在隔离宿主验证原创 HTTP 来源、权限 IPC、TCP 控制和退出。真实 pet 身份及自然状态变化仍待验。 TCP19 显式 shared 策略可在原剩余 TTL 内恢复 intent。默认 owner/legacy 仍用人工 reapply，GET 保持只读。[TCP29 报告](../reports/2026-11-06-tcp29.md) · [owner API](../protocol/native400-tcp-owner.md)

400-15验证发生于2026-11-03，2026-11-04完成证据与上下文收尾；安装版本结论属于该次只读快照。

本页只描述当前结论；阶段演进及当时限制见[历史](history/system-evolution.md)，实施证据见各报告。开发与上下文规则见[开发规范](../rules/development.md)、[上下文维护](../rules/context-maintenance.md)。

## 当前开发目标与外部基线

1.75C-EN 继续使用原生 400×400 素材，在 466×466 屏幕的 (33,33) 显示。Hub 目前将 MEDIA2 限定到动作 67 的固定版本，旧 UPDATE1 对应原动作 1。此前 PET4 compact78 的 78 动作、严格导入、离线窗与调度证据保留，360 媒体和分层角色保留各自坐标。[当前 400 基线](native400-baseline.md) · [PET4 400 对齐证据](../reports/2026-11-02-native400-manager-alignment.md) · [360 兼容回退](native360-baseline.md)

以下既有阶段结果保留其当时的传输、外部快照与验证范围；当前路径/版本/门禁以上述最新端侧快照和[共同G0](plans/round-pet-g0-handoff.md)为准，旧TLS证据不再作设备前置。

## 本仓库已验证能力

- Node ESM，Node 24.14.1/npm 11.11.0，零第三方依赖。Unix socket bind选主、Bearer与实例握手、私有目录、配置CAS及原子rename已在macOS隔离环境验证；异常遗留明确阻塞，不自动回收。
- pet公开HTTP串行来源、页面getState适配及多页租约已实现；默认disabled，无自动DSH发现。2026-10-29核对的pet快照缺少getState，真实HTTP当时仅核对过空闲响应；本片未重查现有pet，真实状态变化和共存仍待验。[上游核对](../reports/2026-10-29-upstream-reference.md)固定提交8963384e33400d0c83965bd82f98bd8f81d22863，不能仅凭0.3.8版本推定接口一致。
- React管理组件、DSH设置槽与白名单IPC代理及候选构建已在独立Web profile加载、热重载、卸载通过。该次实测环境DSH 0.2.1-rc.3/pet 0.3.8/macOS；当前安装DSH已只读核为0.2.2-rc.1，不能继承该动态兼容结论；desktop未安装/启用。见[宿主报告](../reports/2026-10-29-isolated-host.md)。
- core注册表、DeviceModel、IntentScheduler及SIM-01–30+4已验证；显式simulation通过真实UDS/IPC/UI装配两设备、CAS、控制与虚拟断连。默认devices=[]；所有模式deviceTransport=false。旧S1/S2的240合成fixture不代表360实物适配。
- 多规格目录、推荐、每设备确认/CAS及持久偏好已接simulation IPC/UI；schema2区分屏幕、素材、RAM与Flash容量。466/360中心偏移53已离线验证；旧DeviceModel仍不接受schema2；独立[Native360资源模型](../protocol/round-pet-a1.md)已实现单RAM＋4/1 Flash/恢复/lease，A6已接隔离模拟执行/状态链，仍未接实体执行。见[素材契约](../protocol/material-variants.md)、[偏好报告](../reports/2026-10-29-material-ui-storage.md)。
- SIM2导入与真实PET4/LZ4/XOR/CRC、RGB565解码已离线验证；真实240/360各46动作全帧审计通过。snapshot保留32MiB快照限制；显式streaming通过后台线程及私有CAS仓库验证完整360库46动作225509627B/11086帧，不保留全库字节。见[PET4报告](../reports/2026-10-29-pet4-offline.md)、[流式仓库报告](../reports/2026-10-29-material-store.md)。
- 仓库版本登记、默认1GiB逻辑配额、预留和显式审阅清理已实现；持久选择/激活、actual/pending、候选及校验任务受保护，未知引用保守拒绝删除，无自动逐出或坏档修复。见[生命周期](../protocol/store-lifecycle.md)。
- package_schema=2完整角色包支持8语义、逐动作fps/frames及loop/once_hold/once_idle；每设备worker全包复验和首帧后原子写确认指针再切换内存。失败/取消保留旧角色，提交后拒绝取消；缓存恢复不依赖原导入目录。角色指针与旧偏好分开，不是双文件或设备Flash事务。见[角色包](../protocol/role-package.md)。
- PET4当前像素经worker、鉴权IPC与同源代理显示画布；请求身份/代数校验、每设备一个在途，显式开启且虚拟时间手动推进。固定frame响应上限512KiB（400 M2扩展），其余64KiB；store校验120秒/RPC2秒期限、8在途上限及显式复验恢复已实现。见[帧预览](../protocol/frame-preview.md)。
- PET4缓冲复用与有界回执已完成：命令/意图各256条FIFO及高水位；acquire保留最近成功操作；session满16仅淘汰非活跃lease拥有者；sequenced触摸256条窗口以uint64 event_seq拒绝旧事件。无seq入口仍256上限且不能混模式；发现/绑定上限保持。见[回执契约](../protocol/resource-replay.md)。

## 最新验证与限制

400-14[临时交互宿主](../protocol/native400-interactive-host.md)继续有效：显式controls策略进入sourceKey，只UDS赢家装配13 controller；独立内存凭据/固定实例IPC、可信resolver/精确Origin与白名单GET/start/cancel，4KiB/2.5秒body门禁。UI私有选择/原请求确认、generation、取消待退出与unknown保持。15只补审阅与验证工具，不添加正式broker、不放宽权限或改recipe/wire。

400-12[选择绑定](../protocol/native400-source-selection.md)与400-13[内部控制器](../protocol/native400-review-controller.md)继续有效：元数据短fd/opaque绑定、实际reader首读前核指纹，单会话/选择/任务、高水位ACK去重/定向取消/同步授权提交gate、首次失效锁存/迟到timer/实际退出。400-14通过私有通道交接选择引用，不写global status/DOM，不将内部会话或临时cookie测试等同DSH用户授权。来源map/journal与设备证据等级保持。

400-11[操作契约评审](../protocol/native400-source-review-controls.md)仍是后续控制设计依据；OBS-01选择间隙已由400-12可选绑定补齐，OBS-02无job关联cancel已由400-13控制器同步匹配job补齐。两份独立批准和global status无授权引用的边界保持，40项整体清单不算全部通过；本片只覆盖内部选择相关子范围。

400-10[只读宿主/API](../protocol/native400-source-review-host.md)继续有效：现有UDS选主/鉴权、仅赢家开400-09 owner、只读status/双白名单代理和JS候选真实fetch展示；重开历史、取消/unknown/坏档、实际fd退出后释放UDS保持。只是临时宿主验证，未安装到DSH；默认无该slot，无CLI/config/自动启动或设备通道。

400-09[存储/复验API](../protocol/native400-source-review-storage.md)继续有效：私有有界CAS journal、文件/目录fsync、uint64高水位与unknown冻结，重开须独立批准/实际源复验；失败历史、取消真实读退出和只读投影保持。400-10只装配既有owner，没有改400-08reader或400-09持久格式/实现，不提供跨进程防整盘回放、全媒体/设备证明或硬I/O退出上界。

400-08[来源审阅API](../protocol/native400-bootstrap-review.md)继续有效：strict V2双根/uint64/floor、N_boot与P/M/N分域；私有精确28MiB的整cache及逐物理payload SHA，未知I/O不fallback、文件稳定/实际取消退出均保持。400-09仅扩展历史map验证及候选保存/展示，原recipe输出与reader未改，无全媒体或设备证明。

触摸立即fence旧frame，等待已接纳GET真实退出、丢弃旧段后使用显式本地4号源；新remote只accepted/deferred_local，重复触摸不排队/延deadline，取消remote保local。local结束从0重验最新仍有效base，已完成once_hold/失败/取消/到期不复活；合法renew不延原作业截止。loop等末帧间隔及完整校验，欠载保front/暂停elapsed并重填。已验118/117/4917ms、241/240/10042ms、>1MiB样本、在途替换/取消/关闭、断线/休眠/撤销和新hello不重放。新投影以周期verification floor拒绝迟到local/触摸时remote当前显示；关闭无条件标历史。host通用Registry只保最高历史阶段，当前画面看400投影；旧400-04默认路径37专项继续回归。

本地源无则拒绝touch，不代表真实ROM/Flash；本轮无真实触摸/OS源/自主后台timer，host与peer须可信代码同时选策略，hello未协商正式调度能力。storage/inventory0保持unsupported/null，不造已知空或saved/offline_available；A8只读根，无400保存/淘汰/gate/持久恢复。控制轮询/IO/续租阈值是离线假设；单TLS/HTTP、原guard/每块新scope和120秒作业截止不放宽。源码快照309条中仅5个已有文件修改，其余304条SHA保持，新增5个源/fixture/测试/CLI，未扩依赖。真实用途/正式profile/N、双遍与每loop成本、可信时间/凭据/资源/G1-G2/400@24仍待W01–W10，下一先共同G0/资源评审，不以测试数量开设备窗口。

400-03[独立review协议/94正116反](../reports/2026-11-02-native400-03.md)继续有效：verified-replay固定、cap3/playback3/display3/storage0/inventory0/cancel2，4项20页、118短尾、local asset.verified/verification_seq及取消io_exited独立表达。固定极值正例3792B，补测显示3877B/最大descriptor尾页3039B；正式策略/profile/N未共同签核。

400-02[纯core帧窗口](../reports/2026-11-02-native400-02.md)继续有效：1MiB实际ring/file分离、3RGB/history/tile、24帧准入/36高水位、118/241/extra/XOR、全验后重读＋帧SHA和独立首帧/欠载/迟到平移/失效/同步退出。最大逻辑typed-array2194816B（含额外7712B收据）不作ESP/TLS/RSS硬上界；显式渐进仍只离线，不进入新wire；persistent=null、不输出保存/库存成功。400-04已接默认OFF临时session/guard/仓库/承载与actor，生产入口未接、未导入真实媒体或测试设备。

400-01[身份/recipe/严格导入](../reports/2026-11-02-native400-01.md)继续有效：createNative400Import复用既有A2仓库/worker/保护，P/M/N_offline与独立用途批准、全媒体证明/无源重开保持。真实compact78仍仅候选P=52b2f6cb…/M_device=094e69be…/N_offline=dd0f19bf…，未建真实批准/导入；共同hub N未定，外部已装N_boot与此候选分开。旧尺寸只备份回退。400-03 review合同/向量已具备，400-04临时链已具备，400-05离线调度已完成；策略/正式profile共同签核仍待完成；固件400 Store/单owner/TLS/可信时间/凭据/G1-G2及24fps另交，不从本模型推导准入。

[400规划核对](../reports/2026-11-02-native400-manager-alignment.md)的媒体来源证据继续有效：78文件348737057B/18675帧、1019额外tag0、最大24帧payload688702B；本轮未再读真实媒体/产生用途批准。原“USB窗口执行中/缓存仍360”的外部快照已由上方400-06核对替代并归档。6882无网络显式PSRAM2322168B/20160B scratch/16＋8KiB栈及动态门禁仅对应其报告；新预取源码/TLS必须另绑新预算。schema2原义、400-02/03及review N不变，实际N_boot已装不代表hub N/策略共同采纳。


2026-11-02 [400全量压缩版批准合并](../reports/2026-11-02-native400-compact-merge.md)已完成：用户确认全78压缩优先版，新规范平铺库／role8／完整library78已重新冻结摘要和视觉批准链，总348737057B（332.58MiB／比旧版省14.71%），78全部≤旧cap。新库18675帧CRC／索引／像素SHA／seek通过，旧sim_A cap下完整78包激活／全部动作／IPC代理／缓存恢复通过；check与含构建test880/880通过（新增3项，含同期切片）。全部78文件及八语义index均更新，设备侧使用[交接](../protocol/native400-device-handoff.md)顶部新身份；旧库与对照保留，未写固件／设备／正式360。此前[全量实验](../reports/2026-11-02-native400-compact78.md)及877项回归为阶段证据，视觉待审阅／未合并结论已被本次用户确认替代。

2026-11-02 [G0-R7 gate失联/暂停一致性](../reports/2026-11-02-round-pet-g0-r7.md)已补显式新wire executor的单个本地提交任务：失联/lease/暂停清旧权威但保留gate完成能力，新会话等实际同步commit退出后查新库存；旧saved/playing拒绝、unknown不重复写、close不提前释放medium。30专项、check及全套940/940通过，监督正常/取消清理通过。A1核心、R3修订2/80正62反、session/guard与宿主R4/R5不改，旧executor缺省保留；R6完整下载/校验/独立首帧/保存/淘汰/重连保持。等待4000ms仅诊断，不放槽/延TTL。原缺口已[归档](history/round-pet-g0-r7-evolution.md)。这是同步内存Flash模型，ESP异步RTOS/物理掉电/休眠及硬时限仍未验；共同G0/许可/资源证据核定已完成本轮只读范围，这些原则保留，下一按400-01至04适配后再审真实窗口，默认OFF/无设备或生产入口不变。

2026-10-30 [400批准合并](../reports/2026-10-30-native400-merge.md)完成：check（仅.mjs语法）通过，含构建test787/787通过，新增3项身份／批准／拒绝覆盖测试；真实78素材18675帧及旧sim_A cap下完整宿主激活／78动作／缓存恢复通过。仅宿主离线验证，无设备／固件／正式360或运行服务变更。下列其他切片数量保留各阶段语境。

G0-R2执行边界已完成本轮离线范围：[35专项与实施报告](../reports/2026-10-30-round-pet-g0-r2.md)、[API](../protocol/round-pet-g0-r2.md)。check（仅.mjs语法）与含构建test784/784、独立CLI35/35及SIGTERM清理通过；仅原创模拟素材/虚拟时钟/临时存储、UDS与loopback TLS，无真实通道或外部配置变更。当前工作区回归包含并行400候选，阶段旧数量不追写成最新。

2026-11-02[共同G0/真实许可/G1-G2核定](../reports/2026-11-02-round-pet-g0-closure-review.md)完成本轮只读范围，先补Spec/Diff。38份选定固件证据/22份R1共有文件仅矩阵内容变化；期间matrix/todos又并发更新，已重读新增400宿主报告，生产Store/HTTP/播放器与旧G0回复保持。真实46 PET4共225509627B的F/长度及三元数据原SHA、P=3afe4578…/M=9045bd6b…/N=dfc829e1…/source=a6a2ddae…复核保持；R1全11086帧/源blob证据沿用，未重复解码/源视频读取。固定上游README及ZipZipPipe原声明/CC官方条款已直接取得，非商业/署名/SA原文缺口已补，license_ref保持upstream-reference-only。**内部offline-validation approval/真实A2导入、联合G0签核均未完成**；G1 fc55缓存挥手后SDK低位46527＜49152B/写尝试0，M2–M7缺证；G2无可交付设备TLS/时间/持久凭据/实际退出报告。该360来源审阅作为兼容记录保留；当前下一入口已转400身份/能力/完整性/新wire分片，不重复R7。check及含构建940/940通过（无新增测试）；[证据摘要](../protocol/vectors/round-pet-g0-closure-review-v1.json)、[被替代记录](history/round-pet-g0-closure-review-evolution.md)。

[C01–C12交接](plans/round-pet-g0-handoff.md)已由G0-R2更新执行边界：A5内部显式first-window-review/1在入队/派发限制cached0/11，remote4及其他拒绝、保存禁用，profile固定并进入选主身份，内部manualChoices投影供未来UI。local4首ACK计时/latest/会话失效用有界core模型对照；A1显式gate后取消可继续saved但不能重活旧播放，recoverStorage只出完整库存，I/O未知不降级/不补saved，root floor保持。真实UI/触摸源、固件gate同步/结果分类仍未实现，旧360备份候选缺省46且生产通道OFF，当前400离线入口已独立实现。R3表达/字节向量已由R4修订2补显式离线profile，临时adapter已将hello绑定原session、用A3显式入口投影schema2；旧A4/旧A3 schema1仍拒绝新字段。R5已接临时GET/分段，R6已完成新wire的A1 actor离线全链，R7已补同步模型gate失联收尾，本轮已只读核定现有证据，400-01候选身份已有，400-02/03已有本地review模型/新wire，临时400装配已完成本片范围，400-05调度已完成，下一实际周期预算/固件共同答复；联合G0未关闭，G1/G2/窗口独立。R1原未实现摘要已[归档](history/round-pet-g0-r2-evolution.md)。

2026-10-30 A10局部减量：check（仅.mjs语法）与含构建test全套730/730通过，新增24专项；独立CLI24项/新鲜full-reduced四档同负载及SIGTERM清理均通过，不导出部分证据。见[报告](../reports/2026-10-30-round-pet-a10.md)、[API](../protocol/round-pet-a10.md)、[替代记录](history/round-pet-a10-evolution.md)。显式rootState默认reduced，私有携带同次完整校验/编码的digest供实例revision比较；不变根锁内完整验证/CAS/全部内容一致后省编码，full参考/回退保留。v1与v2格式无迁移，动态授权/提交顺序/队列/TTL保持。

新跑full/reduced各v1/v2×1/64登记，每档3轮、同15控制/51 exchange/541689B/135写调用，只有D一个TLS peer。v2两策略均完整load/hash308次、64绑定逻辑读24025078B、7次文件/目录同步；额外remember摘要315→0（同次已验digest复用315），实际编码8→7、64档624365→546431B，省一次77934B noop编码。动态日期/撤销检查次数相等，新scope/4KiB仍完整读盘，非mtime/TTL跨请求快路。时间是宿主固定顺序样本，1绑定commit/window也可上升，不作物理上界/稳定提速保证。

最大字段容量仍64登记/63有根、129724B，第64条首次root超131072B并保持文件；不能承诺所有极值64根。A9条件预算保持：旧B1900假设加R100ms得RTT4002，虽lease有余仍超4s回执。server2000、fixture client1500、ack4000、lease15000独立约束；坏档/旧revision/锁内冲突/unknown/撤销/块间过期/边界超期仍关闭，不延TTL。

A8显式同文件绑定/根CAS、私有候选后durable发布、新owner恢复继续有效；默认v1不迁移，v2仍OFF/新库存/控制，无公开清floor/rebind/生产listener，deviceTransport=false。新进程不能识别同盘合法旧文件回放，SHA/fsync不是批准或物理掉电证据；同步FS不可由JS timer硬中断。局部重复工作切片已闭合；R3表达/Node-C++宿主向量已交付，R5临时GET/分段已实现，R6执行模型对照已完成，R7同步模型恢复已完成，本轮证据核定后仍待固件共同答复/资源方案与真实包独立用途审阅输入，冷盘/真实时延/可信锚、G1/G2及设备窗口保持NO_GO。

2026-10-30重复复验减量：check（仅.mjs语法）和test（含构建）全套399项通过，新增14项专项；独立CLI14项及两个SIGTERM时点均清临时环境。mTLS实例内最多64条静态证书批准缓存、每次动态根/叶日期和绑定/撤销检查；session默认scoped，每个同步业务调用共用一次完整验证revision，不跨await/请求/4KiB写块。新scope完整读盘验权限/锁/schema/摘要，无mtime/TTL快路；full对照/回退保留。见[报告](../reports/2026-10-30-verification-reduction.md)、[契约](../protocol/verification-reduction.md)、[替代历史](history/verification-reduction-evolution.md)。

同负载四档真实loopback TLS各4轮原创70001B，素材字节/写块/控制顺序/动态检查数对等：64条绑定、4KiB/32KiB档元数据load328→100、逻辑读取6140160→1872000B（约减少69.5%）；warm静态验证108→0，初次hello/acquire静态验证另记full10/scoped1。时间未知/过期、外部撤销/轮换、坏JSON/摘要/schema、删除/symlink/权限/锁、freeze/commit_unknown和休眠负例仍拒绝下一块。内部X509不暴露，关闭清缓存；同期其他进程在scope首次读后的更改须下一scope发现，不是原子跨进程撤销。没有据短样本修改物理时延参数。

离线参考lane已验证单在途、控制FIFO段边界优先、控制等待8/素材等待1、预算外冻结和实际工作结束后回收；未装配生产队列。示例含活动控制N=8、每项1000ms及既有其余假设，B9900ms/host RTT19810ms/发送跨度5070ms，无法保证最坏续租可用。样本max/桶分位不能替代延迟上界，未知盘/CPU停顿、网络重传/漂移仍NO_GO_UNTIL_MEASURED。

既有[服务选主后managed review装配](../protocol/service-power-capacity.md)有效：仅UDS赢家创建元数据/会话owner/观察源，两进程只启动一个源；配置不同拒绝attach、半初始化503、挂起UDS统一期限失败不回收。默认/CLI/插件不启用，deviceTransport=false，无设备listener或旧数据迁移。

macOS原生IOKit helper已临时编译并在真实服务owner注册ready、退出及清理通过，不使用Electron私有入口/阻止休眠/电源设置。受控事件验证暂停清租约/任务，恢复需可信时间与新TLS/hello/acquire；坏帧、失联和迟到回调保持blocked。未主动让电脑睡眠，真实睡眠前送达及唤醒与网络回调先后仍待验，注册成功不证明物理时序安全。

managed会话使用同socket/context/generation的一次性不可序列化admission，不累计全部历史ID；320次真实串行TLS重连已验证每次session/pending/task及历史集合回落0，旧proof/context/伪造票据拒绝。旧直接context入口仍限256。逐块证书/磁盘成本及减量现有上述同负载宿主样本；16设备并发、多日/RSS、冷盘和物理延迟上界未验。签名/密钥、物理电源周期、ESP/Flash/v5门槛保持。既有[绑定/会话CAS与故障恢复](../protocol/session-consistency.md)能力有效，最后actual与历史观测仍区分。

既有[离线认证/TTL](../protocol/offline-auth-v5.md)和[租约预算](../protocol/lease-budget.md)结果有效：管理设计500ms轮询/1000ms分段加假设排队/网络/处理，B1900ms、host RTT3802ms、15秒TTL/双端500ppm/margin10发送跨度13074ms；这些不是loopback或真机硬上界。现行v5只读基线仍为Bearer、300ms循环末尾等待及整文件下载，没有管理租约；实物peer/报告与v5互操作、漂移/最坏延迟实测未验。

此前[30分钟墙钟报告](../reports/2026-10-30-wall-memory.md)固定原创240/360小PET4、1Hz：1801样本/1770帧/59次换包，RSS峰值180.48MiB/末值154.69MiB且资源已清理。它不代表后续guard/认证/会话owner、完整46动作/分层角色/UI共存或硬RAM/多日耐久；本轮未重跑长测/素材/浏览器。真实360全库仍见[资源报告](../reports/2026-10-29-resource-replay.md)。架构/契约自动门禁未实现。

分层角色包最新：[真实导出](../reports/2026-10-30-layered-character-export.md)。L2真实纯数据包已导出并独立L1复验：21主层、33张去重PNG、37文件、390634B（约381KiB），素材原字节/有效绑定与v4一致，两次包摘要/回执一致。L2[独立加载/首帧切换](../reports/2026-10-30-layered-character-loader.md)已完成：HTML目录选择、完整校验、取消/旧结果保护、失败保留和Bitmap释放均验证；14段4046次扫描与v4一致，该加载切片全套328项通过（含当时其他并行切片）。[使用/API](../protocol/layered-character-loader.md)；[L3宿主验收](../reports/2026-10-30-layered-character-l3.md)已通过：4046帧RGBA/姿态/语义零差异，复制包重开idle重建、失败/取消保留及重复换包回收均验证，L3阶段全套354项通过。当前[高分屏预览](../reports/2026-10-30-character-hidpi.md)入口.cache/layered-character/hidpi-preview-v1/index.html：DPR显示缓冲、2倍平滑/像素检查已实现，360大小/位置/素材与规范4046帧保持，该高分屏切片全套375项通过；生产接入、跨浏览器/设备、音频及长期性能仍待实施/验证。当前包位于.cache/layered-character/character-package-export-v1/package，回执在包外；behavior接入及L1已完成，L1审计本身仍不代表播放，实际独立播放证据见加载报告。原46个PET4动作保持独立。

制作最新：[挥手轮廓修订](../reports/2026-10-30-character-wave-contour.md)。挥手过渡已改为单轮廓形状插值＋轮廓内颜色过渡，替代两张手臂直接淡化；袖口/手掌双轮廓明显减少，细部自然度待确认。360大小/原点、原素材及挥手时序保持，14段4046次身体覆盖/安全区采样候选为0，该预览阶段217测试通过；无设备适配，音频仍延后真机。原11动态发束/46动作保持；本次是桌面局部形状计算，未测设备帧率。旧混合方式见[演进](history/character-wave-evolution.md)。

四态最新验证：[桌面候选报告](../reports/2026-10-30-character-states.md)。四态桌面候选已实现：待机/思考/工作三基础态与单次完成反馈，切换保留弹簧连续性，触摸结束回到最新基础态。360基准/原点、全部11发束及既有贴图保持；10段2890次覆盖/安全区采样候选为0，该候选阶段检查通过（见报告）。视觉辨识度和自然度仍待用户确认；真实音频同步继续延后真机阶段，原46动作保持。只接离线合成输入，未接真实pet来源或设备；工作态为既有整臂小幅交替，不代表打字或大幅挥手。

## 设计与实物待验

- [400原像素素材候选](plans/native400-material-spec.md)：400裁区(124,-6,400,400)、466屏偏移33，无额外安全圆；用户已确认[全量压缩版并合并](../reports/2026-11-02-native400-compact-merge.md)。78文件348737057B均在旧cap内，最大67号5569645B；全部18675帧及宿主78角色激活／恢复通过，42仍118帧。新规范库及两个角色目录的摘要／来源链见[当前交接](../protocol/native400-device-handoff.md)，全部78与role8身份均已更新；旧12项优化合并库保留为历史／回退。400为当前管理端开发目标，设备侧窗口/显示/性能及Flash/TLS继续验证；360/46留兼容回退、分层360保持。黑边易压缩不等于无解码／内存成本。



- hub-device/1、新playing首帧语义及v4/v5迁移仍属设计/离线范围，不复用旧固件ack冒充新确认。未实现真实设备通信、身份/心跳、绑定、素材安装、实体Flash事务或BLE；A1逻辑Flash已接A6模拟执行链，仍非实体Flash。
- HTTPS/mTLS单连接已完成Node loopback互操作；ESP承载、可信时间来源、凭据持久化/撤销、内部TLS峰值和恢复待验，NO_GO_UNTIL_MEASURED。旧140KiB/32KiB和6851241B预算为历史输入；前瞻P2显式PSRAM6916777B含64KiB read-ahead，P3内部最低59035B也不是TLS可分配量；保留固件内部≥48KiB等更严格门槛，详见当前基线。外部production源码曾并发变化，实物操作前须重新冻结核对。见[认证评审](../reports/2026-10-29-transport-auth-review.md)。
- Windows、Electron发行、签名/权限、Keychain、崩溃自动恢复及其他DSH版本未验；官方全量schema导出的Agent preset carrier诊断不构成修改宿主的授权。
- 保持360基准/原点、46动作及全部11发束；[无音频说话候选](../reports/2026-10-29-character-speech-preview.md)新增微张/张口/圆口，与原闭口/微笑共五嘴态。16个既有表情贴图SHA保持，新增变化限定嘴部；纯逻辑generation控制开始、暂停闭口、换句与取消，拒绝旧控制，说话只接管嘴部，眼眉/触摸/自然弹簧并行。浏览器按钮/回放/恢复、8段2312采样低覆盖/越圆候选为0及188测试通过。当前仅桌面预设开合，不含文字发音、音量驱动、真实音频同步或设备播放；形象/观感/发际边色仍待用户确认，旧稿保留。用户已决定将真实音频播放/嘴型同步延后至真机阶段，现阶段保留无音频预览，不继续桌面真实音频同步原型；恢复门槛见[规划第4节](plans/layered-character-plan.md#4-对话与口型)。
- 新代码MIT；真实动画许可独立且非商用，不提交素材大文件、原始响应、凭据或本机运行配置。不改固件/pet/bridge，不自动安装、启动或烧录。

400-06共同G0的[D01–D09](../protocol/native400-g0-review.md)继续作为待双方决定：N_boot与review P/M/N、Flash可信链、重复touch/local自主与finite remote寿命、正式能力/凭据时间/网络资源仍未签核。D07的条件算术已由400-07补实际宿主对照和检查，不能据此称端侧最坏上界已测。400-08只读映射和400-09保存/复验已离线完成；400正式writer/G1-G2/24fps/真实用途与设备窗口另审。

400-07完整周期预算/24专项仍有效，现全套包含其回归；6720提前renew/原4510 floor、GET-only/整体exchange与源/累计compute、严格计划必要条件和170段先job到期均保持。400-08未接生产/IPC/设备来源，也未重验真实cache或全帧媒体。400-09候选保存/重开和只读槽已验；400-10已验显式临时status/owner退出，400-11已完成拟定操作契约评审，400-12已实现可选内部选择绑定，400-13内部控制与400-14临时交互接线已离线完成，400-15已完成评审与共享UI真实浏览器验证，下一400-16可信本地broker交接适配器先Spec/Diff；继续不从来源审阅生成设备库存授权。
