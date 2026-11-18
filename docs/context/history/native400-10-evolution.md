# 400-10替代记录

2026-11-03：以下为实施前原文，由[当前系统](../current-system.md)/[待办](../current-todos.md)和[400-10报告](../../reports/2026-11-03-native400-10.md)替代。只替代400-10待实现/旧最新验证及下一入口；400-09持久化、400-08来源审阅及固件/G0限制继续有效，原报告与阶段数量保持历史语境。

## 原 docs/context/current-system.md

2026-11-03 [400-09来源审阅保存/可信重开](../../reports/2026-11-03-native400-09.md)已完成离线范围：复用400-08实际reader和独立批准上下文，严格map验证、私有64KiB单记录journal/uint64 CAS/wx锁/文件及目录fsync；重开仅历史，调用者重新给两份独立批准且实际源/逐payload复验及map一致才为本次通过。取消先fence、busy等实际读退出，rename后未知冻结owner，失败保旧历史。共享只读投影/可选slot和固定构建候选JS宿主渲染已验，无IPC/默认服务接线。43专项/监督CLI正常清理、check（语法）与含构建全套1237/1237通过；322条原源中319条SHA保持，仅inspector/UI入口/build白名单变更，新增6文件；400-03固定wire/golden及400-02/07不变。[API/回退](../../protocol/native400-source-review-storage.md)、[原创证据](../../protocol/vectors/native400-09-storage-review-v1.json)、[旧入口归档](native400-09-evolution.md)。这只是一次PC源检查：未全媒体验证、无设备actual/saved/库存，不具备跨进程防整盘回滚或硬I/O退出保证；本轮未读真实cache/媒体/固件，外部状态仍400-06快照。

400-07完整周期预算/24专项仍有效，现全套包含其回归；6720提前renew/原4510 floor、GET-only/整体exchange与源/累计compute、严格计划必要条件和170段先job到期均保持。400-08未接生产/IPC/设备来源，也未重验真实cache或全帧媒体。400-09候选保存/重开和只读槽已验；下一400-10先Spec/Diff接显式临时宿主status/owner退出，继续不从来源审阅生成设备库存授权。

## 原 docs/context/index.md

管理端最新（2026-11-03）：[400-09 Spec](../plans/native400-09-spec.md)/[Diff](../plans/native400-09-diff.md)、[保存/复验/只读API](../../protocol/native400-source-review-storage.md)、[43专项/1237回归报告](../../reports/2026-11-03-native400-09.md)/[原创证据](../../protocol/vectors/native400-09-storage-review-v1.json)、[旧入口归档](native400-09-evolution.md)。私有有界CAS journal、独立批准下的实际源重开复验、取消/未知提交和只读UI宿主结构已验；原400-08流式reader/recipe、400-03固定字节与400-07保持。下一400-10显式临时宿主只读status/owner退出装配；无默认服务接线、全媒体或设备事实。本轮无外部读/真实素材/服务操作，固件仍400-06快照；正式G0/用途/安全资源/Flash/G1-G2/24fps待验。

## 原 docs/context/current-todos.md

1. **400-10显式临时宿主的来源审阅status装配（下一入口）**：先Spec/Diff，复用[400-09 owner/journal/白名单投影](../../protocol/native400-source-review-storage.md)，明确临时宿主的显式创建/赢家所有权、只读status代理、关闭等待真实I/O、坏档/未知提交/重开与界面历史等级。仅原创临时文件和独立临时环境；不增加自动批准/自动源扫描/设备库存，不启生产listener或现有服务。400-09已完成43专项/1237全套及JS宿主槽渲染，后续再做实际临时status端到端，不重复实现存储/reader。

## 原 README.md

[400-09保存与可信重开](../../reports/2026-11-03-native400-09.md)：私有有界CAS journal、重开历史与独立批准下的实际源复验、未知提交冻结、取消实际退出及共享只读槽已完成；43专项/监督CLI/check/含构建1237项通过。[API/回退](../../protocol/native400-source-review-storage.md)，复现：`node scripts/verify-native400-09.mjs --output .cache/native400-09/results.json`（先`npm run build`）。无默认服务接线或设备事实；下一400-10显式临时status/owner装配。

## 原 docs/context/native400-baseline.md

| 维度 | 当前确认与限制 |
| --- | --- |
| 板/几何 | 一块ESP32-S3-Touch-AMOLED-1.75C-EN，466²屏，400²素材1:1居中(33,33)，裁区(124,-6,400,400)，无额外安全圆/逐动作位移 |
| 目录/时序 | 78个原ID0–77；24fps，42号118帧/其他77项241帧，共18675帧。末帧分别117/240，不能补帧或延时补齐 |
| 媒体格式 | PET4/flag1/key12/tile20，每tile8000B；256项RGB565调色板、8位索引，逐帧tag决定完整/XOR；本版1019个额外tag0 |
| 当前批准版 | recipe=native400-compact-approved-v1，宿主profile=native400-candidate-v1，license_ref=dsh-pet-nc-86181ce；视觉批准不等于A2用途/设备准入 |
| 文件身份 | source manifest a1c7c2a6…、全库I=5bd657d4…/M_host=0102c312…、role8 I=afdda0e8…/M_host=655d8429…；精确值见[证据](../../protocol/vectors/native400-manager-alignment-v1.json) |
| 体积 | 全78共348737057B；最大67号5569645B＜旧payload上限5865472B；role8共31877424B＞28MiB，不承诺8项或78项全离线 |
| 身份未决 | 400-01候选M_device=094e69be…/P=52b2f6cb…/N_offline=dd0f19bf…保持；外部已装N_boot=a34d0c7b…是格式家族SHA，0/4/1/11四对象，cache=57ae06ed…；400-08已有独立用途的PC只读来源映射，真实用途/共同hub N仍未定，不能把镜像SHA当包P或改原review scope |
| 管理端代码 | 通用400解码/流式仓库/角色激活/IPC像素与恢复已有宿主验证；400-01主入口/独立批准/全媒体严格导入已实现；400-02纯core实际ring/本地schema3 review/完整性对照及首帧/时钟/退出已验；A1/旧wire/R7仍备份，400-03独立review wire/双语言字节已验，400-04默认OFF临时装配/真实loopback与actor已验；400-05触摸/latest/自动调度已离线验证；固件本地触摸已有报告证据，管理端真实触摸/正式协商与Flash写仍待实现 |
| 执行方向 | 最新固件候选为单1MiB压缩窗口＋三RGB（含前瞻），encoded=0；最大24帧payload688702B。本模式不能谎报为schema2完整encoded RAM，需新能力版本/明确完整性状态 |
| 显式资源 | 6882报告PSRAM2322168B、internal scratch20160B/worker16KiB/I/O8KiB；无Wi-Fi样本PSRAM最低6062680B/最大块6029312B、SDK内部低水位191507B。当前源码新增四前缀合2107136B另加validator/hash/scratch/publication，未绑定新构建/动态资源证据；不得套用旧值或当TLS余量 |
| 真机证据引用 | 6882本地90秒/87快照/1928帧全SHA、2076呈现；段内23.947–23.955fps、连续23.297fps、最大跨段889.076ms，用户持续播放/触摸返回已确认；24fps/精确触摸/冷上电/网络保存/长测未验。0dcdf USB1805帧恢复/切换/CRC负例通过，draw=1取消仅宿主覆盖 |
| 驻留/回退引用 | 所读矩阵记6882be44…/589248B＋N_boot cache57ae06ed…已留驻，启动前全32MiB b194ddde…精确读回；旧360完整app/cache保留且首轮成对回退真实执行过。只读报告不是当前现场探测；回360须成对恢复，不能仅刷旧app |
| 下一入口 | 400-01至05已有离线实现；400-06评审已完成文档范围。400-07周期预算已离线实现，400-08已离线完成，400-09保存/独立批准复验/只读槽已离线完成，下一400-10临时status/owner装配；正式策略/协商/运行期写入和G1/G2/24fps另审 |

400-09[报告](../../reports/2026-11-03-native400-09.md)/[API](../../protocol/native400-source-review-storage.md)：43专项/监督CLI/check/1237回归已验私有有界journal、CAS与未知提交、重开仅历史/实际源复验、取消实际退出及只读槽。无默认IPC/服务接线、全媒体或设备确认；下一临时status装配，外部固件/资源仍400-06快照。

## 原 docs/protocol/native400-source-review-storage.md

候选默认不装配。回退：cancel/close并等待busy=false/open_files=0，保源与journal不动；新目录可隔离归档，但unknown或残锁不自动删除。回到400-08只读入口无迁移/分区/缓存/配置变化。后续400-10先Spec/Diff，把owner接入显式独立临时宿主的只读status白名单与退出所有权，再做端到端管理展示；仅离线，不接真实源、设备、生产listener或现有服务。固件G0/用途、Flash proof/writer、TLS/凭据/时间、资源/24fps仍须独立证据与授权。

## 原 docs/protocol/native400-g0-review.md

1. **400-07：完整调度周期预算（本片离线已完成）**。24专项/独立CLI/check/1150回归验证上述实际链和必要修正。不是设备最坏上界，成本超限失败关闭；400-08来源审阅后续已完成。
2. **400-08：N_boot只读来源映射（本片离线已完成）**。见[44专项/1194回归报告](../../reports/2026-11-03-native400-08.md)/[API](../../protocol/native400-bootstrap-review.md)。独立批准/strict header/流式整SHA及逐物理F/实际读退出已验，无全媒体校验或设备证据；400-09审阅产物保存/重开/只读投影后续已完成。
3. **400-09审阅产物保存/重开与只读投影（本片离线已完成）**。见[43专项/1237回归](../../reports/2026-11-03-native400-09.md)/[API](../../protocol/native400-source-review-storage.md)。有界CAS journal/两份独立重新批准/实际源复验/失败历史及只读槽已验，不能凭自SHA/来源审阅生成设备库存/保存授权；无默认服务接线。下一400-10仅临时status/owner装配，不启生产/设备通道。
4. **正式能力/策略与端侧适配（需共同决定）**。D03–D05/D09确认后另立review修订/新profile及Node/C++字节，明确local来源、重复触摸、无限自主策略/有限remote目标、全媒体/缓存proof与期限；双方未采纳前不改变现revision1。固件先提供不联网现场的宿主/构建及新工作集清单。
5. **TLS/持久写入与真实闭环（等待资源证据和独立授权）**。端侧时间/凭据/单owner/实际退出/新内存G1/G2合格、真实用途批准、共同合同后，再审0/11＋physical4缓存闭环，后扩未缓存/保存/淘汰/重连；真实设备动作不由本次继续指令自动启用。

## 原 docs/context/plans/round-pet-g0-handoff.md

1. **400-01离线实现已完成**：[API](../../protocol/native400-identity.md)/[30专项报告](../../reports/2026-11-02-native400-01.md)已交付候选recipe、P/M/N_offline、独立批准及400严格导入/缓存重开主入口；原尺寸仅备份。真实库只读算候选、不创建用途批准/导入。请固件共同审阅新recipe/namespace_scope，正式N/Store仍待定，不把离线N写设备。
2. **400-02离线范围已完成**：[API/决定与待确认](../../protocol/native400-window.md)、[48专项报告](../../reports/2026-11-02-native400-02.md)。真实1MiB ring/独立schema3 review/短尾/XOR/extra/首帧/欠载/失效/同步退出已验，旧schema2/360原义不变。默认全验后重读＋帧SHA，progressive-review只离线；请固件答复两遍/收据7712B/每loop重读或渐进可信链/状态和资源区域，不直接沿用现有PSRAM预算。
3. **400-03/04/05离线已完成／下一共同策略评审**：[字段/完整性及W01–W10待确认](../../protocol/native400-wire-review.md)、[36专项/94正116反报告](../../reports/2026-11-02-native400-03.md)已交独立review表/字节/Node路径头核对和批准元数据pin。不是双方签核；400-04[37专项报告](../../reports/2026-11-02-native400-04.md)/[API](../../protocol/native400-host-review.md)已接原session/guard/A2 reader/A4 lane/queue与新投影/actor的默认OFF临时真实TLS，验证挑战/序列/dispatch/verification引用/取消和实际退出。A8只读根、R7退出原则保持，无Flash写。400-05[35专项报告](../../reports/2026-11-03-native400-05.md)/[API](../../protocol/native400-scheduling-review.md)已完成代码选项调度；下一先Spec/Diff和新鲜只读证据，确认本地源/缺源与失效fallback、周期verification floor、原作业截止/每loop重读成本、GET实际退出/轮询/控制的物理最坏预算及正式协商。400-06已完成本轮只读评审，见[D01–D09](../../protocol/native400-g0-review.md)；400-07已补24专项/1150回归，400-08已补PC只读映射，400-09保存/可信重开/只读投影已离线完成，下一400-10仅临时status装配。当前hello不协商调度能力，禁止把可信代码开关当设备支持，不重复承载优化或直接开窗口。
4. **固件先离线、后另获授权窗口**：交400 N/Store持久化、能力、渐进验证、安全身份/单owner资源Spec与构建/宿主证据；再按400冻结维护/G1-G2/24fps门槛。满足后另审首窗口0/11＋physical4及逐项下载/全验/保存/淘汰/重连；本任务不执行现场步骤。

[API](../../protocol/native400-source-review-storage.md)/[43专项与1237回归](../../reports/2026-11-03-native400-09.md)：PC来源map可保存为私有有界CAS历史，重开重新给两份独立批准且实际源完整重验后才是本次通过；自SHA/历史记录不能自授权。未知提交冻结至显式重开，取消等实际读退出。只读slot只显示来源名/摘要/历史等级，未接IPC服务，不补设备库存/actual/saved或全媒体proof。N_boot正式采纳、当前会话库存与固件writer/可信时间/凭据/TLS/G1-G2/24fps仍未签核；本轮未读固件或现场，不改变400-06外部快照。下一临时宿主只读装配继续离线。

## 原 docs/context/plans/native400-manager-alignment-spec.md

## 400-09后的当前入口（2026-11-03）

400-01至05、07至09离线实现及06文档评审已完成；最新[400-09报告](../../reports/2026-11-03-native400-09.md)为43专项/1237回归。来源审阅保存/可信重开和共享只读slot保持独立，不推进wire/设备库存或Flash writer。下一400-10先Spec/Diff，仅显式临时宿主status与owner退出装配；正式合同、真实用途和G1/G2/24fps仍另审。

## 原 docs/context/decisions.md

[43专项/1237全套](../../reports/2026-11-03-native400-09.md)/[API](../../protocol/native400-source-review-storage.md)验证存储、故障恢复和可选只读管理slot，未接服务/IPC或设备；固定wire/400-07/旧尺寸保持。下一400-10仅临时宿主只读status与owner装配先Spec/Diff；真实用途、外部固件/资源/24fps和正式G0独立，来源审阅不变成库存或播放授权。旧入口[归档](native400-09-evolution.md)。
