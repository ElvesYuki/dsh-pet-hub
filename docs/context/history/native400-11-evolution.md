# 400-11替代记录

2026-11-03：以下为评审前原文，由[当前系统](../current-system.md)/[待办](../current-todos.md)及[400-11报告](../../reports/2026-11-03-native400-11.md)替代。只替代400-11待评审/下一入口及旧最新验证摘要；400-10只读实现与400-09持久化等仍有效，原阶段证据不追写为新操作实现。

## 原 docs/context/current-system.md

2026-11-03 [400-10临时宿主来源审阅装配](../../reports/2026-11-03-native400-10.md)已完成离线范围：复用既有UDS选主/鉴权、400-09 owner和共享只读slot，准备阶段仅快照独立批准/摘要身份，赢家才打开固定私有journal目录；attach不建第二owner，不同批准或create策略拒绝attach。新模式仅GET status，旧配置/来源/素材写路由也拒绝；服务/宿主代理双重白名单、坏值503、无设备事实。实际UDS→临时HTTP代理→构建JS宿主fetch/渲染、双进程选主、历史重开/实际复验、取消/unknown/坏档和退出等真实fd已验；36专项/监督CLI清理、check（语法）和含构建1273/1273通过。328条原源中325条SHA保持，仅service/宿主代理/UI标题变更，新增4文件；400-03固定字节、400-07和400-08/09保持。[API/回退](../../protocol/native400-source-review-host.md)、[原创证据](../../protocol/vectors/native400-10-host-review-v1.json)、[旧入口归档](native400-10-evolution.md)。无新CLI/config/默认启动、真实浏览器/DSH加载或生产/设备通道；未读外部源，仍400-06快照。

400-07完整周期预算/24专项仍有效，现全套包含其回归；6720提前renew/原4510 floor、GET-only/整体exchange与源/累计compute、严格计划必要条件和170段先job到期均保持。400-08未接生产/IPC/设备来源，也未重验真实cache或全帧媒体。400-09候选保存/重开和只读槽已验；400-10已验显式临时status/owner退出，下一400-11先评审可信运行层的显式来源选择/独立批准和受限操作入口，继续不从来源审阅生成设备库存授权。

## 原 docs/context/index.md

管理端最新（2026-11-03）：[400-10 Spec](../plans/native400-10-spec.md)/[Diff](../plans/native400-10-diff.md)、[临时宿主装配API](../../protocol/native400-source-review-host.md)、[36专项/1273回归报告](../../reports/2026-11-03-native400-10.md)/[原创证据](../../protocol/vectors/native400-10-host-review-v1.json)、[旧入口归档](native400-10-evolution.md)。独立批准身份、仅UDS赢家开400-09 owner、只读status/代理与构建JS宿主实际fetch渲染、历史重开/实际复验及退出等待已验。默认服务无该slot，无CLI/config或自动启动；外部状态仍400-06快照，无设备/生产通道或真实DSH加载。下一400-11先评审受限的显式离线审阅操作入口；共同G0/用途/安全资源/Flash/G1-G2/24fps另审。

## 原 docs/context/current-todos.md

1. **400-11显式离线审阅操作入口评审（下一入口）**：先Spec/Diff，复用[400-10临时宿主/只读status](../../protocol/native400-source-review-host.md)与400-09 owner。明确可信运行层如何选择私有源文件、独立提供两份批准、页面仅持受限选择引用，以及CAS/取消/unknown显式重开；不得开放页面任意路径读、自动批准/扫描或坏档修复。当前只有赢家内部方法，尚无页面审阅操作/文件选择。只用原创临时数据，不接设备/生产listener/现有服务；真实浏览器/DSH隔离加载与真实源需另有方案/回退，不重复实现journal或选主。

## 原 README.md

[400-10临时宿主只读装配](../../reports/2026-11-03-native400-10.md)：独立批准摘要身份、赢家专属400-09 owner、只读status/代理、构建JS宿主真实fetch与历史重开/退出等待已验；36专项/监督CLI/check/全套1273通过。[API/回退](../../protocol/native400-source-review-host.md)。复现：先`npm run build`，再`node scripts/verify-native400-10.mjs --output .cache/native400-10/results.json`。无新CLI/config或自动启用；下一400-11先评审受限的显式离线审阅操作入口。

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
| 下一入口 | 400-01至05已有离线实现；400-06评审已完成文档范围。400-07周期预算已离线实现，400-08已离线完成，400-09保存/独立批准复验/只读槽已离线完成，400-10临时status/owner装配已离线完成，下一400-11显式离线审阅入口评审；正式策略/协商/运行期写入和G1/G2/24fps另审 |

400-10[报告](../../reports/2026-11-03-native400-10.md)/[API](../../protocol/native400-source-review-host.md)：36专项/监督CLI/check/1273全套通过赢家专属owner、只读status代理与构建JS宿主实际读取、双进程选主/半启动/挂起attach拒绝、历史重开/取消/unknown/坏档/实际退出。无生产或设备通道、真实DSH/browser加载和页面审阅操作；下一先评审受限的显式操作入口。

## 原 docs/protocol/native400-source-review-host.md

下一400-11先评审显式离线审阅操作入口：可信运行层如何选择来源/独立批准、页面只持受限选择引用、CAS与取消/unknown重新打开；不开放任意路径读、自动批准/扫描或账本修复。共同G0、真实用途、N_boot协议/当前库存、Flash writer/proof、可信时间/凭据/TLS、G1/G2/24fps仍另审。本轮外部事实沿用400-06快照，生产/实体窗口须另有具体方案、回退及授权。

## 原 docs/protocol/native400-g0-review.md

4. **400-10临时宿主来源审阅装配（本片离线已完成）**。见[36专项/1273回归](../../reports/2026-11-03-native400-10.md)/[API](../../protocol/native400-source-review-host.md)。只有UDS赢家开journal/owner、只读status与代理白名单及JS宿主真实读取展示已验；重开仅历史、实际复验与退出等待不改原证据等级。不是设备N_boot协议/库存或G1/G2准入。下一400-11仅先评审显式离线操作入口。

## 原 docs/context/plans/round-pet-g0-handoff.md

[API](../../protocol/native400-source-review-host.md)/[36专项与1273回归](../../reports/2026-11-03-native400-10.md)：独立批准内容摘要进入选主身份，只有UDS赢家打开400-09 owner；status与宿主代理双重白名单、实际JS候选读取和退出等待已验。重开historical、unknown/取消/坏源失败均不产生设备事实。当前无页面写路由/真实源/设备通道，不改变任何设备N/P/M/状态版本或Flash格式；400-03原字节保持，真实用途/G0/当前库存/Flash proof/writer/TLS/时间凭据/G1-G2/24fps仍待固件答复与资源证据。本轮不读固件或现场，外部沿400-06快照；下一显式离线操作入口仍先审边界。

## 原 docs/context/plans/native400-manager-alignment-spec.md

## 400-10后的当前入口（2026-11-03）

400-01至05、07至10离线实现及06文档评审已完成；最新[400-10报告](../../reports/2026-11-03-native400-10.md)为36专项/1273回归。来源审阅保存/可信重开和只读status/宿主展示保持独立，不推进wire/设备库存或Flash writer。下一400-11先评审可信运行层的显式选择/独立批准与受限操作入口；正式合同、真实用途和G1/G2/24fps仍另审。

## 原 docs/context/decisions.md

[36专项/1273全套](../../reports/2026-11-03-native400-10.md)/[API](../../protocol/native400-source-review-host.md)已验真实IPC/临时HTTP/构建JS候选读取及双进程选主、历史/取消/unknown/坏档，不代表真实浏览器/DSH或设备验收。外部仍400-06快照，400-03/07/08/09不改；下一400-11先评审受限的显式离线操作入口，真实用途/正式G0/资源窗口独立。旧入口[归档](native400-10-evolution.md)。
