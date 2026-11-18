# 400-01离线身份实现演进

2026-11-02。用户进一步明确400是最终方向，旧尺寸暂作备份；本轮关闭400身份/recipe/明确profile导入的离线缺口，不声称生产N/能力/wire/Flash已完成。当前[API](../../protocol/native400-identity.md)、[报告](../../reports/2026-11-02-native400-01.md)。历史链接按原位置解释。

## 原 docs/context/native400-baseline.md

```text
# 当前管理端目标：1.75C-EN／400×400／78动作

2026-11-02，用户确认后续管理端规划对齐已批准compact78。**这是当前开发目标，不是400已部署或24fps/持久化/TLS已验收。** [Spec/Diff](plans/native400-manager-alignment-spec.md)、[核对报告](../reports/2026-11-02-native400-manager-alignment.md)、[共同G0](plans/round-pet-g0-handoff.md)、[素材交付](../protocol/native400-device-handoff.md)。360实现/媒体/固件作为[兼容与回退](native360-baseline.md)保留，分层角色仍用360坐标。

| 维度 | 当前确认与限制 |
| --- | --- |
| 板/几何 | 一块ESP32-S3-Touch-AMOLED-1.75C-EN，466²屏，400²素材1:1居中(33,33)，裁区(124,-6,400,400)，无额外安全圆/逐动作位移 |
| 目录/时序 | 78个原ID0–77；24fps，42号118帧/其他77项241帧，共18675帧。末帧分别117/240，不能补帧或延时补齐 |
| 媒体格式 | PET4/flag1/key12/tile20，每tile8000B；256项RGB565调色板、8位索引，逐帧tag决定完整/XOR；本版1019个额外tag0 |
| 当前批准版 | recipe=native400-compact-approved-v1，宿主profile=native400-candidate-v1，license_ref=dsh-pet-nc-86181ce；视觉批准不等于A2用途/设备准入 |
| 文件身份 | source manifest a1c7c2a6…、全库I=5bd657d4…/M_host=0102c312…、role8 I=afdda0e8…/M_host=655d8429…；精确值见[证据](../protocol/vectors/native400-manager-alignment-v1.json) |
| 体积 | 全78共348737057B；最大67号5569645B＜旧payload上限5865472B；role8共31877424B＞28MiB，不承诺8项或78项全离线 |
| 身份未决 | M_host/I/来源catalog不是未来M_device/P400；生产N400未定/未安装，早期fixture N和360 N不能复用。现有V2缓存仍360/seq5/0、4、1、11，不作为400命中 |
| 管理端代码 | 通用400解码/流式仓库/角色激活/IPC像素与恢复已有宿主验证；A1/A2/新wire/R7专用执行仍360/46，400设备模型/能力/协议适配待实现 |
| 执行方向 | 最新固件候选为单1MiB压缩窗口＋三RGB（含前瞻），encoded=0；最大24帧payload688702B。本模式不能谎报为schema2完整encoded RAM，需新能力版本/明确完整性状态 |
| 显式资源 | 窗口候选PSRAM2322168B，内部scratch20160B，worker16KiB/I/O8KiB另计；无Wi-Fi/生产TLS/400持久保存。不是整机硬上界或可分配TLS余量 |
| 真机证据引用 | compact78四动作0/4/42/67共841帧CRC/整段SHA及无Wi-Fi内存通过，12.395–15.057fps，24未过；预定受控停供/切换/CRC负例未执行；新ACK/短锁候选仅宿主/构建，未部署 |
| 驻留/回退引用 | 最新只读矩阵/执行清单记外部最高性能0dcdf6be窗口执行中，应用部署/保护核对、设备下载模式，读取时尚无新FPS；上一窗口原cbdf/360缓存恢复是历史结束态，不作当前驻留。本任务未探测/干预，后续状态看固件矩阵；67/a7及旧媒体保护 |
| 下一入口 | 400-01身份/recipe和profile；400-02能力/窗口/可变时序与渐进验证选择；400-03新合同/向量；400-04默认OFF装配。详见Spec的小切片与C01–C12 |

资源与验收保持内部≥48KiB、PSRAM≥1MiB/最大块≥512KiB、main栈≥1KiB及2MiB app/≥256KiB余量目标；TLS连续内部块/新任务栈、网络延迟/实际退出和400持久化阈值须另冻后测。360 G1历史失败是风险证据，不是400门槛通过；400无Wi-Fi余量也不能替代G1/G2。未定参数继续NO_GO，不延TTL、不降低校验或吞ACK故障。

本轮只改规划/证据，未迁移生产实现、namespace、分区/缓存/配置；不接设备、生产listener或现有pet/桥接/DSH。新素材许可与MIT分开，未新增真实A2批准或CAS导入。

读取期间固件codec/decoder/window入口/CMake并发增加PACKED_RGB优化，已重读并在证据中保留前后SHA；收尾前又读到0dcdf6be执行清单，宿主/构建已通过、静态PSRAM仍2322168B，外部窗口执行中尚无新FPS/TLS证据；不从静态构建推断动态资源通过，未来窗口须重新冻结。
```

## 原 docs/context/plans/round-pet-g0-handoff.md

```text
# 给固件任务：400／78动作共同G0决定与待确认项

2026-11-02。用户明确当前管理端目标对齐400×400／78动作；360保留兼容回退，分层360不迁移。[Spec/Diff](native400-manager-alignment-spec.md)、[400基线](../native400-baseline.md)、[核对报告](../../reports/2026-11-02-native400-manager-alignment.md)、[身份/预算证据](../../protocol/vectors/native400-manager-alignment-v1.json)。旧“下一360主线”已[归档](../history/native400-manager-alignment-evolution.md)。本文未发送消息或修改固件，**不是双方签核、生产启用或设备窗口授权**。

## 输入和完成边界

- 当前素材为已批准compact78：400²/466²居中(33,33)，24fps，0–77原ID；42号118帧，其余241。全库348737057B/18675帧/1019额外tag0；完整库/role8逐文件与新摘要已核，不重做画质。
- 通用400解码/仓库/角色/IPC像素/恢复已宿主验证；A1/A2/R3–R7专用实现仍360/46/旧N，新能力/400设备执行和协议未实现。现360合同修订2/80正62反及940测试保持，不改名或扩大字段冒充400互操作。
- 固件最新400路径为1MiB压缩窗口/三RGB，encoded=0，无Wi-Fi和新持久安装；400@24尚未过。收尾前最新矩阵/清单记外部0dcdf6be最高性能应用部署/保护核对窗口执行中、读取时暂无新FPS；此前cbdf恢复为上一窗口结束记录。新0d宿主/构建不作性能准入，本任务仅只读文件，未探测或干预设备。
- 旧固件G0回复是360的单方答复；不能自动作为本400表的同意。联合G0、400维护/安全资源准入保持未关闭。

## C01–C12：400目标、已有事实与缺口

| ID | 400管理端规划／已有事实 | 待实现／待固件确认与证据 |
| --- | --- | --- |
| C01 能力/执行 | 目标单压缩窗口＋三RGB（已含前瞻），400/466 center33、24fps、逐动作frames与额外tag0；通用宿主格式已有 | 旧schema2要求完整file≤playback RAM，不能表达1MiB窗口/5.57MB文件。建议新能力schema3/execution_model=frame_window（草案），file/window/RGB/history/永久槽分开；尚无400完整hello/实体装配。4+1仅存储几何目标，未实现时persistent=null |
| C02 F/M/P/N/许可 | 新source=a1c7c2a6…，library78 I=5bd657d4…/M_host=0102c312…，role8 I=afdda0e8…/M_host=655d8429…；78 F/实际frames/源与索引/像素身份保持；license_ref=dsh-pet-nc-86181ce、已有视觉批准 | M_host/I/继承catalog SHA不作M_device/P400。400-01须冻结新设备catalog/package整数recipe、P/M_device/N及独立用途输入。正式N未定/未安装，禁止复用360 N或早期fixture N。视觉批准/来源/用途和设备准入分别记录 |
| C03 目录/信任 | 78目录在hub，role8仅语义子集；设备只保批准包/当前descriptor及有界元数据；不新增78条常驻工作集 | 新P/M_device/N绑定、78项分页/整体body≤4KiB和每页≤8（至少10页，必要时更少条目）须新合同/字节验证；旧46页向量不自动覆盖。渐进播放的头/帧身份链及许可必须明确，不能只信自带CRC |
| C04 状态/完整性/恢复 | desired/actual、accepted、whole-asset verified、首帧playing、saved、当前inventory/offline_available分别独立；saved不激活旧目标 | 固件窗口可先CRC呈现、末尾才F，旧R6先verify再play不适配。双方须选渐进播放完整性字段/策略，或先全验再重读/暂存的成本；未定不开hub未缓存渐进播放。400保存阶段/unknown/恢复读I/O/完整库存及A8 floor待实现，USB Done不作saved |
| C05 手动/触摸/时序 | 首窗口仍保守远端base0/11、physical4单次优先，remote4暂禁；触摸结束回最新有效base，失效回idle0；78目录不等于首窗口全开放 | 需新N下合法400初始0/4及当前库存；旧360缓存0/4/1/11不能算400命中。42仅118帧/末帧117、其余241/末帧240，loop/once规则与到期/短尾/seek须新向量，真实UI/触摸适配未接 |
| C06 刷新/维护/缓冲 | playing须当前frame/context/generation软件刷新提交；400有priming/buffering/resuming、保front/平移时钟；真实面板扫描不由ACK证明 | 下载/保存维护与欠载冻结须分别投影，不把窗口播放全套旧360 loading冻结语义，不承诺维护持续播放。首帧/尾帧、迟到draw/重复像素和buffer状态新版本待定 |
| C07 wire/版本 | 建议独立400 wire profile，明确400媒体/新能力/状态版本；复用HTTP关联与guard不变量 | 现round-pet-native360-wire/1修订2与80正62反保持兼容；新400字段/错误/能力/分页/42时序及Node-C++golden须另冻/双方采纳。USB ACK V2不是hub revision2，不换名直连 |
| C08 gate/保存/取消 | R7失效后一次本地收尾、旧网络/播放失效、unknown不重写/不补saved、实际退出前不放owner的原则保留 | 400流式接收/暂存/全验/提交gate/marker/读回与撤销边界待固件Spec；当前Store只支持360，窗口候选不写Flash。不能将R7同步Memory事务当400物理事务，原12次/60秒策略如沿用需确认具体生命周期 |
| C09 pull/期限 | 单TLS/单HTTP owner、control/素材段串行、段后exchange；至多一在途control/一latest/一待段，有界紧急标志，不延TTL | 1MiB窗credit/24帧预缓冲、网络片段/帧前沿/验证/写入调度与暂停恢复须共同预算；当前USB32KiB credit不是HTTPS实测。全验/Flash残余/guard/取消实际退出上界未知仍NO_GO |
| C10 身份/可信时间 | 不用IP/Bearer推导身份、不因断线自动降级；正式持久证书/epoch/撤销/重绑定与RAM探针分开 | 400候选无Wi-Fi/mTLS，需可信时间引导/日期失败、秘密/epoch原子持久化、撤销重绑定/丢钥恢复及独立资源Spec；旧loopback不能代端侧证据 |
| C11 资源/维护/G1/G2 | 已报告窗口显式PSRAM2322168B（含1MiB环/三RGB-history1120000/其余元数据/IO），内部scratch20160B及16+8KiB任务栈另计；文件均≤5865472 | 400完整维护/保存恢复未实现、24fps未过、TLS峰值/最大内部块/新栈/实际退出缺证。保持内部48KiB、PSRAM1MiB/块512KiB、main1KiB、2MiB app/余256KiB目标；400无Wi-Fi动态值及360 G1/P3均不作新准入 |
| C12 namespace/控制源/回退 | 不改现有分区/V2缓存；360媒体/代码/旧合同与67/a7/原cbdf保留；新旧网络owner显式互斥，不停整个pet/bridge来隔离 | 新400N/geometry/validator、持久能力与360共存/切换/恢复待定；fixture N只读诊断不能启生产，compact N未安装。应用/配置语义/凭据epoch/缓存分别恢复，不能恢复旧根降floor或把USB候选变自动fallback |

## 下一次独立切片与固件答复要求

1. **400-01（可先离线）**：新400身份/设备recipe/profile与78/可变timing适配；明确M_host/M_device/P/I/source/N映射，准备原创正反向量与独立用途审阅记录。具体字段和生产N须固件共同确认；本轮不创建approval/真实导入。
2. **400-02（可先离线）**：能力新版本/帧窗口/短尾/extra tag0、首帧/完整性/取消与退出模型。先决定是否允许渐进播放，再写验证/playing组合；保留旧schema2/360拒绝行为，不谎报RAM。
3. **400-03/04（依赖前两片与共同选择）**：独立400字节合同/HTTP附录与双语言宿主向量，再默认OFF临时session/guard/A2/A3/A4/A8/actor装配，复用R7失效规则，不重复既有承载优化。
4. **固件先离线、后另获授权窗口**：交400 N/Store持久化、能力、渐进验证、安全身份/单owner资源Spec与构建/宿主证据；再按400冻结维护/G1-G2/24fps门槛。满足后另审首窗口0/11＋physical4及逐项下载/全验/保存/淘汰/重连；本任务不执行现场步骤。

固件答复请逐项给接受/拒绝/修订理由及精确文件/构建/合同SHA；新400表不能由旧360回复或本仓库宿主oracle代签。独立profile/字段未冻结前不开放新通道，不提升cap、不延TTL、不格式化或自动清库存。

## 本轮回退

撤回本轮规划/证据即可，无格式/namespace/批准/运行数据迁移；不撤回360/R7或改已有确认指针。未来设备操作前再冻结新鲜app/ELF/表/配置语义/epoch/完整缓存与备份；参考旧报告不是恢复授权。当前服务/固件/pet/桥接/DSH均未更改，无消息发送。
```

## 原 docs/context/round-pet-hub-baseline-alignment.md

```text
# 管理端共同G0：400目标与360兼容差异

2026-11-02，[Spec/Diff](plans/native400-manager-alignment-spec.md)、[400基线](native400-baseline.md)、[报告](../reports/2026-11-02-native400-manager-alignment.md)、[当前C01–C12](plans/round-pet-g0-handoff.md)。旧360主线规划已[归档](history/native400-manager-alignment-evolution.md)。目标对齐不改变当前实现或设备驻留，联合G0/G1/G2未关闭。

| 项目 | 已实现/已核对 | 400待适配或待共同确认 |
| --- | --- | --- |
| 目标/几何 | 最新批准库400²/78/center33；通用宿主profile/画布支持 | 当前主线改400，旧360/46/center53专用core/wire保留兼容，不假称已迁移 |
| 文件/时序 | 新manifest/F/全78和role8身份一致；42=118/其他241，24fps；1019额外tag0 | 专用A2/Native360/协议仍固定46/241；新严格recipe/variable timing与真实用途输入待实现 |
| 身份/许可 | I/运行时M_host/源和provenance/视觉批准分开核；dsh-pet-nc-86181ce保持 | 未来M_device/P400/N未冻，不能用M_host/继承catalog/360 N代替；视觉批准不自证A2用途/设备授权 |
| 能力/RAM | 400通用parser/仓库/激活/IPC/恢复宿主通过；固件窗口1MiB/三RGB已宿主构建 | schema2 maxfile≤playback RAM不适配frame_window，建议新能力schema/显式execution_model；非只改解析器，persistent未实现报null |
| 首帧/全验 | 旧R6模型完整verify→首帧；400候选逐帧CRC→呈现→末尾全F | 明确渐进播放的完整性状态或先全验/重读成本，不能用首帧/USB Done代verified/saved；未决不开hub未缓存路径 |
| 状态/保存/库存 | A3/A8/R7相关性/floor/unknown原则可复用；当前360 Flash已验 | 新400Store/N/geometry/validator及保存/淘汰/恢复未实现；28MiB/4+1是几何目标，旧缓存不能映射400可用 |
| 手动/触摸/维护 | R2保守0/11+physical4模型，400欠载保front模型已有 | 新N合法初始库存、400触摸/UI/缓冲与保存维护的投影、短尾/loop/取消/迟到draw需新向量 |
| 协议/调度/认证 | 旧360 revision2/80正62反/R4–R7及减量保持，通用有界owner/guard可复用 | 新400 profile/能力/状态/78分页/HTTP/双端golden、TLS/时间/持久凭据/实际退出预算待交付，USB ACK版本不作互操作证明 |
| 资源/驻留 | 已报告400窗口显式2322168B PSRAM；4bae841帧完整性/无Wi-Fi内存样本通过但24fps失败，e6fe/410为此前构建；最新外部0dcdf6be最高性能窗口执行中/尚无新FPS，原cbdf恢复是上一窗口结束态 | 400维护/保存/网络/G1-G2必须专用实测，旧360 G1失败或P3/400无Wi-Fi余量均不能放行，不降低内部48KiB等门禁 |
| 回退 | 360源码/协议/媒体与67/a7/原cbdf/旧400整套目录保留 | 先共同定义新N与共存/选择，未来app/配置/epoch/N/完整缓存分别核验，不改分区或自动迁移/降floor |

本轮只读核78媒体/头/表/tag/来源链和22份固件证据，不重编码/重解全库、不真实A2导入、不运行固件脚本/构建/测试。完整值和范围见报告；固件旧hub快照不覆盖本仓库R7/940结果，dirty HEAD也不等于部署身份。

下一入口按400-01身份/recipe、400-02能力/执行/完整性选择、400-03新合同/向量、400-04默认OFF装配。先离线，每片先Spec/Diff；实体资源与持久化等待固件交付及另行窗口，不再把真实360审阅作为当前主线下一任务。
```

## 原 docs/context/current-system.md

```text
用户确认当前管理端主线对齐1.75C-EN／400×400／78动作：466²屏center33、24fps、42号118帧/其余241帧，采用已批准compact78，见[当前400基线](native400-baseline.md)、[对齐Spec/Diff](plans/native400-manager-alignment-spec.md)、[报告](../reports/2026-11-02-native400-manager-alignment.md)。这是开发目标更新，专用core/A2/wire/执行仍360兼容，400设备能力/持久化/协议适配未完成。360媒体/源码/合同和67/a7保留[兼容回退](native360-baseline.md)，分层360坐标不迁移；旧“下一真实360库审阅”不再是主线。

2026-11-02[管理端400规划核对](../reports/2026-11-02-native400-manager-alignment.md)完成：78 F/头/实际frames/帧表/tag/tile及library78/role8身份匹配，新source=a1c7c2a6…、I=5bd657d4…/M_host=0102c312…、role8 I=afdda0e8…/M_host=655d8429…；总348737057B/18675帧，额外tag0=1019、最大24帧payload688702B＜1MiB。全帧CRC/RGB/seek沿用同SHA旧证明，未重复解码/源视频读取，未真实A2导入或创建批准。能力schema2的完整file≤playback RAM约束不适配1MiB帧窗口；新能力版本/400 M_device-P-N/渐进播放完整性语义待定，旧360合同不放宽。窗口显式PSRAM2322168B、内部scratch20160B/worker16KiB＋I/O8KiB是无网络候选口径，不作TLS或硬上界。下一400-01至04，当前[C01–C12](plans/round-pet-g0-handoff.md)已改为400；[旧主线归档](history/native400-manager-alignment-evolution.md)。check/含构建940通过，无新增测试或源码变更。
```

## 原 docs/context/current-todos.md

```text
1. **400-01身份/recipe与400-02能力/执行模型**：[规划对齐](plans/native400-manager-alignment-spec.md)已完成本轮文档/只读核对。下一先各自Spec/Diff，冻结新400设备catalog与P/M_device/N、78 ID/42实际frames/extra tag0、对应独立用途输入，不能用现M_host/I/视觉批准/旧360 N代替。随后纯core支持file大小与1MiB窗口分离的新能力版本、三RGB/缓冲/实际frames/首帧/取消退出；先共同选择渐进播放完整性状态或先全验/重读方案，不谎报RAM或将单帧CRC当全F。保留360/schema2/旧合同拒绝与回退，不重做画质或既有承载优化。
2. **400-03共同wire、400-04默认OFF装配与固件资源交付**：见[共同C01–C12](plans/round-pet-g0-handoff.md)。依赖400-01/02及固件确认，新400 profile/能力/回执/78分页/118帧/HTTP关联和Node-C++向量另冻，不扩大旧360 revision2或用USB ACK V2代签核；再复用session/guard/A2/A3/A4/A8/R7接新actor临时离线链。固件另交400 N/Store保存恢复、渐进完整性、安全身份/单TLS owner/可信时间/凭据持久化/撤销和400维护/G1-G2预算与构建证据。400@24未过、无Wi-Fi内存不代TLS；保留内部48KiB等门禁及实际退出规则。未来设备窗口须另行授权/具体回退/新鲜app/配置语义/epoch/N/完整缓存冻结，本任务不操作现场。
3. **分层角色包宿主接入设计**：L1–L3当前桌面工具及[高分屏显示/放大检查](../reports/2026-10-30-character-hidpi.md)已完成，见[L3宿主验收](../reports/2026-10-30-layered-character-l3.md)。下一先写Spec/Diff，确定日常角色管理/独立窗口的入口、新包类型、PET4与分层的单一画面所有权、异步资源交接/回退及持久确认；不重复包导出/独立加载或同后端等效原型。跨浏览器/设备、长期资源仍待验；360/46动作/11发束保持，真实音频继续延后真机。
```

## 原 docs/context/index.md

```text
管理端最新（2026-11-02）：[400目标基线](native400-baseline.md)、[规划Spec](plans/native400-manager-alignment-spec.md)/[Diff](plans/native400-manager-alignment-diff.md)、[核对报告](../reports/2026-11-02-native400-manager-alignment.md)、[身份/资源证据](../protocol/vectors/native400-manager-alignment-v1.json)、[共同G0交接](plans/round-pet-g0-handoff.md)、[旧主线归档](history/native400-manager-alignment-evolution.md)。当前规划改400²/78，42号118帧/其他241，额外tag0与新素材身份已核；通用400宿主已有，专用A1/A2/wire仍360兼容，新能力/窗口完整性/P-N及持久执行待适配。360留回退、分层360不迁移；400@24/G1-G2与共同签核未通过。本轮check/940项回归通过，无源码/外部服务变化。下一400-01至04，不再推进360作为新主线。
```
