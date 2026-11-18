# TCP11替代前的共同G0交接

2026-11-05归档：以下为400-01–15/TCP01阶段快照，当前以[共同交接](../plans/round-pet-g0-handoff.md)和TCP11报告为准。旧HTTPS/360、broker前置、版本与预算仅追溯，不作本次准入。

# 给固件任务：400／78动作共同G0决定与待确认项

2026-11-04当前覆盖：用户已改设备主线为明文LAN TCP，优先缓存remote0/1/11、4物理触摸；已确认板上f553与未部署a74f分账，旧6882/HTTPS/mTLS/Range及其预算只作历史，不再作当前默认或前置。当前共同待定与下一入口以[TCP-01对齐](../../protocol/native400-tcp-alignment.md)为准；下方旧阶段表保留追溯，不推导已支持新TCP/保存或取消管理页面权限。broker/native选源后置且独立。

2026-11-03只读复核更新。用户明确当前管理端目标对齐400×400／78动作；360保留兼容回退，分层360不迁移。[Spec/Diff](../plans/native400-manager-alignment-spec.md)、[400基线](../native400-baseline.md)、[核对报告](../../reports/2026-11-02-native400-manager-alignment.md)、[身份/预算证据](../../protocol/vectors/native400-manager-alignment-v1.json)。旧“下一360主线”已[归档](native400-manager-alignment-evolution.md)。本文未发送消息或修改固件，**不是双方签核、生产启用或设备窗口授权**。

## 输入和完成边界

- 当前素材为已批准compact78：400²/466²居中(33,33)，24fps，0–77原ID；42号118帧，其余241。全库348737057B/18675帧/1019额外tag0；完整库/role8逐文件与新摘要已核，不重做画质。
- 400为后续方向，旧尺寸仅备份回退。通用400宿主及400-01离线身份/严格A2主入口已实现；400-02纯core窗口/本地review能力/完整性对照已实现，400-03独立review wire/双语言字节已有，400-04默认OFF临时TLS/actor装配已有，400-05离线touch/latest/自动调度已验证，真实触摸/正式协商与Flash未适配，旧A1/R3–R7专用实现保留备份。现360合同修订2/80正62反保持，规划轮940为历史测试数量，不改名或扩大字段冒充400互操作。
- 400-06新鲜报告/矩阵记6882本地版与N_boot四对象留驻，90秒/1928帧全SHA及用户实屏/触摸返回确认，连续23.297fps/24未验；当前源码另加四前缀预取，资源不沿用旧测量。本任务未探测现场，具体[证据/差异](../../protocol/native400-g0-review.md)。
- 旧固件G0回复是360的单方答复；不能自动作为本400表的同意。联合G0、400维护/安全资源准入保持未关闭。

- 管理操作最新400-14（离线）：[报告](../../reports/2026-11-03-native400-14.md)/[API](../../protocol/native400-interactive-host.md)已接显式默认OFF profile/私有IPC/可信临时页面provider/共享UI，42专项/1395回归；原13会话/gate与reader/journal保持。仅原创源/JS hook宿主/临时HTTP/UDS，不是浏览器/DSH身份/native picker或真实用途批准，更不授权设备缓存/写入。默认无provider只读，400-15已完成静态核对与共享UI浏览器验证，下一400-16可信本地broker交接适配器。无新增固件/现场证据，外部仍400-06快照。

- 400-15补充（未发送/未共同签核）：[provider决定](../../protocol/native400-provider-review.md)/[报告](../../reports/2026-11-03-native400-15.md)。10专项/1405全套及共享UI真实浏览器验证，不变更固件/设备wire/库存授权；只读安装核为DSH rc.5，不继承旧rc.3兼容，真实DSH身份/native picker未接。外部仍400-06快照，下一400-16可信本地交接先离线。

## C01–C12：400目标、已有事实与缺口

| ID | 400管理端规划／已有事实 | 待实现／待固件确认与证据 |
| --- | --- | --- |
| C01 能力/执行 | 目标单压缩窗口＋三RGB（已含前瞻），400/466 center33、24fps、逐动作frames与额外tag0；通用宿主格式已有 | 旧schema2要求完整file≤playback RAM，不能表达1MiB窗口/5.57MB文件。400-02已实现独立本地schema3 review/execution_model=frame_window及实际ring，file/window/RGB/history分开，非正式hello/共同能力；400-04已有临时真实TLS hello/actor，尚无实体装配。固件只读bootstrap已用4+1几何装四对象；尚无400运行期writer，hub persistent=null保持 |
| C02 F/M/P/N/许可 | 新source=a1c7c2a6…，library78 I=5bd657d4…/M_host=0102c312…，role8 I=afdda0e8…/M_host=655d8429…；78 F/实际frames/源与索引/像素身份保持；license_ref=dsh-pet-nc-86181ce、已有视觉批准 | 400-01已实现独立离线recipe/profile/显式400入口，候选P=52b2f6cb…/M_device=094e69be…/N_offline=dd0f19bf…，不同于M_host/I/继承catalog。真实仅算候选、无用途批准/导入；固件已装N_boot=a34d0c7b…，仍须共同确认其与hub P/M/字段映射，hub正式N未定。N_scope仅offline-candidate，不复用360/fixture N或代设备准入 |
| C03 目录/信任 | 78目录在hub，role8仅语义子集；设备只保批准包/当前descriptor及有界元数据；不新增78条常驻工作集 | 400-03 review合同已核P/M/N/descriptor，78项固定每页≤4共20页，极值4项3019B而8项4675B超4KiB；旧46页向量不自动覆盖。渐进播放的头/帧身份链及许可必须明确，不能只信自带CRC |
| C04 状态/完整性/恢复 | desired/actual、accepted、whole-asset verified、首帧playing、saved、当前inventory/offline_available分别独立；saved不激活旧目标 | 固件窗口可先CRC呈现、末尾才F，旧R6先verify再play不适配。400-02默认全验后重读＋逐帧SHA、显式渐进仅离线对照，pending/failed分开；固件本地首用F/播放CRC+增量F与hub首遍全媒体/帧SHA不同，双方仍须选正式策略并核两遍/7712B收据/每loop成本或不可变Flash可信链，未定不开hub未缓存渐进播放。400保存阶段/unknown/恢复读I/O/完整库存及A8 floor待实现，USB Done不作saved |
| C05 手动/触摸/时序 | 首窗口仍保守远端base0/11、physical4单次优先，remote4暂禁；触摸结束回最新有效base，失效后的本地fallback0须另确认合法源；78目录不等于首窗口全开放 | 报告已确认N_boot下0/4/1/11本地安装，但hub当前session库存未实现；旧360缓存不能算400命中，重复点击/回0策略与400-05不同。42仅118帧/末帧117、其余241/末帧240，400-02本地loop/once_hold/迟到/短尾已验，正式规则及seek另冻新向量，400-04已验idle local4独立证据，400-05已验单窗口local4/latest/deferred/原截止/loop/欠载/实际退出，真实触摸/正式策略协商/管理UI未接 |
| C06 刷新/维护/缓冲 | playing须当前frame/context/generation软件刷新提交；400有priming/buffering/resuming、保front/平移时钟；真实面板扫描不由ACK证明 | 下载/保存维护与欠载冻结须分别投影，不把窗口播放全套旧360 loading冻结语义，不承诺维护持续播放。400-02本地opaque首帧/短尾/欠载/迟到平移已验；真实draw/重复像素及公共buffer状态版本待定 |
| C07 wire/版本 | 建议独立400 wire profile，明确400媒体/新能力/状态版本；复用HTTP关联与guard不变量 | 现round-pet-native360-wire/1修订2与80正62反保持兼容；400-03已冻结独立round-pet-native400-wire-review/1/revision1、94正116反宿主字节，400-04临时装配已验，待双方正式profile/策略/版本采纳。USB ACK V2不是hub revision2，不换名直连 |
| C08 gate/保存/取消 | R7失效后一次本地收尾、旧网络/播放失效、unknown不重写/不补saved、实际退出前不放owner的原则保留 | 400流式接收/暂存/全验/提交gate/marker/读回与撤销边界待固件Spec；旧Store writer为360；400已有只读bootstrap Catalog，但无运行期保存writer。不能将R7同步Memory事务当400物理事务，原12次/60秒策略如沿用需确认具体生命周期 |
| C09 pull/期限 | 单TLS/单HTTP owner、control/素材段串行、段后exchange；至多一在途control/一latest/一待段，有界紧急标志，不延TTL | 1MiB窗credit/24帧预缓冲、网络片段/帧前沿/验证/写入调度与暂停恢复须共同预算；当前USB32KiB credit不是HTTPS实测。全验/Flash残余/guard/取消实际退出上界未知仍NO_GO |
| C10 身份/可信时间 | 不用IP/Bearer推导身份、不因断线自动降级；正式持久证书/epoch/撤销/重绑定与RAM探针分开 | 400候选无Wi-Fi/mTLS，需可信时间引导/日期失败、秘密/epoch原子持久化、撤销重绑定/丢钥恢复及独立资源Spec；旧loopback不能代端侧证据 |
| C11 资源/维护/G1/G2 | 已报告窗口显式PSRAM2322168B（含1MiB环/三RGB-history1120000/其余元数据/IO），内部scratch20160B及16+8KiB任务栈另计；文件均≤5865472 | 6882无网络动态门禁已有报告；当前新增预取至少2107136B不能沿用旧预算。400完整维护/保存恢复未实现、24fps未过、TLS峰值/最大内部块/新栈/实际退出缺证。保持内部48KiB、PSRAM1MiB/块512KiB、main1KiB、2MiB app/余256KiB目标；400无Wi-Fi动态值及360 G1/P3均不作新准入 |
| C12 namespace/控制源/回退 | 不改现有分区/V2缓存；360媒体/代码/旧合同与67/a7/原cbdf保留；新旧网络owner显式互斥，不停整个pet/bridge来隔离 | N_boot/只读400 geometry/Catalog已有且已装，hub映射/持久写能力与360共存/切换仍待定；fixture/review N不能启生产。应用/配置语义/凭据epoch/缓存分别恢复，不能恢复旧根降floor或把USB候选变自动fallback |

## 下一次独立切片与固件答复要求

1. **400-01离线实现已完成**：[API](../../protocol/native400-identity.md)/[30专项报告](../../reports/2026-11-02-native400-01.md)已交付候选recipe、P/M/N_offline、独立批准及400严格导入/缓存重开主入口；原尺寸仅备份。真实库只读算候选、不创建用途批准/导入。请固件共同审阅新recipe/namespace_scope，正式N/Store仍待定，不把离线N写设备。
2. **400-02离线范围已完成**：[API/决定与待确认](../../protocol/native400-window.md)、[48专项报告](../../reports/2026-11-02-native400-02.md)。真实1MiB ring/独立schema3 review/短尾/XOR/extra/首帧/欠载/失效/同步退出已验，旧schema2/360原义不变。默认全验后重读＋帧SHA，progressive-review只离线；请固件答复两遍/收据7712B/每loop重读或渐进可信链/状态和资源区域，不直接沿用现有PSRAM预算。
3. **400-03/04/05离线已完成／下一共同策略评审**：[字段/完整性及W01–W10待确认](../../protocol/native400-wire-review.md)、[36专项/94正116反报告](../../reports/2026-11-02-native400-03.md)已交独立review表/字节/Node路径头核对和批准元数据pin。不是双方签核；400-04[37专项报告](../../reports/2026-11-02-native400-04.md)/[API](../../protocol/native400-host-review.md)已接原session/guard/A2 reader/A4 lane/queue与新投影/actor的默认OFF临时真实TLS，验证挑战/序列/dispatch/verification引用/取消和实际退出。A8只读根、R7退出原则保持，无Flash写。400-05[35专项报告](../../reports/2026-11-03-native400-05.md)/[API](../../protocol/native400-scheduling-review.md)已完成代码选项调度；下一先Spec/Diff和新鲜只读证据，确认本地源/缺源与失效fallback、周期verification floor、原作业截止/每loop重读成本、GET实际退出/轮询/控制的物理最坏预算及正式协商。400-06已完成本轮只读评审，见[D01–D09](../../protocol/native400-g0-review.md)；400-07已补24专项/1150回归，400-08已补PC只读映射，400-09保存/可信重开/只读投影已离线完成，400-10后续仅临时status装配已验。当前hello不协商调度能力，禁止把可信代码开关当设备支持，不重复承载优化或直接开窗口。
4. **固件先离线、后另获授权窗口**：交400 N/Store持久化、能力、渐进验证、安全身份/单owner资源Spec与构建/宿主证据；再按400冻结维护/G1-G2/24fps门槛。满足后另审首窗口0/11＋physical4及逐项下载/全验/保存/淘汰/重连；本任务不执行现场步骤。

固件答复请逐项给接受/拒绝/修订理由及精确文件/构建/合同SHA；新400表不能由旧360回复或本仓库宿主oracle代签。独立profile/字段未冻结前不开放新通道，不提升cap、不延TTL、不格式化或自动清库存。

## 本轮回退

本表是共同审阅文档；400-02代码回退见[实现报告](../../reports/2026-11-02-native400-02.md)。无格式/namespace/批准/运行数据迁移；不撤回360/R7或改已有确认指针。未来设备操作前再冻结新鲜app/ELF/表/配置语义/epoch/完整缓存与备份；参考旧报告不是恢复授权。当前服务/固件/pet/桥接/DSH均未更改，无消息发送。

## 400-05新增共同决定请求（2026-11-03，未发送/未签核）

- **管理端离线已实现**：显式本地4号全验/重读/首帧，touch.started/ended与deferred_local/ready；旧GET先实际退出再切同一池，恢复最新有效base从0重验；原作业截止不被touch/renew/loop延长；无latest只保已知画面；关闭/迟到proof不能复活。35专项仅宿主模拟。
- **待固件确认**：本地4号的实际来源/批准与可用报告；0号缺省fallback是否同样可验证且在失效后合法独立播放；单TLS/HTTP正常段退出上界、解码/帧/控制/Flash不可抢占残余及最坏预算；周期验证高水位能否端侧实现；两遍/7712B和每loop重读是否采纳。
- **待实现/正式合同决定**：策略/本地源与作业截止的能力协商（当前只是可信代码参数）；400正式N/持久化/gate/保存/淘汰恢复及G1/G2/时间/凭据。若需字段/版本先补合同与Node/C++向量，不静默扩大revision1；现有未知Flash/null不能被本轮local成功覆盖。

上述400-05段为当时交接；本轮400-06已新读固件文件，未访问现场。当前结论以[D01–D09](../../protocol/native400-g0-review.md)/[35文件SHA报告](../../reports/2026-11-03-native400-06.md)为准，正式签核/设备窗口仍需另审。

## 400-07 D07实现补充（2026-11-03，未发送/未签核）

[完整周期API](../../protocol/native400-cycle-budget.md)/[报告](../../reports/2026-11-03-native400-07.md)：旧6001/499/999链已在真实私有TLS/local读复现；6720提前触发、整体exchange500/源1000/累计compute100检查和读前控制机会修正，原4510拒绝floor/15000租约/120秒作业保持。170段原创媒体在lease有效时先job失败，显式requireBudget可提前拒绝声明计划，fits不代物理上界。端侧仍须交完整实际周期/单TLS owner/退出/时钟凭据与资源证据；无正式策略/能力/新wire变更，当前400-03固定字节保持。下一N_boot只读来源审阅，不自动开设备窗口。

## 400-08 D01/D02实现补充（2026-11-03，未发送/未签核）

[来源审阅API](../../protocol/native400-bootstrap-review.md)/[44专项与1194回归报告](../../reports/2026-11-03-native400-08.md)：core strict V2/N_boot/双根/uint64/局部floor映射与独立offline-source-review批准、runtime私有28MiB整SHA/逐物理F/文件稳定/实际取消退出已实现。317条原源和固定合同保持。输出只为PC来源文件审阅，media_validation=not-performed/device_evidence=false，不能用合法头/ROM部署/自SHA补whole verified、saved或当前设备库存；源/映射批准不从账本自采纳。真实素材未新导入/批准，未读带NVS整片或执行固件脚本。D01仍需设备侧正式P/M/N/状态版本采纳，D02仍缺当前hello/session库存证据；400-09后续已验保存/重开/只读槽，不自动开真实通道。

## 400-09 D01/D02保存与证据等级补充（2026-11-03，未发送/未签核）

[API](../../protocol/native400-source-review-storage.md)/[43专项与1237回归](../../reports/2026-11-03-native400-09.md)：PC来源map可保存为私有有界CAS历史，重开重新给两份独立批准且实际源完整重验后才是本次通过；自SHA/历史记录不能自授权。未知提交冻结至显式重开，取消等实际读退出。只读slot只显示来源名/摘要/历史等级，未接IPC服务，不补设备库存/actual/saved或全媒体proof。N_boot正式采纳、当前会话库存与固件writer/可信时间/凭据/TLS/G1-G2/24fps仍未签核；本轮未读固件或现场，不改变400-06外部快照。临时宿主只读装配已由400-10离线完成。

## 400-10宿主装配补充（2026-11-03，未发送/未签核）

[API](../../protocol/native400-source-review-host.md)/[36专项与1273回归](../../reports/2026-11-03-native400-10.md)：独立批准内容摘要进入选主身份，只有UDS赢家打开400-09 owner；status与宿主代理双重白名单、实际JS候选读取和退出等待已验。重开historical、unknown/取消/坏源失败均不产生设备事实。400-10本身无页面写路由，400-14另有默认OFF临时私有操作；均无真实源/设备通道，不改变任何设备N/P/M/状态版本或Flash格式；400-03原字节保持，真实用途/G0/当前库存/Flash proof/writer/TLS/时间凭据/G1-G2/24fps仍待固件答复与资源证据。本轮不读固件或现场，外部沿400-06快照；后续400-11已审边界、12/13内部实现与14临时交互已完成；真实浏览器/DSH身份/native picker仍待验。

## 400-11操作控制设计补充（2026-11-03，未发送/未签核）

[评审](../../protocol/native400-source-review-controls.md)/[报告](../../reports/2026-11-03-native400-11.md)：管理端400-12已绑定选择时文件与任务内实际fd，13已补可信会话/有界请求去重/定向取消/同步提交授权gate，14已补显式临时交互profile；原400-10只读和设备协议字节保持。两项原创探针仅核既有API边界，不读固件/现场；不授予真实源新用途、全媒体proof/设备库存、Flash writer或G1/G2准入。400-12内部选择绑定已离线完成，不代表设备资源验证，原生picker/可信页面身份及真实源/设备窗口仍另审。

## 400-12选择绑定补充（2026-11-03，未发送/未签核）

[API](../../protocol/native400-source-selection.md)/[35专项与1308回归](../../reports/2026-11-03-native400-12.md)：PC元数据选择短fd关闭后发内部引用，实际reader首读前对所选指纹、撤销后manager提交检查已验；不修改固件/N_boot/分区/缓存/协议，也不扩来源用途或库存证明。只有选择相关子范围，可信审阅会话/定向取消/完整授权gate与页面写路由均待后续。本轮不读固件/现场，外部沿400-06快照；G0/Flash proof/writer/可信时间凭据/TLS/G1-G2/24fps独立。

## 400-13内部控制补充（2026-11-03，未发送/未签核）

[API](../../protocol/native400-review-controller.md)/[45专项与1353回归](../../reports/2026-11-03-native400-13.md)：可信内部单会话/选择/任务、ACK去重/定向job取消/同步授权提交gate与真实退出已验；unknown至可信重开、不称回滚。不是浏览器/DSH页面授权或设备会话能力；旧设备wire/proof/格式保持，真实用途/G0/资源/TLS时间凭据/Flash writer/G1-G2/24fps独立，本轮不读固件/现场，沿400-06快照。400-14临时交互已离线完成；400-15已完成该评审/共享UI真实浏览器验证，下一400-16可信本地broker交接先离线。
