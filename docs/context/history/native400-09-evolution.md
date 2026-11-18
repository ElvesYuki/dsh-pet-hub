# 400-09替代记录

2026-11-03：下列为本轮实施前原文，已由[当前系统](../current-system.md)、[当前待办](../current-todos.md)与[400-09报告](../../reports/2026-11-03-native400-09.md)替代。仅归档400-09仍待实施/旧验证摘要与相关下一入口；400-08 recipe、400-07预算及设备限制继续有效。原阶段文档/测试数量保持各自历史语境。

## 原 docs/context/current-system.md

2026-11-03 [400-08 N_boot只读来源审阅](../../reports/2026-11-03-native400-08.md)已完成离线范围：复用400-01独立批准并增加offline-source-review映射决定，strict V2双根/固定几何/slot/gen/F/uint64/floor、N_boot与候选P/M/N分域；只读私有精确28MiB，64KiB缓冲流式整cache及每个物理引用payload SHA（同F不跳槽）。坏根可降级标记回退，未知I/O不fallback；指纹/路径/改权限/截断/链接/替换/mtime恢复拒绝，取消/期限/close等实际读退出，无源写/自动修复/CAS导入。canonical recipe映射输出device_evidence=false、media_validation=not-performed，不含actual/saved/offline_available或路径。44专项/独立监督CLI正常清理、check（语法）与含构建1194/1194通过；317条原源SHA保持、5新增模块/fixture/测试/CLI、原400-02/03及400-07保持。[API/回退](../../protocol/native400-bootstrap-review.md)、[原创向量/证据](../../protocol/vectors/native400-08-source-review-v1.json)、[被替代记录](native400-08-evolution.md)。

400-06共同G0的[D01–D09](../../protocol/native400-g0-review.md)继续作为待双方决定：N_boot与review P/M/N、Flash可信链、重复touch/local自主与finite remote寿命、正式能力/凭据时间/网络资源仍未签核。D07的条件算术已由400-07补实际宿主对照和检查，不能据此称端侧最坏上界已测。下一400-08只读来源映射，400正式writer/G1-G2/24fps/真实用途与设备窗口另审。

400-07完整周期预算/24专项仍有效，现全套包含其回归；6720提前renew/原4510 floor、GET-only/整体exchange与源/累计compute、严格计划必要条件和170段先job到期均保持。400-08未接生产/IPC/设备来源，也未重验真实cache或全帧媒体。下一400-09先Spec/Diff做审阅产物保存、需新独立批准/复验的可信重开和只读管理投影；不能让自哈希结果/来源审阅变成设备库存授权。

## 原 docs/context/index.md

管理端最新（2026-11-03）：[400-08 Spec](../plans/native400-08-spec.md)/[Diff](../plans/native400-08-diff.md)、[PC来源审阅API/recipe](../../protocol/native400-bootstrap-review.md)、[44专项/1194回归报告](../../reports/2026-11-03-native400-08.md)/[原创映射向量](../../protocol/vectors/native400-08-source-review-v1.json)、[旧记录归档](native400-08-evolution.md)。新增独立mapping用途批准、strict V2/N_boot/双根/uint64/floor/逐F映射和私有28MiB流式整cache/逐物理payload SHA，文件改动/未知IO/取消实际退出已验。317条既有源SHA保持，5新增源/测试/CLI；44专项/监督CLI/check/含构建1194通过。输出只为PC来源审阅，无全媒体校验或设备事实/IPC/服务装配。下一400-09审阅结果保存/可信重开与只读投影；固定wire/400-07/旧尺寸保持，外部现场/资源仍400-06快照，正式G0/用途/TLS/Flash写/G1-G2/24fps未关闭。

## 原 docs/context/current-todos.md

1. **400-09审阅结果保存/可信重开与只读投影（下一入口）**：先Spec/Diff，复用[400-08 recipe/独立批准](../../protocol/native400-bootstrap-review.md)，在显式候选私有目录保存来源审阅结果，重开须重新给candidate/mapping批准并复验源身份/内容；不得只信结果自SHA或账本自带批准。区分历史审阅/当前复验中/失败，失败保旧记录的历史等级；只读管理投影显示来源文件及验证等级，不混入设备actual/saved/库存。保持默认OFF/临时环境，无生产listener/设备/现有配置。

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
| 下一入口 | 400-01至05已有离线实现；400-06评审已完成文档范围。400-07周期预算已离线实现，400-08已离线完成，下一400-09审阅产物保存/可信重开/只读投影；正式策略/协商/运行期写入和G1/G2/24fps另审 |

## 原 README.md

[400-08 N_boot只读来源审阅](../../reports/2026-11-03-native400-08.md)：独立批准/strict V2与候选P/M/N映射、私有28MiB流式SHA/逐物理payload/源变动与实际退出，44专项/监督CLI/check/全套1194项通过；只输出PC来源审阅，不做全媒体校验/设备事实。旧代码和固定wire保持，下一400-09保存/可信重开/只读投影。[API/回退](../../protocol/native400-bootstrap-review.md)。

## 原 docs/protocol/native400-g0-review.md

1. **400-07：完整调度周期预算（本片离线已完成）**。24专项/独立CLI/check/1150回归验证上述实际链和必要修正。不是设备最坏上界，成本超限失败关闭；下一400-08来源审阅。
2. **400-08：N_boot只读来源映射（本片离线已完成）**。见[44专项/1194回归报告](../../reports/2026-11-03-native400-08.md)/[API](../../protocol/native400-bootstrap-review.md)。独立批准/strict header/流式整SHA及逐物理F/实际读退出已验，无全媒体校验或设备证据；下一400-09审阅产物保存/重开/只读投影。
3. **400-09审阅产物保存/重开与只读投影（先独立Spec）**。明确持久结果/独立重新批准/源复验/失败历史及只读展示，不能凭自SHA/来源审阅生成设备库存/保存授权；保持候选默认OFF，不启服务/设备通道。
4. **正式能力/策略与端侧适配（需共同决定）**。D03–D05/D09确认后另立review修订/新profile及Node/C++字节，明确local来源、重复触摸、无限自主策略/有限remote目标、全媒体/缓存proof与期限；双方未采纳前不改变现revision1。固件先提供不联网现场的宿主/构建及新工作集清单。
5. **TLS/持久写入与真实闭环（等待资源证据和独立授权）**。端侧时间/凭据/单owner/实际退出/新内存G1/G2合格、真实用途批准、共同合同后，再审0/11＋physical4缓存闭环，后扩未缓存/保存/淘汰/重连；真实设备动作不由本次继续指令自动启用。

## 原 docs/context/plans/round-pet-g0-handoff.md

1. **400-01离线实现已完成**：[API](../../protocol/native400-identity.md)/[30专项报告](../../reports/2026-11-02-native400-01.md)已交付候选recipe、P/M/N_offline、独立批准及400严格导入/缓存重开主入口；原尺寸仅备份。真实库只读算候选、不创建用途批准/导入。请固件共同审阅新recipe/namespace_scope，正式N/Store仍待定，不把离线N写设备。
2. **400-02离线范围已完成**：[API/决定与待确认](../../protocol/native400-window.md)、[48专项报告](../../reports/2026-11-02-native400-02.md)。真实1MiB ring/独立schema3 review/短尾/XOR/extra/首帧/欠载/失效/同步退出已验，旧schema2/360原义不变。默认全验后重读＋帧SHA，progressive-review只离线；请固件答复两遍/收据7712B/每loop重读或渐进可信链/状态和资源区域，不直接沿用现有PSRAM预算。
3. **400-03/04/05离线已完成／下一共同策略评审**：[字段/完整性及W01–W10待确认](../../protocol/native400-wire-review.md)、[36专项/94正116反报告](../../reports/2026-11-02-native400-03.md)已交独立review表/字节/Node路径头核对和批准元数据pin。不是双方签核；400-04[37专项报告](../../reports/2026-11-02-native400-04.md)/[API](../../protocol/native400-host-review.md)已接原session/guard/A2 reader/A4 lane/queue与新投影/actor的默认OFF临时真实TLS，验证挑战/序列/dispatch/verification引用/取消和实际退出。A8只读根、R7退出原则保持，无Flash写。400-05[35专项报告](../../reports/2026-11-03-native400-05.md)/[API](../../protocol/native400-scheduling-review.md)已完成代码选项调度；下一先Spec/Diff和新鲜只读证据，确认本地源/缺源与失效fallback、周期verification floor、原作业截止/每loop重读成本、GET实际退出/轮询/控制的物理最坏预算及正式协商。400-06已完成本轮只读评审，见[D01–D09](../../protocol/native400-g0-review.md)；400-07已补24专项/1150回归，400-08已补PC只读映射，下一400-09保存/可信重开/只读投影。当前hello不协商调度能力，禁止把可信代码开关当设备支持，不重复承载优化或直接开窗口。
4. **固件先离线、后另获授权窗口**：交400 N/Store持久化、能力、渐进验证、安全身份/单owner资源Spec与构建/宿主证据；再按400冻结维护/G1-G2/24fps门槛。满足后另审首窗口0/11＋physical4及逐项下载/全验/保存/淘汰/重连；本任务不执行现场步骤。

[来源审阅API](../../protocol/native400-bootstrap-review.md)/[44专项与1194回归报告](../../reports/2026-11-03-native400-08.md)：core strict V2/N_boot/双根/uint64/局部floor映射与独立offline-source-review批准、runtime私有28MiB整SHA/逐物理F/文件稳定/实际取消退出已实现。317条原源和固定合同保持。输出只为PC来源文件审阅，media_validation=not-performed/device_evidence=false，不能用合法头/ROM部署/自SHA补whole verified、saved或当前设备库存；源/映射批准不从账本自采纳。真实素材未新导入/批准，未读带NVS整片或执行固件脚本。D01仍需设备侧正式P/M/N/状态版本采纳，D02仍缺当前hello/session库存证据；下一审阅产物保存/重开/只读投影，不自动开真实通道。

## 原 docs/context/decisions.md

[44专项/1194回归](../../reports/2026-11-03-native400-08.md)/[API](../../protocol/native400-bootstrap-review.md)已验证只读私有28MiB/文件变动与实际退出，317条原源保持、5新增文件。原N/profile/wire/400-07与旧尺寸保持，真实cache/媒体/用途和外部驻留未重核。旧待实现记录[归档](native400-08-evolution.md)。下一400-09保存/可信重开与只读投影须重新给独立批准并复验源，不以自哈希结果当授权；正式合同/资源/真实窗口继续独立。
