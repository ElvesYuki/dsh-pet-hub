# 管理端 round-pet 单设备闭环 Spec

2026-11-02范围标记：本文件保留360/46兼容与当时实现依据；当前管理端目标已按用户确认转[400/78 Spec](native400-manager-alignment-spec.md)/[Diff](native400-manager-alignment-diff.md)，[共同G0](round-pet-g0-handoff.md)已更新。不得将下文旧360阶段下一项或旧常量当新400已支持。历史报告/代码/合同不改写，当前实施入口400-01至04。

2026-10-30。状态：**G0管理端方案审查已交付，联合定版未关闭；A1–A10宿主候选已离线实现，A5默认OFF装配已离线验证，实体准入待完成**。G0阶段仅docs、契约向量和现有回归；后续[A2边界与验收](round-pet-a2-spec.md)另记；A1的边界与验收以[独立Spec](round-pet-a1-spec.md)及[报告](../../reports/2026-10-30-round-pet-a1.md)为准，不开启设备通道。基线见[对齐表](../round-pet-hub-baseline-alignment.md)，共同提案见[契约](../../protocol/round-pet-single-device-v1.md)，交接见[决定／待确认项](round-pet-g0-handoff.md)。

## 范围与不变量

一块ESP32-S3-Touch-AMOLED-1.75C-EN，既有角色46个原编号动作，原生360² PET4/24fps/241帧，466²物理屏center(53,53)。使用现有28MiB V2、4个活跃引用＋1个暂存对象；保护的是动作ID 0/4，不是物理slot编号，1/11是当前可轮换动作。先手动缓存命中，再未缓存下载、验证、首帧、保存、淘汰和重连；不承诺全库离线。

固件由另一任务负责。本轮只读其规划、源码和P2/P3报告，不运行固件导入器、构建或设备工具。现有前瞻67e1af88…及a7回退不动；不改变分区、V2格式／namespace、网络／凭据、DSH/pet/bridge服务，不安装插件、提交或推送。跨角色／尺寸、分层渲染、多设备、BLE、OTA、音频、自动pet来源不并入本闭环。现有scoped认证减量、CAS、租约guard、会话／电源回收和流式素材仓库直接复用，不重做。

## 根因与必须补的管理端能力

1. capabilities schema2／几何和素材推荐已有，旧DeviceModel仍只接schema1并在reboot清空缓存；注册表不模拟Flash，UI只展示synthetic设备。A1已新增独立单encoded工作集、Flash对象／root引用／read lease／暂存与恢复模型；A6已接隔离模拟执行链，实体执行仍未装配，不能删除旧构造器检查后继续用RAM LRU冒充支持。
2. 三种摘要recipe不同；MaterialCatalog只验摘要形状，固件纯core互操作脚本不能证明runtime导入兼容。A2已用独立批准/专用导入/provenance明确关联文件F、hub M、导出包P和固定namespace N，真实包共同批准仍待确认；禁止把catalog.sha256=P送入runtime后又当M。
3. Registry.expect现在会本地写phase=accepted，不能直接投影成“设备已接纳”。A3已新增独立候选观察/只读UI，分离保存/完整库存、本地画面、维护和序列；实体装配仍待完成。新增契约不能塞进旧phase或放宽未知字段校验。
4. 现有TLS是loopback装配；A4已在独立Node loopback实现拉取/单连接/有界调度；A5已整合默认OFF共享装配；生产listener和实体资源执行owner未实现。真实固件目前v5 Bearer／整文件和两任务请求，不能重命名为新单TLS通道。

## 模块范围和责任

以下保留G0拟实施范围；其中A1已完成[纯core资源](../../reports/2026-10-30-round-pet-a1.md)，A2已完成[离线导入](../../reports/2026-10-30-round-pet-a2.md)；A3已完成[候选观察/只读UI](../../reports/2026-10-30-round-pet-a3.md)，A4已完成[loopback拉取承载](../../reports/2026-10-30-round-pet-a4.md)，A5已完成[默认OFF装配](../../reports/2026-10-30-round-pet-a5.md)，生产/其余不是已实现能力。可按依赖复用现有模块，不增加第三方依赖。

| 模块 | 拟改范围 | 边界 |
| --- | --- | --- |
| core/protocol、device | schema2分支或独立Flash设备actor；单RAM工作集、root seq/object generation、保护0/4、暂存／取消／read lease | 保留schema1旧SIM行为；模拟Flash不是实物Store实现 |
| core/registry、新设备观察reducer | 请求投影与设备accepted分开；完整身份、phase／storage／inventory／display独立流及高水位 | local事件不伪造远端命令；历史saved不激活旧目标 |
| runtime/material-import、material-store、拟round-pet-import | 固件包P验证、M构造、provenance ledger、流式全文件／全帧审计与许可批准 | 不运行另一仓库脚本，不拷贝库进Git，不改旧仓库格式或默认导入语义 |
| core/scheduler、runtime/session-runtime | manual base与本地临时触摸分离；完整上下文和TTL；新profile严格适配 | 不重复监听DSH，不再给设备物理触摸加宿主冷却或回发一次挥手 |
| 拟runtime/device-channel、device-coordinator | owner选主后受门禁装配、一个TLS／一个HTTP在途、控制／Range／manifest分页、取消与重连 | 默认OFF；没有G2资源／凭据和执行授权不得开真实listener |
| runtime/service、共享UI、插件白名单 | 显式单设备意图／观察接口；desired／实际画面／维护／保存／离线库存分栏 | PC画布仍为预览；既有simulation/roles不投影成实体回执，插件不独立开连接 |
| tests、simulator、独立CLI | 同一契约向量、虚拟双时钟／Flash故障、mock拉取服务／loopback TLS | 不连接现有设备或服务，保留已有399项回归范围 |

完整字段、recipe、版本和排队方案以[契约提案](../../protocol/round-pet-single-device-v1.md)为准；R3已冻结管理端提案与宿主向量，仍须固件共同确认及另行adapter装配，不能从管理端提案直接发送到设备。

## 可独立验收的小切片

| 管理端切片 | 内容与依赖 | 可先离线完成 | 设备阶段依赖 |
| --- | --- | --- | --- |
| A1 schema2执行模型 | 从已审能力数值出发，RAM／Flash独立身份、root事务、read lease和重启模型 | Node纯core＋合成Flash向量，schema1回归；不动listener | 固件确认能力／根序列语义；真机验收另做 |
| A2 三摘要／流式导入 | 本提案recipe、M/P/N provenance及许可；不使用已有once_hold/once_idle测试包代替固件语义 | SHA／路径／UTF8／数组顺序负例；原创小PET4和真实库只读审计另有Spec，完整46库仍走streaming | 实际P、ID集合、文件哈希／namespace映射由双方核定 |
| A3 状态／UI | 新profile协商、device accepted、首帧、本地实际画面、maintenance、storage/inventory；先合成输入 | reducer＋IPC/UI白名单＋虚拟时间；不需要真实listener | 固件首帧／commit／inventory钩子、版本／序列确认 |
| A4 拉取调度／loopback | actual device角色主动请求、控制响应／回执回传、分页、段间续租、背压、请求绝对deadline及关闭 | 独立temp mTLS、mock ESP、同负载／故障；复用scoped，不重做优化 | G0字段／方向关闭；G2动态资源、可信时间／秘密与有界取消证据 |
| A5 默认OFF装配候选（已离线完成） | 单UDS owner、显式接口、默认OFF，关闭清理／重复启动测试 | 仅隔离配置／mock监听，不能自动安装或启用 | G1现行维护、G2资源／正式身份均通过，用户另授权窗口 |
| A6 执行模型对照（已离线完成） | A1 actor经A2/A4/A5→A3，库存/帧/保存/淘汰/故障 | [30专项](../../reports/2026-10-30-round-pet-a6.md)；显式model reboot，不覆盖设备不停机的hub重启 | revision命名空间/低root回滚维护需共同定版，G1/G2和设备授权仍必需 |
| A7 会话/回滚候选（已离线完成） | 新context revision、临时checkpoint/floor_commit、低root维护与取消/提交 | [24专项](../../reports/2026-10-30-round-pet-a7.md)，同actor新hub不reboot | 生产权威持久化未做；固件C04/C07/C08/C12及G1/G2仍需共同验收 |
| A8 根权威候选（已离线完成） | 显式新profile绑定/根同文件CAS、投影延后、进程崩溃 | [34专项](../../reports/2026-10-30-round-pet-a8.md)，无旧v1迁移 | 新成本/最坏等待、可信恢复/物理耐久与共同G0/G1/G2仍未完成 |
| A9 持久成本复评（已离线完成） | v1/v2×1/64登记，同负载/容量/假设预算 | [14专项](../../reports/2026-10-30-round-pet-a9.md)，不延TTL/不优化行为 | 样本不是硬上界；局部减量见A10，可信恢复/共同G0/G1/G2与设备窗口继续独立 |
| A10 局部减量（已离线完成） | 锁内完整CAS后noop省编码、私有同次已验digest复用 | [24专项](../../reports/2026-10-30-round-pet-a10.md)，同负载完整读取/动态检查/同步保持，full回退 | 不新增跨请求快路/准入或迁移；下一共同wire/真实包与实体资源 |
| D1 缓存实物闭环 | G3对应：0/11手动，4本地触摸，其他已缓存动作以实时inventory为准 | 不能靠离线验收宣布完成 | 上述门禁＋固件新适配已交付，先缓存命中再扩大 |
| D2 未缓存／保存／重连 | G4对应：下载、全校验、首帧、saved、淘汰、断连查询 | 先A1/A3/A4模拟取消／掉电模型，不冒充实物断电 | D1通过；固定namespace，G1/G2与独立设备授权，写入预算恢复方案 |

A1/A2及A3对象候选/只读UI已离线完成，真实包共同批准尚未完成；A3真实wire/A4以共同schema冻结为准，未定部分只做明确标注的离线候选，不能提前给设备发字段。宿主测试不代表G0联合关闭。固件G1由固件任务安排，本任务不启动旧维护工具。G5发布／8小时／真实pet来源是后续独立目标。

## 预定宿主向量和验收

下表是完整闭环的预定向量，不是全部已通过的测试。A1/A2已覆盖其中资源参考/身份与离线导入部分，逐项范围以专项报告为准；真实包/跨端及未覆盖项继续待实现。固定散列recipe向量见[JSON](../../protocol/vectors/round-pet-g0-identity-v1.json)；其假字节不冒充有效PET4。

| ID | 至少覆盖 | 通过标准 |
| --- | --- | --- |
| SD-01–06 | schema1兼容；schema2单工作集；中心53；240/非241/非24/错flag/key/tile拒绝；最大文件边界 | 几何接受与执行模型分别验证，不伪报4个RAM槽 |
| SD-07–12 | 文件F/M/P互换；包recipe／source SHA；Unicode／对象重排／数组反转；索引原始SHA；路径与许可 | 正向期望摘要唯一，反例拒绝；不修改V2 N |
| SD-13–18 | 4活跃＋1暂存、0/4保护、1/11替换、read lease、commit前取消、提交后取消 | 新根发布是保存线性化点；marker后读回失败为outcome_unknown而非保证旧根；无根引用残留不算saved；重启只恢复有效根 |
| SD-19–24 | 本地requested不等于accepted；HTTP成功不等于verified；CRC失败；verified非playing；刷新后playing；保存独立 | UI／注册表不提升状态，无真实证据显示unknown |
| SD-25–30 | saved非当前目标；淘汰／root过期；分流seq；旧session／command；终态迟到；uint64边界 | 历史保存不重播；库存不是永真；不刷新旧活性 |
| SD-31–36 | local挥手＋更新base；重复触摸；维护保持最后画面；绘制token竞态；触摸取消下载／保存；过期base | 设备local权威，结束只回最新有效base；不能承诺维护24fps |
| SD-37–42 | 实际pull两次HTTP周期；活动段残余；更新目标／取消；超时但I/O未退出；late callback；重连 | 一个实际在途，未清理不重开；不复用旧lease或盲重试副作用 |
| SD-43–48 | 深队列反例；等待／处理／验证／保存预算；时间未知；撤销／坏元数据；休眠；配置选主 | TTL不掩盖排队，预算未知NO_GO；复用现有失败关闭 |

各切片保持npm run check／npm test；针对新风险再加专项。共同向量Node/C++分别实现，不能通过调用对方导入器来掩盖语义差异。设备验收另记录首帧时间戳、root读回、内存／栈及句柄回收，软件复位不替代物理掉电。

## 承载准入和失败关闭

一个TLS／一个HTTP在途是首闭环设计约束，不是现行固件能力。优先控制与资产授权不能只在hub队列承诺，还需设备在段边界主动exchange，且验证／Flash维护期间的通讯调度也有界。使用绝对deadline覆盖排队→请求→清理；超预算停止新工作、失效会话、不另开第二请求，等待真实I/O结束。不能把loopback样本、P3内部59,035B或旧140KiB/32KiB假设当ESP可用TLS预算。

保留固件门槛PSRAM空闲≥1MiB／最大块≥512KiB、内部空闲≥48KiB、main栈余≥1KiB；TLS最大连续内部块、通信栈、凭据持久化、可信时间／恢复方案均待G2。静态PSRAM6,916,777B包含64KiB read-ahead；本仓库旧预算JSON缺此项，只作历史输入，不能直接作准入。应用仍2MiB分区且≥256KiB余量，不改布局过门禁。

## G0阶段回退与完成定义

G0阶段只新增／更新docs，运行现有宿主检查／构建候选，不安装、不启动生产服务；其既有管理端生产源码摘要应保持一致；固件若被另一任务并行修改，记录初读/复读摘要和语义影响，不覆盖外部修改或伪称全仓库冻结。G0回退仅撤回该阶段文档改动，保留已有修改。A1新增模块的关闭与资源回收见独立Spec，不改变此处设备回退边界。

未来离线代码回退：关闭自有mock/worker/Agent/socket/进程组、等实际结束、删私有临时PKI；默认deviceTransport=false与原服务配置保持。未来实物失败先冻结新通道并明确设备控制源互斥，再按固件任务的当前前瞻恢复物／a7审核范围处理；应用回退不自动恢复缓存、NVS或撤销凭据，不擦Flash、不恢复旧整片冒充当前状态。具体设备身份／时间／备份路径必须在获准窗口前另备，不在此虚构。

G0管理端交付验收：真实差异可定位、recipe／向量明确、版本／状态／维护降级与门禁有方案、双方未决项和分工列清、文档链接／既有回归及只读摘要核对。**不以文档交付关闭联合G0，不把规划写成管理界面已控制实体设备。**

## G0-R1刷新（2026-10-30）

[最新交接](round-pet-g0-handoff.md)已对照固件回复；真实P/M/N/源/46 ID及全CRC独立核定，无独立用途批准。首窗口选远端0/11+physical4、remote4暂禁；R2显式离线gate与内部选项已实现，真实UI/固件适配待完成；取消gate与持久marker分开，恢复I/O未知不靠bool解除，写预算按启动内固定窗。C07管理端字段/错误及Node-C++宿主golden已交付，固件共同签核/实体消费、身份设计及G1/G2仍缺，联合G0未关闭。

当前目标已转[400/78](../native400-baseline.md)，本文件保留360兼容实现/测试与原G0依据；当前下一入口为[400-01至04](native400-manager-alignment-spec.md)，旧末尾入口已归档。400协议/能力/P-N/资源未由此实现。
