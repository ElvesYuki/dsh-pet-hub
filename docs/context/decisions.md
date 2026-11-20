# 决策（2026-10-29）

## 2026-11-20 管理端与圆屏固件同仓

用户确定本仓库为后续固件、管理端和设备协议的共同开发入口。应用按板型归档，播放尺寸在素材规格目录单独管理。原仓保留固定提交和过往实验，现有设备报文、绑定、素材身份与分区按当时契约保留。版本演进使用独立报文字段，OTA 发布版本由构建提供。 [迁移记录](../reports/2026-11-20-firmware-repository-migration.md)

## 2026-11-11 独立 TCP 素材维护会话

HTTPS 候选在 OPEN 资源准入退出。首轮用终端主动连接的独立维护会话分时维修 1/11，沿用 PTC1 的播放控制权限与缓存 V2 布局。Node/C++ 宿主已对齐 16 B 线级 job、最多 4096 B payload、单 DATA 在途、暂存写入后 ACK 和同 boot 显式查询。产品 owner 的写入许可和 STA 预算按实际接线复审。[协议提案](../protocol/native400-tcp-media-draft.md) · [宿主 NOR 验证](../reports/2026-11-11-native400-tcp-media-nor.md)

## 2026-11-06：跨进程传输不序列化原能力

TCP29采用genuine Request/audit/shared owner留可信父模块图，内部窗口brand/单活loan取得原scoped client；子进程无bearer/issuer，固定代码经有界IPC转发原GET/base/cancel，保原UDS/CAS。真正construct/start、实际HTTP/TCP与退出通过；复用快照/原loader，不用JSON重建或自动approve。父失联/强退明确分层unknown，host不关借用窗口/manual。[API](../protocol/native400-pet-hold-host.md)。

## 2026-11-06：有限自动保持不拥有共享窗口

TCP28将45秒监管/来源/桥接装配为显式本地运行器，只借用已授shared client，拥有自己的source/bridge/timer。manual接管后停止自身读写且不撤人工目标；close不能结束共享组、撤他人grant或关闭外层窗口。unknown仍原body/原截止，BASE提交前核截止，不能靠迟到timer续期。固定副本实际宿主运行/真实加载身份仍待，不从本片测试推出现场准入。[API](../protocol/native400-pet-hold-run.md)。

## 2026-11-06：准备材料与运行准入分离

TCP27复用快照/Node加载审计，只在候选私有副本import bridge并核静态pins，固定device_admission=false；没有新的启动/批准接口。实际加载身份、来源/用途/fresh有限window与device资源/恢复须分别取证。有限窗拆手动准入与真实来源片段，不重启观察或延TTL等自然迁移；具体[清单](plans/tcp27-window-runbook.md)。

## 2026-11-06：采纳保位续租v1

TCP26采纳终端native400-preserving-renewal/1，合法同目标BASE保持播放实例，latest命令与起始stamp分离；回执只来自真实模拟frame0，旧/同ms draw每cycle消费一次，loop准备与请求去重分离。冻结C++24步与Node设备/播放oracle及实际host通过，保留A/B默认与有限期限。无新协议能力可探测，真实准入须双端固定指纹/实际加载身份和有限窗口，不能将静态构建或宿主当实屏。[当前合同](../protocol/native400-preserving-renewal.md)。

## 2026-11-06：明确选择A端侧仲裁

TCP25按用户确认改为显式endpoint-arbitrated，touch不停止新鲜受权自身目标的有限续租，EOF回最新有效remote；默认event/observed-local保持，不伪造clear，不要求B查询/强制autoRecover:false。独立三期限/CAS/unknown/失效不复活保持，shared取消支持down/paused逻辑清理。该条原保位代码阻塞已由TCP26终端候选/管理端oracle采纳关闭，实际设备准入见下方新决策。[合同](../protocol/native400-endpoint-arbitrated-hold.md)/[旧B决策归档](history/tcp25-evolution.md)。

## 2026-11-06：有界hold与可信活性

TCP23原observed-local分支（TCP25的A例外见上）只在可信source收据、独立lane/页面权限/观察窗口、自己仍持有目标、priority明确clear时以新有限BASE保持。默认event不变，未知缓存活性/触摸态失败关闭；不续来源或授权窗口，不靠重复ACK续TTL。真实loaded版本和自然任务迁移仍待，不以候选SHA或空闲样本代证。[合同](../protocol/native400-pet-hold.md)。

## 2026-11-05：Connection候选与独立控制许可

TCP20选择公开Connection exact Fetch承载候选，POST streaming并在hub限制4KiB/2500ms；原raw严格Origin保持，不用去掉校验适配Desktop转发。Connection owner准入与hub来源/用途/页面许可分开，callback无Peer不推导自然人/每tab身份；可信resolve持scoped client，默认OFF、无HTTP发权。新增显式client.connection替代候选，默认bundle/peer/apply保持，两个bundle不得并用。真实浏览器已验共享行为，实际DSH rc.5 profile/身份和自定义scheme仍待另行授权准入。[契约](../protocol/native400-connection-controls.md)/[报告](../reports/2026-11-05-tcp20.md)。

## 2026-11-05：共享后台与页面权限分离

TCP19按用户决定提供显式shared模式：后台逻辑组归Node赢家/有效来源窗口，多页面各自有有限凭据；页面离开/到期不取消目标，新设备连接仍新HELLO/OPEN，仅恢复最新意图的原剩余TTL。暂停/取消/撤销/来源失效阻断恢复，GET只读。16附件/32请求回执有界，命令/凭据不落盘；原120秒窗口保持，不承诺跨服务崩溃恢复。缺省legacy/只读行为保留，descriptor/sourceKey包含新策略，不热升级既有服务。[契约](../protocol/native400-shared-control.md)/[报告](../reports/2026-11-05-tcp19.md)。产品长期会话和实际DSH provider准入时另审。

- pet继续负责DSH任务聚合；只读取workStatus.state/counter，不转发任务正文、余额、通知或宠物数据。上游公开契约提供页面服务petApi7340.getState及HTTP /state；同页优先探测getState，本机旧实现缺失该成员时或宿主/独立进程使用公开HTTP。兼容按能力与源码指纹判断，不只看0.3.8版本号。
- 原生能力通过独立辅助进程边界提供。DSH页面只承载管理界面，系统蓝牙方案优先验证macOS CoreBluetooth辅助程序；最终实现语言、签名/分发方案待专项验证，不引入未经验证的BLE依赖。
- P0选择零依赖ESM与node:test，避免锁定尚未验证的桌面框架；未来UI框架、打包器、DSH peer依赖必须按宿主实际版本精确锁定。
- P0阶段不发布可安装插件；P1已补齐候选包main/exports/bundle/client manifest并通过隔离Web profile验证，默认desktop未安装。
- 不迁移固件仓库Apache-2.0源码；独立重写协议边界最小骨架，保留现有桥接作为外部基线。
- 每个设备有独立播放状态。pet桌面播放回执与实体播放回执分离；实体预览不得写pet /anim、/work-status、/config等接口。

## P1基础设施切片

- 用私有目录固定Unix socket的内核bind作为互斥，不依赖PID锁；异常残留不自动回收。同路径的插件和独立客户端共享实例，不同隔离目录不承诺互斥。
- 源模式固定到服务生命周期，HTTP端点指纹随模式比对；附着不会覆盖服务来源或配置。页面源短租约只选一个转发者，后台用HTTP以免依赖页面存活。
- 配置CAS只保存schema/revision/displayName；不持久化来源URL或任务状态。原子rename提供进程级完整替换，未承诺断电fsync持久性。
- 当前独立服务需用户显式启动，插件仅连接；不在ctx.apply中生成子进程，以免生命周期误杀共享服务。

## 设备协议草案

- 新协议不复用v4全局回执作为身份/心跳；legacy_slot仅本地槽，明确无认证身份。旧playing定义较弱，新playing要首帧提交后才启动计时。
- 控制权最终由设备持久control_epoch+内存lease/session仲裁；hub单实例不等于设备独占。活跃同controller不同instance也不自动抢占。
- 本轮仅逻辑消息契约，承载/认证子Spec是实物准入前置项。离线模拟使用可信测试fixture，不能把fixture用于LAN或传配网秘密。
- 协议序号用十进制uint64字符串，模拟比较用BigInt，避免JS Number在2^53以上丢精度。

## S1离线模型边界

- 认证使用注入的可信验证器，默认拒绝；测试proof由WeakMap登记，不能序列化成authenticated布尔值。simulator模块从候选包排除。
- 虚拟grant expiry为单时钟模型元数据，不作为真实wire字段；S2/transport需拆分双端单调时钟。
- SIM-01–30仅模型层通过；素材用8个微型合成格式及SHA-256，不冒充46动作PET4验证。S2再接IPC/UI，实物另授权。

## S2显式装配

- deviceMode默认disabled，simulation需CLI显式动态导入且真实source禁用；相同目录不同模式不能附着，不允许IPC切换模式。
- 虚拟时间不跟墙钟走，只通过带实例/请求身份和CAS的显式advance推进；状态读取无调度副作用。
- 同动作新手动意图意味着重播，重试同ID只回原结果；冲突不自动重发。界面永远标模拟，断连动作只作最后观测。
- 仓库测试壳可只读提取本机React构建到.cache，候选包继续排除simulator和第三方测试种子；本轮不写DSH profile。

## 承载/认证离线评审

- 首选一个设备主动HTTPS/mTLS连接复用控制与分段素材，固定新origin且不代理DSH/pet；PSK留复审，不假设HTTP client已有直接PSK入口。
- 本轮只确认API/套件存在，不代表握手或内部RAM够用；当前准入NO_GO_UNTIL_MEASURED。140KiB是保守设计包络，必须测量后复核。
- 初次资源探针可在未来明确授权后只用RAM临时凭据，不等于持久绑定。正式凭据受NVS容量/保护、可信时间和撤销/掉电门槛约束，不自动改分区或烧eFuse。
- 外部175C/原生360进展与旧128分别审计；不以source/build目录或报告替代当前实物运行确认。

## 正式目标调整（2026-10-29）

- 按用户确认，首版目标改为175C原生360 production，设备已切换；旧128降为历史兼容参考。旧报告未烧录状态不覆盖用户后续确认。
- 部署SHA/分区与性能不由此推导；正式能力/预算见[基线](native360-baseline.md)。恢复保留当前原生360入口，禁止自动切240放大或RAM EVAL。
- 新迁移审查以v5为入口；S1/S2的240合成测试不冒充360覆盖，认证资源门槛仍待测。

## 多规格素材（2026-10-29）

- 同角色用多变体元数据表达；物理屏幕与素材尺寸独立。兼容推荐无副作用，用户确认按设备CAS；不兼容不自动换包。
- schema1保留历史fixture，schema2拆RAM播放与Flash缓存及明确呈现模式；旧DeviceModel不能冒充新板Flash模型。变体选择与安装/播放是不同状态。

## 素材偏好持久化（2026-10-29）

- 用独立materials.simulation.json保留模拟选择，不混入现有config或恢复播放租约；默认禁用不读取。服务取得所有权才加载/写入，文件成功替换后才更新内存。
- 每设备revision+实例约束；并发冲突刷新后人工重选，无写入自动重试。不兼容旧偏好保留可见，坏文件不静默覆盖。
- UI显示保存偏好，明确未安装/播放；preview临时目录退出清理，同目录显式服务重启才恢复。

## 离线目录导入/播放（2026-10-29）

- 目录只由CLI明确提供，index摘要与审核许可白名单来自调用方，网页不读任意路径；导入验证完保留字节快照，重启重验，不持久存源路径/素材。
- SIM2原型与真实PET4严格区分：内置PET4元数据仅规格参考，导入SIM2由每设备协调器记录模拟首帧；旧actor保留回归并单独展示。
- 选择revision/会话/意图版本隔离pending；错误素材不覆盖actual或自动降级。真实解码/安装/Flash/认证另审。

## PET4离线（2026-10-29）

- 根据只读布局/官方块格式独立实现MIT解析器，不迁入固件或LZ4源码；动画仍遵守固定上游非商业/CC BY-NC-SA约束。
- 真实导入必须全帧验证，播放按设备保有独立decoder，CRC/SHA并用；首帧解码失败不能改变actual。元数据候选没有可信文件仍不可播放。
- 46动作全帧审计不等于全库常驻；32MiB限制保持，真实IPC仅两待机、单动作测试profile，不能外推八动作角色/真机验收。

## 流式仓库（2026-10-29）

- 保留snapshot回归，显式streaming用私有磁盘CAS+一个worker，完整验证后发布目录；不扩大32MiB整库RAM快照上限。
- 主线程不接收素材字节；播放解码也在worker，异步验证/首帧受选择/会话/意图代数保护，旧结果不提交。最多两活跃decoder。
- 512MiB是单版本声明的磁盘数据限额，不是RAM预算；不宣称零拷贝/32MiB总占用。源目录/许可约束不变，孤儿回收和全局配额后续审查。

## 仓库生命周期（2026-10-29）

- 版本登记保留原index以校核manifest归属；旧缓存无可靠登记时保护，不凭目录名删除。
- 默认1GiB逻辑字节配额含全store与预留，写入前准入；不靠自动删素材放行。CLI配额必须与同目录服务一致。
- 清理需列表revision+实例+明确目标，重扫引用并互斥选择/调度；选择、最后actual、pending、当前目录和活跃任务保护整个版本。未知引用保守保护发布版本，无强制删除。
- 先隔离再复核删除；不将多项IO删除描述为可完整回滚事务，不处理同用户恶意目录替换。

## 完整角色包激活

- 完整角色契约以package_schema=2显式引入，语义/逐动作时序/循环进入内容摘要；旧包不推断升级。PET4仍必须实际24fps，逻辑fps范围不是格式扩容承诺。
- 每设备已激活角色使用独立role-activations.json，候选从已登记CAS版本全量复验/首帧后先写确认指针再切换内存；失败保留旧角色，提交后取消不是回滚。旧素材偏好继续独立，不宣称双文件事务或设备Flash原子性。
- 已确认缓存可脱离原目录恢复，重启和重连只恢复当前自动语义，不恢复旧手动命令/播放进度。候选单任务、每设备独立worker，资源上限和长期回收仍需测量；持久指针及候选固定保护仓库版本。

## 离线像素与恢复

- 当前帧走固定鉴权/同源POST接口，绑定确认角色及actual摘要，仅该响应放宽到384KiB；status不混像素，无网页任意帧/路径入口。画布仅显示按需虚拟帧，不自动推进时间。
- worker采用验证120秒/RPC2秒期限和8在途上限；失败/关闭统一终止并清理，显式retry确认版本、保持激活revision、回auto。重激活/恢复已有actor的意图revision先递增后提交，防旧CAS复用。
- 仅合成session请求结果采用128条FIFO窗口，窗口外旧控制/意图先过当前CAS；无永久exactly-once承诺。核心设备去重容量另评审，不因演示长期推进而放松设备协议边界。
- worker数有界不代表低内存；有限探针实际RSS约345MiB，后续先优化并测量峰值与归还，再谈长期预算。


## 原生360动画制作与扩展取舍（2026-10-29，用户确认）

并行路线已整理为[轻量分层角色、表情与对话口型规划](plans/layered-character-plan.md)：优先待机/表情/即时交互/对话，复杂动作保留PET4；先形象与静态分层确认、再最小性能原型。仅保存设计，未实现新格式、播放器、音频或口型能力。

- 保留现有原生360×360 PET4素材、人物大小及原画布居中构图；不采用此前讨论的统一缩小到300/320等方案，也不为扩展动作而逐动作缩放或平移。当前46动作不因此变更。
- 后续可自行生成新动画，按现有角色比例、位置、固定镜头及圆形安全区制作；人物、头发、尾巴与道具的全帧范围都须适配，超界候选不通过缩小人物或裁掉内容纳入。
- 帧动画仍为当前可复用路线：生成视频后需透明处理、固定取景、24fps/360输出、PET4编码及全帧边界/摘要/容量校验。当前正式固件的241帧、目录46项及ID等约束仍需另行评审，不能把制作方案记作新增动作已接入。
- 轻量分层/骨骼动画保留为并行研究方向，未实现，不替代当前正式素材。生成、扩容、固件改动及真机验收均未由本次记录执行或额外授权；素材许可独立核对。

## 分层制作底稿与固定流程（2026-10-29，用户确认）

- 选择第一版neutral-v1.png为后续工作源稿，第二版仅备份；原PET4待机继续作形象与大小/位置基准。
- 固定流程：第一版源稿＋已校准等比矩阵→360标准透明PNG→检查→拆层/补画→静态合成→最小动画→按需补多视图；不重新生成整图以猜测尺寸，不按各部件包围盒自动缩放/居中。
- 标准底稿为.cache/layered-character/authoring-base-v1/neutral-360.png，路径、源/输出摘要和复现命令见[制作指南](../art/character-production-guide.md)；[导出证据](../reports/2026-10-29-character-base-export.md)记录360实际边界[70,50,281,315]。
- 仅源稿选定和画布/外框校准已完成，不外推内部细节、分层工程、动画或设备验收；源/矩阵变更时显式另建版本并复审。当前360/46动作及设备保持。

## 头发细分与完整动态（2026-10-29，用户最新要求）

- 用户要求所讨论发束、左右末梢、错相/延迟/回弹、呼吸/转头/停止/触摸表现全部纳入整体方案，当前暂不考虑性能删减，后续再优化。取代此前“首版只动5处、末梢以后再加”的建议。
- 美术结构为12层头发：头顶主体1、刘海3、侧发2、后发3、呆毛1、左右末梢2；头顶随头固定，其余11层具备独立动态。头饰/耳鳍随头、尾巴单独随身体，不改变原发型、大小、位置。
- 先完整静态合成和视觉动态原型，之后测量/优化缓存、计算与重绘；没有实测前不合并头发或减少动态。若后续实测确需改变观感，明确取舍后再确认。
- 本次仅整体方案、制作指南与清单v3更新，不代表细分发束、播放器、物理或设备性能已实现/验收。

## 内存与回执回收（既有约束）

- 优化PET4分配而不跳过文件SHA/逐帧CRC：默认审计仍计算完整诊断hash；worker只省未参与准入的索引/RGB聚合hash，build不留player，像素转移用独立缓冲。
- 命令/意图采用256条回执窗口和独立revision高水位，acquire只留当前成功操作/原expectedEpoch；不是永久识别任意复用ID的exactly-once。生成方须唯一ID，持久绑定/撤销不作普通缓存回收。
- 仅有seq触摸可安全淘汰历史；高水位也消费冷却内的新事件，无seq继续失败关闭，禁止混用模式。输入适配器未来须先验boot/session，不能替旧事件重新编号。
- RSS以同参新进程样本记录，约334→231MiB不构成硬预算；虚拟三天与墙钟/真机耐久分开。诊断历史有界并明确dropped，不能据截断日志声称全程证据。

## 真实音频与口型同步延后（2026-10-29，用户决定）

- 背景：桌面五嘴型及无音频开始/暂停/换句/取消已有候选；真实音频、板端播放时钟与声画偏差均未验证。
- 决定：真实音频播放、音量驱动开合和时间戳口型同步延后到真机阶段；不继续当前建议的桌面真实音频同步原型。保留现有无音频预览、素材、360基准、46动作和全部11处发束。此项不再作为下一桌面实施入口。
- 恢复：用户明确恢复该项后，核对目标机器音频输出/播放进度与分层渲染基础，另写专项Spec/Diff并执行真机同步/打断/欠载/并发资源验收；设备、固件和烧录仍需相应授权。详见[分层规划第4节](plans/layered-character-plan.md#4-对话与口型)。
- 本次仅更新规划和长期上下文，没有实现音频能力或启动真机工作。

## 相对期限与断线观察（2026-10-30）

背景：Registry以host uptime直接比较设备expires_at/elapsed，仅同钟有效。选择显式host发送时刻+可信设备剩余TTL观察；相对会话禁止省略观察降级，设备自身租约/epoch最终fencing。新lease命令以commandControl比较revision。断线保留最后actual而拒绝旧会话，新认证后按最新目标收敛。

影响仅离线core和模拟台，无生产transport/IPC/持久格式变化；started仍含延迟/漂移误差。证据见[双时钟报告](../reports/2026-10-30-dual-clock.md)。复审条件：认证TTL承载、漂移/最坏延迟包络及v5互操作方案确定；未通过前不扩大为真实租约安全保证。

## 墙钟资源测量范围（2026-10-30）

背景：有限虚拟/换包探针无法代表墙钟资源趋势。决策：独立临时服务、原创小PET4、1Hz IPC读帧、每30秒换包，固定1800秒且不强制GC；保护阈值与完成条件事先写Spec。RSS包含driver与所有worker，主/worker缓冲区分，斜率不作为自动泄漏判定。

证据：[正式报告](../reports/2026-10-30-wall-memory.md)。先前“仅准备方案”状态已被替代并[归档](history/wall-memory-evolution.md)；不解除更多负载/多日/硬RAM或实物门槛。复审条件为真实素材/帧率/共存负载和产品预算明确。

## 保守租约预算与可信回执（2026-10-30）

背景：原相对TTL只验证时间域，未绑定承载证明/请求或扣漂移和最坏命令延迟。本轮选择显式opt-in guard（验证器默认拒绝）、完整上下文/请求/操作/epoch关联、BigInt保守期限；Registry观察增加可选request_seq且使用后不允许降级。旧raw接口仍为参考，不自动成为可信入口。

示例500ppm/B1000等仅数学假设，现有轮询+分段设计可能超过该B；参数需实测或保守约束。合成WeakMap proof非TLS，设备正确生成剩余TTL为假设。证据见[报告](../reports/2026-10-30-lease-budget.md)，原当前片段已[归档](history/lease-budget-evolution.md)。后续离线证书映射/候选TTL部分由下项替代，原数学结果有效。复审条件仍为生产承载、漂移/延迟/休眠与固件互操作；未过门槛不进入实物。


## 离线密码学证明与候选TTL表示（2026-10-30）

背景：合成proof不能验证私钥持有/证书及真实报文完整性，原模型expires_at也不适合跨设备时钟。决策：零npm依赖的Node crypto/X509离线工具，固定根→叶P-256 profile、可信wall时间与绑定指纹/credential_epoch逐消息复核；挑战及签名产生不透明proof，再由guard检查当前Registry上下文。候选管理wire只传设备生成时剩余TTL，严格4KiB canonical JSON；Registry相对路径可缺绝对期限，同钟兼容保留。

现行v5只读源码是Bearer/300ms循环末尾等待/整文件下载，没有管理租约。管理500ms/32KiB/1000ms是另一候选；延迟合计示例B1900/RTT3802替代将B1000用于该设计的假设，仍须实测。离线签名不是生产认证协议，不替代TLS握手/peer授权/机密性或通用PKIX；后续loopback互操作已由下一决策完成，原离线签名工具不作生产路径；休眠/真实时钟/资源/凭据存储与实物门槛保持。证据见[报告](../reports/2026-10-30-offline-auth-v5.md)，原当前摘要与待办见[归档](history/offline-auth-v5-evolution.md)。


## 真实TLS peer边界与loopback隔离（2026-10-30）

背景：离线签名不能代替实际TLS peer认证，生产承载尚无握手/撤销/Range证据。决策：独立临时Node HTTPS互操作，固定TLS1.2候选套件/私有CA/精确服务名，真实socket X509→绑定/credential_epoch/本地controller与service_instance→Registry及guard opaque proof，逐请求/提交复核。关闭TLS恢复与renegotiation、固定连接context、断线或撤销同步失效guard/Registry，保留旧actual；没有空失效回调。素材仅预授权合成摘要表，单Range32KiB、每写4KiB及整包SHA，失败不发布。

执行前写Spec/Diff和回退；监听仅临时literal loopback动态端口，CLI监督自有POSIX进程组，正常/取消清理都已验证。22专项与全套308通过，见[报告](../reports/2026-10-30-loopback-mtls.md)，旧当前摘要已[归档](history/loopback-mtls-evolution.md)。仅替代“尚无宿主TLS互操作”；不是生产服务装配、ESP承载/持久凭据/真实hello挑战或最坏时延资源准入。后续临时绑定/会话权威及注入休眠失效已由下一决策完成；复审入口移至生产装配/OS事件、会话容量及v5/Flash协调，真实设备和固件操作另行授权。


## 单一元数据与会话失效所有者（2026-10-30）

背景：TLS边界fixture与Registry各持批准记录，bound前置的disconnect无法清理已撤销状态，hello没有hub新挑战。选择显式私有hub-bindings/1单一元数据，uint64 CAS/写锁/file及目录fsync；Registry只允许mapping普通提交。协调器先冻结及失效再持久pending撤销，写前失败不报成功、rename后异常为commit_unknown且准入保持冻结；已提交operation重开继续拒绝，绝不伪造设备确认。

会话owner生成服务实例/session/挑战，同TLS两步hello与5秒期限，完整peer proof/代数关联、8在途票据及迟到结果保护；可信invalidate不要求bound，清理不依赖磁盘可读。注入suspend/resume失效旧连接/租约；新hello actual未知，断线历史观测单独标非当前。该阶段真实OS源、密钥存储、生产listener/服务选主及256历史回收未接入；其中服务选主后review装配、native观察源与managed回收现由下一决策替代，物理电源周期/设备listener仍未验。

证据：[28专项/348全套、SIGKILL切点与取消清理报告](../reports/2026-10-30-session-consistency.md)，被替代当前片段见[归档](history/session-consistency-evolution.md)。无旧配置迁移或外部服务变更。复审条件为生产装配/容量/系统事件与175C v5/Flash和实测资源准入；设备NO_GO_UNTIL_MEASURED保持。


## 选主后review装配、原生电源源与一次性admission（2026-10-30）

背景：会话owner仅在fixture装配，直接context历史集合256上限不适合长期hub重连，独立Node不能假定可调用Electron powerMonitor。选择显式managedSessions review选项，公开描述规范化进sourceKey；仅UDS赢家开已有元数据/owner/电源源，启动ready门禁与全局attach期限，default/CLI/插件仍不启用。关闭逐资源完成，有错误也释放本实例UDS，附着方不执行owner清理。

macOS独立IOKit C helper只读注册并先确认系统通知、不阻止休眠，使用严格有界/顺序NDJSON；ready前暂停，失联/坏源保持blocked。真实注册/退出在服务owner验证，物理睡眠/唤醒先后未验证。managed挑战生成一次性opaque admission，auth核对socket/context/generation后消费，不累计历史ID；旧直接入口仍限256。320次真实TLS重连回收及旧证明拒绝通过。

证据：[17专项/376全套与native注册报告](../reports/2026-10-30-service-power-capacity.md)，旧当前片段见[归档](history/service-power-capacity-evolution.md)。仅临时UDS/loopback/构建与自有进程，未改现有配置/服务。后续负载/复验成本的宿主证据由下一决策完成；物理电源周期方案及发行签名/秘密引用仍待验，设备NO_GO_UNTIL_MEASURED不变。


## 先计量复验成本，保留认证语义与条件预算（2026-10-30）

背景：素材每4KiB完整证书检查叠加3次同步元数据load；单请求fixture不等于生产控制优先队列，有界容量也不证明100ms queue。选择显式可选固定数值metrics，保持当前验证/读取/默认块大小，以临时PKI/真实TLS、合成70001B及1/64绑定做4档对照；无缓存优化。16KiB写块减少复验但扩大撤销检查字节窗口，不能据短测调整默认。

离线lane只在段边界控制FIFO优先，等待控制8/素材1、实际在途1；预算外冻结，close等待实际工作结束，不以提前拒绝制造并发。预算N包括活动控制，TTL15秒/双端500ppm及示例深队列B9900ms时，RTT19810ms超过发送跨度5070ms，安全拒绝不等于续租可用。宿主样本max/分位不是物理界限。

证据：[9专项/385全套、固定计数/样本及清理报告](../reports/2026-10-30-transport-load.md)，旧成本未测描述见[归档](history/transport-load-evolution.md)。仅替代宿主成本未知；生产调度/设备listener、签名/秘密、物理电源和ESP准入未放行。本条提出的静态缓存/动态日期撤销与一致revision视图、坏盘发现契约已由下一决策实现；生产调度与物理上界仍未验，不以删除动态复验换吞吐。


承载验证收尾补充：复现测试runner退出后的group EPERM会让旧监督器跳过目录清理。共享监督器改为显式记录终止失败、必要时仅对自有child后备、独立有限重试删除临时根；错误时不导出观察或声称进程已完全回收。受控EPERM及三个取消时点均验证目录删除，两个本轮遗留根经确认无活进程后清理，见同报告。


## 静态批准限实例、元数据视图限同步栈（2026-10-30）

背景：full逐块重复密码学及同一同步操作内重复读盘成本已量化。选择profile内最多64条、用途/指纹/完整DER匹配的静态批准FIFO；每次动态根/叶日期、socket及绑定撤销依旧检查，返回对象不能改内部缓存。mTLS关闭清缓存，新根新owner。session默认scoped，新scope完整验证磁盘，首次读的revision仅供该同步栈，不能跨await/请求/写块；公开数据仍clone，视图内禁止变更，读失败不回退。保留full受信对照/回退，无UI开关或格式迁移。

明确代价：外部进程在scope首次读取后改文件，只在下一scope发现；这不是事务或即时撤销。没有mtime/TTL缓存，同尺寸保mtime坏档也要完整读出并拒绝；CAS/冻权/commit_unknown保持。四档同负载默认64条/4KiB/32KiB的load328→100、warm静态108→0、动态108保持，初次静态检查仍1次。

证据：[14专项/399全套及清理报告](../reports/2026-10-30-verification-reduction.md)，[归档](history/verification-reduction-evolution.md)。复审条件为生产queue/poll/分段/重试的执行上界、发行签名/秘密和物理时序/ESP准入；不据warm耗时降低设计预算或放行NO_GO。


## 单设备G0与现有V2兼容（2026-10-30）

当前上游P3报告前瞻67e1af88…/a7，固定360/241/24、466居中和28MiB V2；管理端399/scoped成果保持。选择先交付G0差异和A1–A5 Spec，不在本轮修改代码或开启通道。schema2 parser与执行分开验收；Registry.expect的本地accepted不能作设备接纳，PC preview也不作首帧。保存/库存/本地实际画面与维护是新的显式协商流，不把saved插进旧phase。

身份选择F文件／M规范catalog／P完整导出content各自recipe，N仍固定namespace；MVP最小manifest不继承PC once_hold/once_idle测试策略。旧scope认证缓存复用，生产pull和单HTTP的队列／维护让出必须独立证明，不套8项参考lane、loopback max或延TTL。旧预算缺read-ahead，内部32KiB余量不覆盖固件48KiB门槛，需G2重新设计与测量。

证据与共同确认见[G0报告](../reports/2026-10-30-round-pet-g0.md)、[交接C01–C12](plans/round-pet-g0-handoff.md)。管理端已给方案，联合G0仍未关闭；真实P／语义／wire／资源和凭据持久化等由双方确认，G3/G4设备窗口另行授权。旧基线未知和笼统下一入口已[归档](history/round-pet-g0-evolution.md)。


## A1独立资源actor，保留schema1和网络边界（2026-10-30）

选择Native360DeviceModel/FlashModel作为受信本地资源执行参考，旧DeviceModel仍只接schema1，避免复制一套认证/lease或把四RAM槽硬套schema2。单RAM、Flash4/1、root/对象generation和read lease分开；验证/帧/保存/库存分轴，旧票据不能结束新freeze。marker尝试后错误是未知结果，恢复前不新写；I/O失败不伪装坏根回退，坏介质不自动格式化。

[35专项/434全套](../reports/2026-10-30-round-pet-a1.md)与正常/取消清理通过；模型采用G0候选参数，既有runtime/UI/scoped未改。逻辑encoded计数不证明ESP RAM峰值，内存medium不是真实V2；联合G0、真实wire/A2/A3/A4及G1/G2仍待确认/实施/验证。下一先A2细化身份导入Spec/Diff，不能据A1开启listener或连接设备。

## 2026-10-30 A2身份与严格导入

固件catalog声明P、hub需要M，不能共用sha字段语义。采用[受限recipe/独立批准](../protocol/round-pet-a2.md)，固定旧N及原ID，不套PC角色循环规则；复用现有worker/CAS，provenance在CAS外有界不可覆盖发布，ready以两步都完成为准。记录失败保留普通CAS且不自封已批准，重开重新提供批准并复验。最多32×256KiB元数据另计、没有自动清理；真实包/许可和共同G0仍未批准。[35专项/469全套证据](../reports/2026-10-30-round-pet-a2.md)。若未来批准更新导致相同I不同来源记录，须显式设计版本/迁移而不自动覆盖；A3/A4另行实施。

## 2026-10-30 A3独立候选观察与只读展示

旧Registry的simulation accepted不转换成设备确认；新增[独立四流候选](../protocol/round-pet-a3.md)，依赖受信外部session/control/proof，默认拒绝、不复制认证。playing与display分开、saved历史与当前根库存分开；查询ID单调/无历史集合、维护恢复需新刷新代数，同root核对象generation。只加内部显式review和GET只读UI，默认配置/实体通道不变。[46专项/515全套证据](../reports/2026-10-30-round-pet-a3.md)。共同wire/固件钩子和真实managed适配另审，不以对象golden/VM通过关闭C04–C07或G1/G2。

## 2026-10-30 A4独立主动拉取候选

复用既有scoped/session/guard而不重做密码学；采用[独立候选合同](../protocol/round-pet-a4.md)验证两个HTTP周期、1 pending/1 latest/1普通与有界旗标、逐页/段单次read permit。线上只给相对remaining_ms，双端本地deadline及实际退出防时钟混用/假清理；unknown阻止新save，自动重试0、重连不重放。A3 proof来自当前真实TLS请求但仍是Node mock，不等于ESP证据。无默认listener/UDS/UI集成，A5磁盘Range/初始库存/恢复及共同wire另审。[48专项/563全套报告](../reports/2026-10-30-round-pet-a4.md)。

## 2026-10-30 A5默认OFF共享装配与恢复

A2/A3/A4各自已验但缺少共同owner/磁盘reader/初始库存，采用[内部显式offline-review装配](../protocol/round-pet-a5.md)，仅选主赢家启动，ready成功仍OFF，不新增生产listener/CLI或页面控制。worker同fd全验临时证据接磁盘reader，pin跨实际HTTP退出；文件变动只能完整重验后恢复。新hello查询完整根，旧F计占位、保护0/4、满槽显式victim；保存unknown不盲重试。休眠/失败fence，resume不重新启用或重放意图。

[41专项/604全套证据](../reports/2026-10-30-round-pet-a5.md)只证明临时宿主候选；真实包、共同wire/Node-C++与固件G1/G2仍NO_GO。此条替代A4决策中“磁盘Range/共享owner/初始库存/恢复另审”的未实现状态，A4当时独立证据保留。生产LAN、持久选择/秘密、自动退避与真实电源恢复另立Spec，不从内部enable推导实物授权。

## 2026-10-30 A6模型事实与恢复边界

[A6](../protocol/round-pet-a6.md)以A1 actor事务/刷新票据生成设备角色的四流，经A2 CAS/A4 TLS/A5→A3对照，替代“只由mock声明”的最新验证范围；A5历史专项保持。暂存不等于saved、下载不等于verified/playing，marker错误未知，恢复查询不补造旧saved。低root即使被模型判为有效回退也不能越过hub高水位；需要明确维护/重新建立信任流程。

[30专项/634全套](../reports/2026-10-30-round-pet-a6.md)仅宿主模型。显式reboot才能证明本轮恢复，不推导hub重启/设备不停机的revision契约已完成。下一先冻结会话/回滚/deferred取消语义与正反向量；真实包/共同wire/G1/G2/独立设备授权仍为前置。未修改A1–A5生产实现，不延长协议TTL，仅A6测试监督显式总120秒，其他CLI默认总30秒保持。

## 2026-10-30 A7会话命名空间与根维护

采用[A7](../protocol/round-pet-a7.md)受信beginSession隔离revision，新会话清volatile任务且保留Flash/held画面，不借reboot掩盖会话边界。根状态以binding/N保floor、完整根和未查询commit对象；缺少对象证据会在新owner漏掉同seq冲突，故闭合检查点同时验证。低root保持blocked，只读维护评审不清floor/自动rebind。deferred不等于提交，取消不能撤销既有root或将unknown变未保存。

[24专项/658全套](../reports/2026-10-30-round-pet-a7.md)限定临时caller文件/TLS与逻辑medium；未提供生产自动checkpoint、权威CAS/耐久或磁盘防回滚。下一明确持久化/崩溃切点和共同C04/C07/C08/C12，真实包/G1/G2/设备窗口仍需独立交付。此条替代A6当前未实现的模型会话重连状态，历史reboot证据保留。

## 2026-10-30 A8同文件绑定/根权威

采用[A8](../protocol/round-pet-a8.md)显式新profile/schema，把绑定/凭据和根放在同一CAS原子替换中，避免独立文件提交裂隙。A3先私有准备、scope外持久、复验后投影/ack；未落盘不确认、rename后异常冻结。无变化根锁内核CAS不写，旧v1严格且无自动迁移。

进程崩溃切点与正常新owner恢复仅为宿主临时证据。旧锁不自动删，坏档/缺失不重建；实例内检测revision回放不构成跨进程可信锚。下一量化新增锁/fsync/复验成本，不延TTL；真实恢复/物理掉电、共同G0/素材/Node-C++/G1G2/设备授权仍独立。替代A7未实现的显式权威存储状态，不改写其手工交接报告。

## 2026-10-30 A9成本测量与多期限

[A9](../protocol/round-pet-a9.md)保留A8策略，只加固定数值scope/计数和四档同负载。v2 load225→308、64登记逻辑读取24.03MB，noop无fsync仍编码77934B；局部减量后续由A10实现，坏档/CAS/实例revision/动态日期撤销与发布截止要求继续有效，不引入跨请求mtime/TTL缓存。

R是明确假设而非样本max；加R100时旧双向预算RTT4002超过4s回执，即使lease仍有余。server2000/client1500也要独立满足，不延TTL。容量极值64登记仅63根不代表任意64最大字段都装得下；单活动peer/热盘样本不推导并发/物理上界。替代A8待测当前状态，可信恢复/实体门槛保持。

## 2026-10-30 A10同次摘要复用与noop边界

[A10](../protocol/round-pet-a10.md)只复用本次完整读盘/schema或完整编码所得的私有digest，仍进行实例revision/hash比较；不变根须锁内新完整读取/CAS/全部内容一致后才省编码。rootState内部默认reduced、保留full参考/回退；v1/v2格式/队列/TTL无变化，不新增CLI/插件开关或迁移。

[同负载证据](../reports/2026-10-30-round-pet-a10.md)：额外摘要315→0、64档编码省77934B，完整load/hash308、动态检查/锁/CAS及7次同步保持；24专项/730全套通过。固定顺序宿主样本不保证每次更快；局部成本切片闭合，下一共同G0/真实包批准与Node-C++/实体资源门槛。可信锚/整盘回放、冷盘/物理时延/掉电另审，不以SHA或fsync自封批准。


## 400原像素候选规划（2026-10-30）

- 背景：用户倾向直接保留源像素并扩大两侧可见范围，400示意被认为可接受；黑边的压缩、解码和刷屏成本须区分。
- 决策：保存[候选Spec](plans/native400-material-spec.md)，以同中心400直接裁切、无额外安全圆为主评估方向；380/400圆仅对照。按M0全78动作审计→M1/M2宿主→M3联合固件评审→M4授权真机推进，本轮只做规划。
- 影响：新规划允许评估更大画布，但不替代现有正式360、46动作或分层角色360决策，不授权改固件／设备／运行服务。
- 证据与复审：既有360原像素对照仅6动作；400目前只有示意，没有全帧或性能结论。待用户审核完整视觉清单、宿主严格校验和设备资源实测后再决定基线及安全区；不预设新增数量或帧率保证。


## 400视觉筛选容忍度（2026-10-30）

用户明确原46项保留；新增动作不因轻微边缘或烟花／粒子特效裁切直接淘汰，重点保护人物主体及主要道具。按此完成[第二轮筛选](../reports/2026-10-30-native400-rescreen.md)，新增29项无检出出边，15/56/65轻微损失建议接受，形成78项视觉候选。该判断不替代42号118帧时序、400格式／性能／设备准入，不修改正式360包或自动启用新动作。


## 400 M2显式准入与容量区分（2026-10-30）

用户授权同步推进宿主管理链路。采用manifest.pet4_profile与operator approvedPet4Profiles双重批准，恢复亦检查；仅frame响应512KiB，其余64KiB／请求4KiB保持。8语义包与完整78库已按[报告](../reports/2026-10-30-native400-m2.md)交付，六个M1文件SHA不变；12动作超旧单文件cap，维持按能力拒绝而不自动扩容或降画质。宿主库不等于设备同时缓存；设备资源方案与真机窗口另审，正式360及分层360保持。

## 2026-10-30 G0-R1只读复核与保守首窗口

[固件回复对照](plans/round-pet-g0-handoff.md)接受资源/媒体/信任边界/状态轴方向，真实P/M/N/46 F/源blob及全CRC独立核定；许可引用保持upstream-reference-only，不从哈希制造批准。原始声明需直接补证，商业/传播用途不由代码MIT覆盖。

首窗口选择远端0/11、physical4单次本地优先、remote4暂禁；取消准入gate与持久marker分开，gate后取消不承诺撤销saved，恢复I/O未知不因bool成功自动解除；写尝试是启动内固定易失窗。R1当时仅设计；后续G0-R2已补显式离线policy/模型gate，正式UI/schema/固件适配仍缺，不能当实体已支持。R3已补管理端wire/宿主向量，R4临时adapter已完成，下一共同签核/GET衔接与许可批准；联合G0未关闭。

最新矩阵顶部/窗口Spec记A/B中断、cbdf临时驻留未恢复67；其他旧入口不覆盖该限定。只读引用不构成实物状态新证明，现场恢复需另一窗口授权，本任务不碰临时端点/旧服务。旧快照已[归档](history/round-pet-g0-reconciliation-evolution.md)。

## 2026-10-30 G0-R2显式门禁与提交结果分离

[R2](../protocol/round-pet-g0-r2.md)复用A5统一授权，在独立first-window-review/1下仅允许可信缓存0/11，保存/其他动作拒绝；profile在owner创建时固定并进入UDS选主，通用46缺省保持。用户输入预检不破坏当前lane，派发时库存变化则失败关闭；内部选项投影不等于正式UI已接线。

复用A1 Flash/actor增加不透明gate：gate前取消无root，gate后取消仅阻旧播放、持久结果仍可saved/unknown；受信恢复清volatile并完整读根/对象，I/O失败保未知，历史unknown不补saved，低root不清floor。纯local寿命模型与实际资源actor/临时TLS分层验证，35专项，不声称RTOS互斥、Flash掉电或设备回执。

cachedHitInventoryOnly仅显式模拟结果，正式cache-hit/取消/错误ACK已由R3管理端提案定义（待共同签核/实际适配）；不修改既有wire、TTL/格式/许可或运行服务。R5临时GET已完成，下一新wire执行对照、独立素材批准和固件G1/G2；本轮未访问固件/设备，不更新R1部署快照。R1未实现摘要已[归档](history/round-pet-g0-r2-evolution.md)。

## 2026-10-30 400颜色候选确认与独立合并

用户已评估颜色并授权合并。只替换12个超限动作（5个RGB565无损、7个颜色合并），以被审阅候选manifest SHA绑定批准，新建78库及角色index／provenance；原M2、M1和压缩对照保留，其他66文件SHA保持。颜色批准仅针对相对M2的新增变化，不是新许可、正式360替换或设备准入。见[合并Spec/Diff](plans/native400-merge-spec.md)；新包验证结果与设备交接以合并报告为准。


## 2026-11-02 G0-R3独立wire与证据版本

背景：旧A4/lease闭合对象不是固件正式hub-device通道，R2内部命中/取消模型不能靠换名上线。选择独立round-pet-native360-wire/1管理端提案、完整hello能力/包选择、request_seq、固定错误恢复及版本集；playback/display/storage升2，inventory/touch/cancel保持显式1，缓存命中与新提交、取消gate与未知结果分别表达。旧profile不放宽、不迁移运行配置或V2 namespace。

以闭合表与固定SHA字节作为双方下一评审输入；78正/62反经Node及原创C++17宿主对照，纯Node账本只核有界往返关联。合同SHA/数据oracle不赋予认证、许可或设备事实，scope与实际guard/投影/持久owner分开。证据见[R3报告](../reports/2026-11-02-round-pet-g0-r3.md)；旧wire未定义记录已[归档](history/round-pet-g0-r3-evolution.md)。替代R1/R2“下一定义wire/宿主向量”待办，不替代共同签核、实际adapter、许可/G1/G2/设备窗口。双方若改字段需显式修订合同/向量与重验，不静默改旧字节。


## 2026-11-02 G0-R4显式临时装配与合同修订2

背景：R3只定义首窗口，无法如实表示保存/未知恢复的full离线验证；A3旧入口也不接受schema2。选择修订2仅扩challenge/ready的full-offline-review/1显式选择，缺省R2首窗口保持，owner创建时固定，不增加生产配置。原合同/向量按原SHA归档，原78正例字节保持，新增2条选择向量，当前80正62反需固件重新共同审阅，不能视作双方已同意。

内部adapter借用session/guard/同步readView/A8权威，拥有A2/A3/ledger/队列；默认disabled、无CLI/插件/生产listener。A3原记录来源凭据只校验一次，显式新入口规范化并保扩展，旧schema1仍拒绝新版本；命中非saved，取消intent fence非设备phase，私有候选durable后才发布。证据见[R4报告](../reports/2026-11-02-round-pet-g0-r4.md)，旧adapter缺口已[归档](history/round-pet-g0-r4-evolution.md)。R4当时下一为临时GET/分段，现已由R5按Spec/Diff交付，不重写认证/期限，不据loopback扩TTL；共同签核/真实许可/固件G1/G2与设备窗口仍必需。


## 2026-11-02 G0-R5共享读lane与双退出边界

以A4原实现提取共享read lane/writer，保持旧路径/profile/许可编号/校验边界；临时adapter复用相同Range/预算/逐4KiB新scope授权，不另建认证/队列。readBudget缺省null、首窗口不发许可；full-offline-review加显式预算才允许GET，metadata/asset响应沿授予permit的exchange关联，不增GET请求序列或改R3修订2JSON字节。HTTP关联规则仍需固件共同签核。

invalidate只清许可/abort，不删除未退出ticket；socket关闭、timer、AbortSignal均不是handler/I/O退出证明。忽略abort的钩子须继续持HTTP/read槽、reader/pin，直到实际完成；部分206失败关闭，客户端收齐后仍独立F/PET4核验，不能替代设备首帧或持久确认。证据见[R5报告](../reports/2026-11-02-round-pet-g0-r5.md)，原无GET状态已[归档](history/round-pet-g0-r5-evolution.md)。当时下一为A1 actor经新wire全链，现已由R6验证；生产/设备/真实许可/资源门槛不由该片放行。

## 2026-11-02 保持现有压缩优先档并扩至78动作

用户认可四样本当前压缩优先观感，决定沿用空间18／时间5／至多128色及当前色数75%参数全量制作，不继续64／48／32色探索。新78候选独立保存，全18,675帧校验、总省14.71%；四样本SHA保持。其余动作仍需人工审阅，局部色差重点有专门定位；本决定不将四样本认可扩成全库视觉验收，也不覆盖设备侧正在验证的合并包或许可／固件授权。见[全量结果](../reports/2026-11-02-native400-compact78.md)。

## 2026-11-02 全78压缩优先版视觉确认与合并

用户已看全量对照并明确确认本版、授权合并与提供设备侧继续验证提示词。采用已审阅21142a93…的全部78原字节，不继续调色或选回旧档；新库／role8／完整library78重新冻结身份，旧库完整保留。此前“全量视觉待审阅／未合并”被本决定替代；用户视觉确认不等于许可、真机资源或烧录批准。见[合并报告](../reports/2026-11-02-native400-compact-merge.md)。


## 2026-11-02 G0-R6复用actor与显式新wire模式

既有executor以显式wireProfile输出schema2事实，不把静态peer状态当模型执行。原A1 actor/Flash不改，旧A6缺省保留且simulator不进候选；命中为already_available/inventory_reference，首帧只submitFrame、saved只模型root确认、淘汰只新库存，unknown不补历史saved。宿主owner重开与actor reboot分别验证。

实际接入发现loading冻结与R5一律禁止维护GET不相容；仅在当前ready目标已downloading时允许loading继续拉取，保留其他维护/触摸/控制门禁。新adapter按A5规则拒绝EMPTY/IDLE_READY不安全动作，不借full测试profile跳过保护。报告见[R6](../reports/2026-11-02-round-pet-g0-r6.md)，旧未接actor状态已[归档](history/round-pet-g0-r6-evolution.md)。R6当时gate失联仍保持commit_in_progress，后续R7已补一次本地收尾，不从普通重连通过推导该分支已解决或设备准入。


## 2026-11-02 G0-R7本地完成权与网络控制权分开

R6清理丢失提交引用，R7在显式新wire executor保留一个opaque gate任务：完整payload/有效guard进入gate后，可在失联/lease/暂停后由原owner本地完成一次，不能追加数据或恢复播放。实际commit运行时不重入busy actor，新会话/close必须等实际退出；失效终态只留诊断，unknown只读恢复、不补旧saved/降A8 floor。

4000ms等待预算仅诊断，不是假设备硬上界或延TTL理由。旧A6默认、A1内核、session/guard/R3 JSON合同保持；token不新增wire字段。证据见[R7报告](../reports/2026-11-02-round-pet-g0-r7.md)，R6缺口已[归档](history/round-pet-g0-r7-evolution.md)。下一共同G0/许可/固件G1/G2证据核定；真实异步RTOS、物理掉电/休眠及凭据撤销策略须固件独立签核，不以同步宿主通过放行。

## 2026-11-02 共同G0核定不代签核，许可证据与用途输入分开

本轮只读核定发现上游400窗口已恢复原cbdf，随后新增可靠ACK/短锁候选仅宿主未部署；采样期间matrix/todos变化已重读，不把旧A/B中断状态或HEAD当现场。正式360/46的F/P/M/N/source保持，原声明及CC官方条款可直接取得，替代原文读取缺口；内部A2 offline-validation审阅输入尚未提供，不伪填审阅人，不把公开许可当商用许可，也不要求作者逐次另发授权。现有license_ref无需为了补证迁移。

固件旧G0回复/相关生产源码未变化，不替其接受revision2/R5 HTTP附录或R7 gate后撤销策略。联合G0/G1/G2保持缺口分列；下一真实360用途审阅输入、固件结果分类/原子gate答复及单owner/可信时间/持久身份Spec，再独立授权设备资源窗口。不重做R7/承载优化、不延TTL。见[本轮报告](../reports/2026-11-02-round-pet-g0-closure-review.md)、[当前C表](plans/round-pet-g0-handoff.md)、[替代历史](history/round-pet-g0-closure-review-evolution.md)。

## 2026-11-02 管理端主线转400/78，360留兼容回退

用户确认后续使用compact78。当前目标400²/78，42号118帧、其他241；360代码/媒体/合同/回退与分层360保留。本轮只对齐规划和证据，不推导新能力或正式部署。

先400-01身份recipe/P-M-N分域，400-02新能力/窗口/实际时序及渐进完整性选择，400-03新wire/golden，400-04默认OFF装配。旧schema2要求完整file≤playback RAM，不谎报1MiB窗可容纳完整5.57MB文件；逐帧CRC呈现不作全F verified，保存仍须持久提交确认。现有M_host/I/视觉provenance不替代未来P/M_device/N或用途批准，fixture N不启生产。

固件源码采样期新增PACKED_RGB不继承e6fe/410报告的构建/动态资源证据，400@24/G1-G2和持久化仍待验证。详见[Spec](plans/native400-manager-alignment-spec.md)、[报告](../reports/2026-11-02-native400-manager-alignment.md)、[旧主线归档](history/native400-manager-alignment-evolution.md)。


## 2026-11-02 400为后续方向，400-01主入口与离线N

用户再次明确400是最终方向，旧尺寸暂作备份，不并行扩展旧尺寸功能。400-01以createNative400Import为后续入口，旧createRoundPetImport默认只保留可回退行为；复用同仓库/worker，不为新尺寸再造CAS/认证。

N_offline固定为新offline-v1 identity文本SHA，profile/scope强制离线；P候选绑定N、原source/source-index、78实际timing与index/RGB/extra，M为独立最小catalog，不复用宿主M/I或360 N。用途批准由调用者独立提供，转换不生成授权。真实compact只读核候选，不制造审阅人/批准或导入，正式N/Store仍由共同G0确认。

同F只可复用解码，不能跳过每个源文件或后续RGB/extra承诺；cachedOnly不能从账本自批，ledger失败的普通CAS不升级信任，关闭等实际worker退出。见[API](../protocol/native400-identity.md)、[报告](../reports/2026-11-02-native400-01.md)、[替代记录](history/native400-01-evolution.md)。后续400-02已实现本地review模型，400-03/04独立，见下条。

## 2026-11-02 400-02 默认全验重读与显式渐进对照

新增纯core帧窗口actor与本地schema3 review，保持旧schema1/2和360备份原义。默认第一遍全F/index/RGB/CRC/extra验证不发布画面，逐帧压缩SHA收据最多7712B；显式重读比对收据再允许独立软件帧提交，不能假定同文件重读不变。progressive-review只离线对照，pending/failed与whole verified分开，晚失败保held front并失效源。

该选择增加初始两遍、每loop重读/解码及SHA成本；逻辑typed-array账本2194816B不包含VM/输入/全部元数据/摘要状态，不作为ESP生产预算。persistent=null、不合成saved/库存；软件submit不是实体屏确认。取消/会话/期限失效拒旧结果，关闭等同步调用实际退出；无新认证/HTTP/生产装配。固件须共同答复策略、额外内存/带宽/信任链及实际资源；下一400-03新合同/向量，再400-04。见[报告](../reports/2026-11-02-native400-02.md)/[API](../protocol/native400-window.md)/[替代记录](history/native400-02-evolution.md)。

## 2026-11-02 400-03 独立review wire与完整性引用

保留所有295份原源文件/360合同，仅新增round-pet-native400-wire-review/1/revision1，固定offline-candidate/N_offline与verified-replay、cap3/playback3/display3/storage0/inventory0/cancel2，不用“解析器能接受”推导设备支持。正式策略/版本由固件共同确认，progressive-review仍只在400-02离线比较；本wire拒绝降级。

descriptor增加index/RGB/extra后，极值8条页面4675B超4KiB，固定4条/20页（3019B，末页2）。全验证据采用verification_seq：远端verified report携带，local4另有asset.verified，显示引用并独立确认软件首帧；不能造remote4或把HTTP/下载结束当verified/playing。storage/inventory0明确unsupported/null，不当已知空库存；cancel失效和io_exited分开，后续owner仍要等实际退出。Node素材pin核P/M/N/角色/F/descriptor及permit.total_bytes，codec关系正确不等于用途/认证/校验真的发生。

94正/116反在独立Node/C++17宿主字节一致，36专项/独立CLI/check/全套1054通过；无实际HTTP/TLS/actor/设备或固件构建。本轮没有改变源码/运行配置/旧向量，真实用途/正式N/Flash/TLS/可信时间/G1/G2/24fps仍待[W01–W10](../protocol/native400-wire-review.md#交固件的决定待确认项尚未共同签核)。下一400-04复用原owner/guard/仓库/承载/actor默认OFF临时装配；[报告](../reports/2026-11-02-native400-03.md)/[旧摘要归档](history/native400-03-evolution.md)。

## 2026-11-02 400-04 受信profile与默认关闭临时链

不伪造schema2完整encoded RAM或360 lease字节。Registry/session/MTLS只加可信代码依赖注入，原缺省不变，400 profile严格校验cap/目标/新lease后仍用原TLS proof/guard；新路径仅临时client显式白名单，service/plugin/IPC/生产入口不接。A2 reader/A4 lane/writer/queue复用，新400投影沿A3当前/历史不变量，A8只读根/unsupported库存，R7等实际退出原则保持。

400-03没有任意read-request，本片recipe固定20页→首遍→verified→重读，GET实际成功退出后才推进cursor，失败/取消不推进。合法renew不延120秒独立作业截止；source失败派生failed回执，验证引用/软件提交与HTTP成功分开。disable/close等真实HTTP/读钩子返回再放pin；临时peer还等TLS两端退出后新连，不加重试。

37专项/CLI/check/1091回归覆盖真实私有loopback/CAS/原认证与actor，不是ESP/Flash/可信时间/24fps准入。local4仅idle显式原创本地源，用同窗口全验/独立首帧；完整优先/latest/loop欠载协同留400-05。302份原源中298保持SHA、4共享修改/7新增，400-02/03/360合同/golden不改。见[报告](../reports/2026-11-02-native400-04.md)/[API](../protocol/native400-host-review.md)/[被替代记录](history/native400-04-evolution.md)。

## 2026-11-03 400-06：物理N_boot与review身份分域，完整周期预算先于准入

只读新鲜固件矩阵/报告已核400本地6882/N_boot四对象留驻、用户实屏/触摸反馈及连续23.297fps/24未验。N_boot=a34d0c7b…是V2格式家族SHA，不能覆盖400-01离线N/P/M或据PC审阅生成当前设备库存；400运行期写入/正式hub合同仍未实现。已测6882资源与当前四前缀预取源码分开，后者仅前缀2107136B另有validator/hash/scratch，不能沿旧2322168B或无网络余量放行TLS。

400-05单段/500ms poll目标不构成完整gateway交换/flush/解码/本地读的最坏上界。6000至4510ms的1490ms窗口及170段/120秒作业上限仍须实际trace核定；不延TTL或静默改revision1掩盖。下一400-07先Spec/Diff完成周期预算负例和必要准入/让步，再400-08只读来源审阅；D03完整性、重复触摸/本地自主与finite remote寿命及正式能力须共同决定。报告/决定/回退见[400-06](../reports/2026-11-03-native400-06.md)/[D01–D09](../protocol/native400-g0-review.md)，旧外部快照[已归档](history/native400-06-evolution.md)。本轮314条既有源SHA保持、check/1126回归通过，无生产/设备或上游仓库变更；不代双方签核。

## 2026-11-03 400-07：完整交换/源预算、提前renew与计划必要条件

400-06的6001/499/999条件已用冻结旧链和真实私有loopback/local reader复现，R4503时失败关闭；新6720提前续租与读前控制机会在相同输入成功。整体exchange/flush500ms、GET-only/local source1000ms共用原实际owner，单pump受控compute累计100ms，超限不发布fresh actual，内容恢复交换失败仍清context。4510拒绝floor/lease15000/remote120000/local20000不扩，旧400-04缺省保持。

170段原创PET4在实际CAS/TLS/actor及999ms逐段双时钟注入中先触原job截止，lease有效也不补verified/playing。显式requireBudget在改目标/queue/revision前拒超声明计划，fits仅必要条件，默认review不保证全部实际400包在120秒内完成，loop非无限。详见[24专项/1150回归报告](../reports/2026-11-03-native400-07.md)/[API](../protocol/native400-cycle-budget.md)/[旧条件归档](history/native400-07-evolution.md)。正式策略/端侧成本/物理退出仍待共同确认；下一400-08只读来源审阅，外部资料仍400-06快照。

## 2026-11-03 400-08：PC来源审阅与设备事实分开

N_boot只作为固定V2格式身份，与候选N_offline/P/M/F/cache SHA分域；新mappingApproval必须由调用方独立提供并关联原400-01用途/credits，不能从源/账本自批准或提升到生产。双根/uint64/局部floor/降级回退只描述选中文件，未知I/O不fallback；流式整cache及逐物理F不等于全媒体CRC/index/RGB/extra证明，更不能填设备actual/saved/库存。

[44专项/1194回归](../reports/2026-11-03-native400-08.md)/[API](../protocol/native400-bootstrap-review.md)已验证只读私有28MiB/文件变动与实际退出，317条原源保持、5新增文件。原N/profile/wire/400-07与旧尺寸保持，真实cache/媒体/用途和外部驻留未重核。旧待实现记录[归档](history/native400-08-evolution.md)。400-09后续已完成保存/可信重开与只读投影，仍须独立批准和实际源复验；正式合同/资源/真实窗口继续独立。

## 2026-11-03 400-09：持久结果仅历史，当前检查不能继承

独立有界journal存最新400-08 map与安全来源名；不把绑定存储变为通用存储，也不保存源路径/批准原文/媒体。新owner重开仅历史，重新由调用方给candidate/mapping批准且实际reader全量复验才为本次通过；自SHA只能检测内部一致，跨进程整盘回放不受防护。失败撤销先前current但保历史；CAS/fsync和rename后的unknown分开，unknown冻结至显式重开，取消等实际I/O退出，已提交不谎称回滚。

[43专项/1237全套](../reports/2026-11-03-native400-09.md)/[API](../protocol/native400-source-review-storage.md)验证存储、故障恢复和可选只读管理slot，未接服务/IPC或设备；固定wire/400-07/旧尺寸保持。400-10后续已完成临时宿主只读status与owner装配；真实用途、外部固件/资源/24fps和正式G0独立，来源审阅不变成库存或播放授权。旧入口[归档](history/native400-09-evolution.md)。

## 2026-11-03 400-10：准备独立批准身份、仅赢家持owner、页面只读

复用现有UDS选主/鉴权，不新增服务或配置开关。独立输入预校验/快照形成opaque选项与canonical摘要，只有赢家打开固定私有子目录中的400-09 owner，attach不读源/建账本或接管未知socket；不同批准/create策略拒绝attach。服务仅GET status，旧写路由也关闭，代理和UI重建只读白名单。退出先fence，等真正读退出才释放UDS，页面卸载不关共享服务。

[36专项/1273全套](../reports/2026-11-03-native400-10.md)/[API](../protocol/native400-source-review-host.md)已验真实IPC/临时HTTP/构建JS候选读取及双进程选主、历史/取消/unknown/坏档，不代表真实浏览器/DSH或设备验收。外部仍400-06快照，400-03/07/08/09不改；后续400-11已评审受限操作契约，真实用途/正式G0/资源窗口仍独立。旧入口[归档](history/native400-10-evolution.md)。

## 2026-11-03 400-11：选择身份、独立批准与操作关联分别建边界

评审决定优先在原reader实际open内钉住选择指纹，不能把外层stat+路径当所选对象。批准固定在可信prepare，网页不能生成；未来控制会话由可信宿主发放，Origin/随机client_id不授权。单任务、一次选择与seq高水位去重，定向job取消先同步匹配再调用现有cancel；授权期限需同步gate进提交/发布，不只靠timer abort。取消/过期跨非抢占提交可留历史，unknown冻结到可信重开，不称回滚。

[评审报告](../reports/2026-11-03-native400-11.md)/[拟定契约](../protocol/native400-source-review-controls.md)及两项原创探针确认接线缺口；本轮无生产源变更，332条原源保持/check/1273回归通过，CTL-01–40未执行。400-12后续已完成可选内部选择绑定，之后控制器及默认关闭交互另做；原生picker/可信页面身份未验，当前DSH继续只读，真实用途/G0/资源窗口独立。旧入口[归档](history/native400-11-evolution.md)。

## 2026-11-03 400-12：选择只钉住对象，不代授权/内容证明

元数据选择只存内部opaque引用，原reader实际fd首读前比较，不在外层stat后无条件读路径；同字节新inode也拒绝。TTL只约束新任务，已准入任务仍观察revoke/close/坏时钟；真实读/metadata hook不退出就持资源。manager原journal valid与发布前复用选择检查，rename后unknown优先，已知提交后选择失效可留新历史但不发布current。原recipe/持久格式与默认undefined路径保持，错误不自动降级。

[35专项/1308全套](../reports/2026-11-03-native400-12.md)/[API](../protocol/native400-source-selection.md)验证仅内部选择子范围；329条原源保持、3修改/3新增，service/IPC/UI只读不改。下一400-13可信审阅会话/一次选择/请求去重/定向取消/完整授权gate先Spec/Diff；页面/native picker及真实用途/G0/资源另审。旧入口[归档](history/native400-12-evolution.md)。

## 2026-11-03 400-13：有界受理与结果分离，权限在提交点再核

controller独占原owner，内部opaque会话和一次选择、uint64高水位/最近ACK及单任务/终态容量，不做持久请求账本。重复同seq/body先于busy/unknown检查返回原ACK，旧请求不重跑；取消先同步匹配job再调原cancel。可选同步Boolean gate进原owner准入/提交/发布并锁存首次失效，timer仅唤醒，不能用定时器代同步时钟复查；非抢占提交跨期限留历史、unknown优先至可信重开。

[45专项/1353全套](../reports/2026-11-03-native400-13.md)/[API](../protocol/native400-review-controller.md)覆盖内部请求/期限/退出与持久切点，333条原源保持、2修改/4新增。操作逻辑clock与reader墙钟安全超时分开；来源选择许可从capture开始保守计时，不靠延TTL通过测试。400-14交互/可信页面身份/native picker仍未接，service只读与真实用途/G0/设备资源边界不变。旧入口[归档](history/native400-13-evolution.md)。


## 2026-11-03 400-14：权限留在可信宿主，页面只消费已授权选择

显式controls策略进入sourceKey，只UDS赢家装配原13 controller；owner可信authorize/choose/revoke和独立内存凭据不经config/ledger/global status发放。私有IPC固定实例，临时页面provider每次授权GET/POST，固定Origin/Host不充当身份。共享UI留私有pending，丢ACK同完整请求手动确认，不自动生成新写；取消/关闭仍等实际I/O，unknown仅可信重开。

[42专项/1395回归](../reports/2026-11-03-native400-14.md)/[API](../protocol/native400-interactive-host.md)是原创临时源+UDS/HTTP+构建JS hook宿主证据；默认apply无provider仍只读。339条既有文件332保持/7修改，新增5；原controller/selector/reader/journal和wire不改。真实浏览器/DSH身份/native picker没有因此完成，下一400-15先审交接/隔离profile方案。真实用途/G0/设备资源门槛及外部400-06快照不变；此前13条目中的“下一14未接”为当时语境，由本条替代，原文见[归档](history/native400-14-evolution.md)。


## 2026-11-03 400-15：宿主身份与选源许可分离，不用兼容绕过鉴权

只读安装确认DSH已rc.5，原rc.3动态基线与peer不自动扩兼容。raw webServer不执行Connection准入，authorization是凭据flow非来访者身份；Desktop的目录picker/pathFor没有把可信单文件结果直交hub，HTTP转发删Origin，14 raw写代理保持拒绝。推荐可信本地broker直接交接选择/明确审阅许可，Connection是额外身份门禁，不自行解析宿主cookie/复用内部secret，也不因注册路由便开放权限。

[评审/状态机](../protocol/native400-provider-review.md)、[报告](../reports/2026-11-03-native400-15.md)：10专项/1405全套及独立浏览器真实DOM覆盖14链路，344原文件保持/新增4验证文件；临时cookie与历史React18.3.1不是DSH身份/native dialog/rc.5 profile验收。原14决定的“下一15待评审”为当时语境，15已完成本片范围，下一16先Spec/Diff做默认OFF可信本地交接适配器，先离线，不重复reader/journal或放宽Origin/期限。[旧原文](history/native400-15-evolution.md)。


## 2026-11-04：TCP缓存控制优先

用户明确改设备承载为LAN明文TCP，控制/后续素材流同方向；管理页面HTTP权限保留。TCP-01复用现有素材/业务Schedule，旧HTTPS/Range/session安全候选保留历史，broker/native和额外TLS不阻塞本片。新事实f553板上与a74f未部署分开，旧6882/前缀预算不作现状。ACK、SHA等级与首帧分离，缺状态扩展不伪报持续playing；共同待定与回退见[对齐](../protocol/native400-tcp-alignment.md)。


## 2026-11-04 TCP-02：重连不自动延长或重放动作

临时owner只显式loopback/port0；设备主动连接，单活连接拒绝并行抢占，新session/有限退避。动作寿命从用户提交算，队列/断线/重连不续TTL；明确reapply才关联仍有效目标，定时PING只续会话。pause/close同步fence并等真实socket关闭，首帧只留历史。生产LAN/DSH写入口与共同状态扩展不在本片。[API](../protocol/native400-tcp-owner.md)、[报告](../reports/2026-11-04-tcp02.md)。


## 2026-11-04 TCP-03：先核报告语义，未知扩展不探发

终端仍v0；本片只实现内部默认OFF投影和字段提案，不分配新type/长度/协商、不改HELLO或向旧端点发新消息。verified表示设备报告整文件SHA/metadata/frame0 CRC，不能作为whole-media；frame0与actual独立，touch/local及最新base分开，旧token/source不复活。新增生产协议须共同定稿后再Node/C++字节对拍。22专项/1461全套，范围见[字段交接](../protocol/native400-tcp-status-proposal.md)/[报告](../reports/2026-11-04-tcp03.md)。


## 2026-11-05 TCP-04：按实际Bridge生命周期审阅，不拼造wire证据

已只读确认端侧默认OFF Bridge接worker/SHA/CRC/View/EOF；原TCP03固定source/Touch快照候选不能直接消费WholeSha-before-bind、每intent首帧与每cycle完成。新增纯core默认OFF内部事件审阅，可信选择transport/remote目标，全stamp与时间边界隔离；不从Completed/FrameReady/连接关闭生成播放、触摸结束或实际I/O退出。保留原候选，先共同核定同PTC1扩展再字节对拍/临时装配。新发现v0回调Core草稿仅只读，未接app_main/无本轮运行证据，不据此写成联网完成。板上f553与未部署f2cf/9dc区分；动态RAM/栈/延迟另测。详见[交接](../protocol/native400-bridge-event-alignment.md)/[报告](../reports/2026-11-05-tcp04.md)，被替代当前记录见[归档](history/tcp04-evolution.md)。

## 2026-11-05 TCP-05：可信来源先于临时监听，v0首帧只记历史

现有mapping/catalog函数是转换工具，不自带来源准入。新增opaque prepare和显式fresh PC文件审阅，复用400-01/08独立批准、实际fd选择和流式SHA，绑定N_boot与原始source index、健康双根、独立map/mapping后才能进入原TCP02临时owner。只限offline-loopback，不输出真实设备配置或扩素材用途。Node/C++固定preimage对拍，C++不独立SHA；新loopback仍合成peer，current_display unknown、verified null。

管理端候选决定初窗可先保持v0历史首帧，丰富STATE不作为该离线配置切片前置；端侧最新owner合同答复已与该v0语义文本一致，真实Config来源、用途及资源门禁仍待共同确认。端侧owner现已有177工具/三构建及宿主完成证据，均未部署，不重复开发。详见[交接](../protocol/native400-tcp-binding.md)/[报告](../reports/2026-11-05-tcp05.md)，旧下一入口见[归档](history/tcp05-evolution.md)。


## TCP-06（2026-11-05）

单peer/IP只作准入选择，不是认证；本地link epoch与TCP/session分离，新代先失效旧socket，旧代不触发时钟检查。默认不配置策略保持原行为，监听限制不放宽。真实LAN/STA只提供执行回退方案，不能把offline批准或静态预算转换成生产/设备准入。见[报告](../reports/2026-11-05-tcp06.md)与[方案](../protocol/native400-tcp-network.md)。


## TCP-07（2026-11-05）：宿主所有权先复用既有UDS

显式tcpReview通过opaque prepare/sourceKey进入原选主，只有赢家创建fresh源任务与loopback owner。IPC仅投影只读状态，操作句柄不转交附着者或网页；关闭先等资源退出再释放UDS。单实例只覆盖同私有目录，不冒充跨目录全局锁。LAN独立profile与真实用途/STA调用者仍需后续实施，不升级offline批准；[报告](../reports/2026-11-05-tcp07.md)/[评审](../protocol/native400-tcp-host.md)。


## TCP-08（2026-11-05）：LAN transport窗口与offline用途分离

独立opaque窗口仅接受可信本地新用途/身份引用，单owner/单claim、prepare起算绝对期限和选定NIC门禁；每条入站记录也先核期限。旧binding/host不升级，不增加UI/CLI或自动服务。引用校验不等于真实版权/库存核定，R0与LAN专用赢家装配仍待完成。终端station候选已有STA/关闭确认代码，实际无线/动态资源未验；不重复固件。[报告](../reports/2026-11-05-tcp08.md)。


## TCP-09（2026-11-05）：LAN关闭失败保留UDS所有权

专用lanReview与offline模式互斥，sourceKey绑定安全profile摘要和策略；仅赢家acquire，附着不续窗口。关闭先同步fence、等TCP成功与资源归零再释放UDS，失败保持503并允许可信手动重试，不重试动作/启动或抢socket。只读投影不声明真实来源批准、设备显示或STA退出；同目录单实例不扩为跨目录全局保证。[报告](../reports/2026-11-05-tcp09.md)。


## 2026-11-05 TCP10：请求数据与用途决定/凭据分离

私有请求只含身份/端点/窗口，独立LAN决定由可信代码另传，不能用JSON自批准。配置交接须匹配TCP09实际赢家和有效listener/窗口，使用真实动态端点；无产品自动启动或USB调用。raw index逐字保留，端侧目前不独立pin索引，需共同确认可信提供者职责。真实用途/库存和LAN成功交接不由纯JSON或loopback结果推导；下一真实窗口另行核定。见[TCP10协议](../protocol/native400-tcp-lan-request.md)。


## 2026-11-05 TCP11：历史来源与用途/当前库存分开

完整78原始index作为管理端首窗候选，历史cache/四payload经本仓库只读审计并匹配终端账本；来源证据不生成approval/request或当前库存。旧带批准inspector规则保持，新增结构诊断只复用同一检查。端侧role_index无独立compiled pin的职责待共同确认；真实用途及可信调用方另行明确。共同G0重写为当前TCP路径，旧表归档，设备真实窗口/动态资源与精确回退继续独立。[报告](../reports/2026-11-05-tcp11.md)。


## 2026-11-05 TCP12：来源上下文与独立决定的引用关联

新增可选reviewed request，只消费本进程实际未关闭audit上下文和单独完整material/window决定；identity不可覆盖，许可引用与署名/用途匹配。格式校验不代表真实许可/作者/固件同意，真实材料只整理待确认草案。audit close撤交接而不擅关外部服务；transport期限/当前库存/首帧继续独立。旧TCP10低层API范围不扩、没有全局强制审批。见[接口](../protocol/native400-reviewed-lan-request.md)。


## 2026-11-05 TCP13：私有交接只在消费方实际退出后回收

wx锁/自有inode文件直到run与consumer.close实际完成才释放；unknown保锁，明确retryCleanup不重run。queued只保非联网/显示的历史结果，取消不伪装撤回。新增高层opaque guard但真实USB adapter/service.close屏障仍未接，caller须分别关闭各owner，不能以文件清理代设备退出。见[接口](../protocol/native400-private-config-session.md)。


## 2026-11-05 TCP14：consumer与服务共享退出所有权

仅LAN赢家持config owner；先预登记再创建，close同步fence并等待child/stdio、session文件和TCP实际退出，unknown保UDS/503，不自动重试下发。进程入口SHA非完整闭包冻结，Queued/host退出非设备业务/STA清理。上游本机受控合同已明确raw index可信本地责任，USB/STA部分实测过但未TCP OPEN且最终恢复f553；下一先稳定启动并冻结当前执行版本/当次peer。见[接口](../protocol/native400-config-process-owner.md)。

## 2026-11-05 TCP15：显式代码清单与运行闭包分开记账

此前入口pin不能重建窗口期间的完整加载版本。采用显式预期SHA/私有副本/完整复核和运行lease，封存前核源一致，运行从副本取入口且前后复核，关闭等待实际child+stdio退出。coverage固定declared-inventory-only；当前hub清单及原创Node加载对照不推导Python/系统依赖全覆盖、许可/用途或设备准入。不自动解析未知动态导入或运行上游工具；完整外部依赖/清洁环境和真实加载证明作为后续入口。见[TCP15 API](../protocol/native400-execution-snapshot.md)。

## 2026-11-05 TCP16：实际解析字节与声明文件清单分别记账

采用固定Node24.14.1同步loader hook，在新进程从真快照动态导入已审manager，先核即将解析的source再记录实际loaded。保留declared inventory，未执行分支/worker/Python/系统库不伪作全覆盖；仅导入模块，不运行service CLI/startOrAttach。bootstrap/父进程基线受信任、不是沙箱或历史执行重建；设备恢复/真实TCP准入由独立窗口处理。见[API](../protocol/native400-node-load-audit.md)。

## 2026-11-05 TCP17：正式管理端纯Node，Python USB留作可选开发工具

用户明确质疑管理端Python环境并同意收敛方案。此前TCP14–16围绕临时USB工具延伸的Python环境/完整依赖审查不再作为正式启动/发布或缓存动作控制前置；旧adapter保持默认关闭，仅外部开发工具适配。新增纯Node窗口装配复用原service/owner，来源/独立窗口及权限仍按原契约；产品USB/BLE另设计Node/原生辅助方案，不假设浏览器BLE。见[API](../protocol/native400-node-control-window.md)。此决定覆盖TCP15/16中把真实Python依赖放入默认下一入口的部分，其宿主证据继续有效。

## 2026-11-05 同步终端当前帧率验收决定

只读终端最新摘要/启动失联分析明确用户已接受当前f553帧率/流畅度。管理端后续窗口不再以严格24fps为前置，也不因此排独立优化任务；保持素材24fps时间信息、文件身份/CRC/SHA、内存与帧进展/错误和性能退化检查。旧阶段报告保留其当时目标和测量，不能据此将未验收的TCP/启动稳定性写成已通过。

## 2026-11-05 TCP18：复用私有通道边界接入手动控制

绑定真实audit/request/独立来源窗口到同一Node owner，使用既有Bearer/实例客户端与精确Origin代理，不发网页授权/配网/路径接口。新增control scope token留宿主内存，命令seq/revision和最近完整body确认保证不重发/不续TTL；来源或会话失效按各自范围关闭/取消。loopback只允许原创test真实audit，设备配置仍拒loopback；不为测试绕过批准。共享组件hook/真实loopback与浏览器/DSH/ESP分开记账。见[API](../protocol/native400-node-control-channel.md)。
