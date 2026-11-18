# 400-06 新鲜固件/策略评审替代记录

2026-11-03。下列是400-05完成后、400-06评审前的当前摘要。由[本轮报告](../../reports/2026-11-03-native400-06.md)/[决定表](../../protocol/native400-g0-review.md)替代外部驻留/N/资源快照及“下一评审”待办；保留400-01至05/1126宿主证据、旧尺寸备份和全部未关闭的G0/G1/G2/用途限制。未新读设备，不能把本轮文件读取当实时现场。


## 原docs/context/current-system.md

上次400规划对齐时只读的固件矩阵/0dcdf6be执行清单（不是本轮设备状态）记外部最高性能窗口执行中，应用部署/保护核对、设备下载模式，读取时尚无新FPS；原cbdf/360缓存（seq5/0、4、1、11）恢复是上一已结束窗口记录，不作当前驻留承诺。本任务未探测或干预该窗口。4bae compact实测841帧完整性/无Wi-Fi内存通过但12.395–15.057fps未达24；不把原驻留变成400生产支持。本任务未新读设备/配置或处理现场。


## 原docs/context/native400-baseline.md

2026-11-02，用户确认后续管理端规划对齐已批准compact78。**这是当前开发目标，不是400已部署或24fps/持久化/TLS已验收。** [Spec/Diff](../plans/native400-manager-alignment-spec.md)、[核对报告](../../reports/2026-11-02-native400-manager-alignment.md)、[共同G0](../plans/round-pet-g0-handoff.md)、[素材交付](../../protocol/native400-device-handoff.md)。旧尺寸实现/媒体/固件暂作为[备份与回退](../native360-baseline.md)保留，分层角色仍用360坐标。

| 维度 | 当前确认与限制 |
| --- | --- |
| 板/几何 | 一块ESP32-S3-Touch-AMOLED-1.75C-EN，466²屏，400²素材1:1居中(33,33)，裁区(124,-6,400,400)，无额外安全圆/逐动作位移 |
| 目录/时序 | 78个原ID0–77；24fps，42号118帧/其他77项241帧，共18675帧。末帧分别117/240，不能补帧或延时补齐 |
| 媒体格式 | PET4/flag1/key12/tile20，每tile8000B；256项RGB565调色板、8位索引，逐帧tag决定完整/XOR；本版1019个额外tag0 |
| 当前批准版 | recipe=native400-compact-approved-v1，宿主profile=native400-candidate-v1，license_ref=dsh-pet-nc-86181ce；视觉批准不等于A2用途/设备准入 |
| 文件身份 | source manifest a1c7c2a6…、全库I=5bd657d4…/M_host=0102c312…、role8 I=afdda0e8…/M_host=655d8429…；精确值见[证据](../../protocol/vectors/native400-manager-alignment-v1.json) |
| 体积 | 全78共348737057B；最大67号5569645B＜旧payload上限5865472B；role8共31877424B＞28MiB，不承诺8项或78项全离线 |
| 身份未决 | 400-01已实现候选M_device=094e69be…/P=52b2f6cb…/N_offline=dd0f19bf…，不同于M_host/I/来源catalog；生产N仍未定/未安装，早期fixture N和360 N不能复用。现有V2缓存仍360/seq5/0、4、1、11，不作为400命中 |
| 管理端代码 | 通用400解码/流式仓库/角色激活/IPC像素与恢复已有宿主验证；400-01主入口/独立批准/全媒体严格导入已实现；400-02纯core实际ring/本地schema3 review/完整性对照及首帧/时钟/退出已验；A1/旧wire/R7仍备份，400-03独立review wire/双语言字节已验，400-04默认OFF临时装配/真实loopback与actor已验；400-05触摸/latest/自动调度已离线验证；真实触摸/正式协商与Flash待实现 |
| 执行方向 | 最新固件候选为单1MiB压缩窗口＋三RGB（含前瞻），encoded=0；最大24帧payload688702B。本模式不能谎报为schema2完整encoded RAM，需新能力版本/明确完整性状态 |
| 显式资源 | 窗口候选PSRAM2322168B，内部scratch20160B，worker16KiB/I/O8KiB另计；无Wi-Fi/生产TLS/400持久保存。不是整机硬上界或可分配TLS余量 |
| 真机证据引用 | compact78四动作0/4/42/67共841帧CRC/整段SHA及无Wi-Fi内存通过，12.395–15.057fps，24未过；预定受控停供/切换/CRC负例未执行；新ACK/短锁候选仅宿主/构建，未部署 |
| 驻留/回退引用 | 最新只读矩阵/执行清单记外部最高性能0dcdf6be窗口执行中，应用部署/保护核对、设备下载模式，读取时尚无新FPS；上一窗口原cbdf/360缓存恢复是历史结束态，不作当前驻留。本任务未探测/干预，后续状态看固件矩阵；67/a7及旧媒体保护 |
| 下一入口 | 400-01/02离线已完成；400-03独立review合同/向量已完成，400-04临时装配已离线完成，400-05调度已离线完成；默认全验重读/渐进对照仍待固件共同决定。详见Spec的小切片与C01–C12 |

读取期间固件codec/decoder/window入口/CMake并发增加PACKED_RGB优化，已重读并在证据中保留前后SHA；收尾前又读到0dcdf6be执行清单，宿主/构建已通过、静态PSRAM仍2322168B，外部窗口执行中尚无新FPS/TLS证据；不从静态构建推断动态资源通过，未来窗口须重新冻结。


## 原docs/context/current-todos.md

1. **共同G0调度策略与准入评审（下一入口）**：[400-05/35专项](../../reports/2026-11-03-native400-05.md)已完成默认OFF候选的local4/latest/loop/欠载/renew/实际退出离线范围。下一先Spec/Diff，只读核固件新鲜资料，按[交接C01–C12](../plans/round-pet-g0-handoff.md)确认显式local4来源、缺源/失效保画面还是idle0、双遍/每loop成本、周期验证与原作业截止、单TLS/HTTP残余和轮询/控制最坏预算；决定正式能力/策略协商，缺批准不改revision1。不得把代码开关/本地源reader当设备能力、把宿主结果当G1/G2或通过加TTL掩盖等待。确认后再拆正式协商或400持久化的离线实现，实物窗口另审方案/回退和授权，不重做已完成的承载优化。


## 原docs/context/plans/round-pet-g0-handoff.md

- 当前素材为已批准compact78：400²/466²居中(33,33)，24fps，0–77原ID；42号118帧，其余241。全库348737057B/18675帧/1019额外tag0；完整库/role8逐文件与新摘要已核，不重做画质。
- 400为后续方向，旧尺寸仅备份回退。通用400宿主及400-01离线身份/严格A2主入口已实现；400-02纯core窗口/本地review能力/完整性对照已实现，400-03独立review wire/双语言字节已有，400-04默认OFF临时TLS/actor装配已有，400-05离线touch/latest/自动调度已验证，真实触摸/正式协商与Flash未适配，旧A1/R3–R7专用实现保留备份。现360合同修订2/80正62反保持，规划轮940为历史测试数量，不改名或扩大字段冒充400互操作。
- 上次只读快照中的固件400路径为1MiB压缩窗口/三RGB，encoded=0，无Wi-Fi和新持久安装；400@24尚未过。收尾前最新矩阵/清单记外部0dcdf6be最高性能应用部署/保护核对窗口执行中、读取时暂无新FPS；此前cbdf恢复为上一窗口结束记录。新0d宿主/构建不作性能准入，本任务仅只读文件，未探测或干预设备。
- 旧固件G0回复是360的单方答复；不能自动作为本400表的同意。联合G0、400维护/安全资源准入保持未关闭。


## 原docs/context/round-pet-hub-baseline-alignment.md

| 项目 | 已实现/已核对 | 400待适配或待共同确认 |
| --- | --- | --- |
| 目标/几何 | 最新批准库400²/78/center33；通用宿主profile/画布支持 | 当前主线改400，旧360/46/center53专用core/wire保留兼容，不假称已迁移 |
| 文件/时序 | 新manifest/F/全78和role8身份一致；42=118/其他241，24fps；1019额外tag0 | 专用A2/Native360/协议仍固定46/241；400-01新严格recipe/variable timing与显式400导入已实现；真实用途输入仍待审阅 |
| 身份/许可 | I/运行时M_host/源和provenance/视觉批准分开核；dsh-pet-nc-86181ce保持 | 400-01候选M_device/P/N_offline已算：094e69be…/52b2f6cb…/dd0f19bf…，profile仅离线，不能用M_host/继承catalog/旧N代替；真实用途输入及生产N仍未确定/批准 |
| 能力/RAM | 400通用parser/仓库/激活/IPC/恢复宿主通过；固件窗口1MiB/三RGB已宿主构建 | schema2 maxfile≤playback RAM不适配frame_window，400-02独立schema3 review/实际ring及有界decode已验；400-03 review cap/hello/状态/向量已验，正式版本待共同定版，persistent=null |
| 首帧/全验 | 旧R6模型完整verify→首帧；400候选逐帧CRC→呈现→末尾全F | 400-02默认全验重读＋帧SHA、渐进仅显式离线对照，pending/failed/verified及首帧独立；正式策略/两遍与7712B收据成本待固件确认，未决不开hub未缓存路径 |
| 状态/保存/库存 | A3/A8/R7相关性/floor/unknown原则可复用；当前360 Flash已验 | 新400Store/N/geometry/validator及保存/淘汰/恢复未实现；28MiB/4+1是几何目标，旧缓存不能映射400可用 |
| 手动/触摸/维护 | R2保守0/11+physical4模型，400欠载保front模型已有 | 新N合法初始库存、400触摸/UI/缓冲与保存维护的投影、短尾/loop/取消/迟到draw需新向量 |
| 协议/调度/认证 | 旧360 revision2/80正62反/R4–R7及减量保持，通用有界owner/guard可复用 | 400-03独立review profile/能力/状态/4项20页/双语言golden已有；400-04默认OFF临时HTTP/TLS/actor及退出候选已验；实体TLS/时间/持久凭据/实际退出预算待交付，USB ACK版本不作互操作证明 |
| 资源/驻留 | 已报告400窗口显式2322168B PSRAM；4bae841帧完整性/无Wi-Fi内存样本通过但24fps失败，e6fe/410为此前构建；最新外部0dcdf6be最高性能窗口执行中/尚无新FPS，原cbdf恢复是上一窗口结束态 | 400维护/保存/网络/G1-G2必须专用实测，旧360 G1失败或P3/400无Wi-Fi余量均不能放行，不降低内部48KiB等门禁 |
| 回退 | 360源码/协议/媒体与67/a7/原cbdf/旧400整套目录保留 | 先共同定义新N与共存/选择，未来app/配置/epoch/N/完整缓存分别核验，不改分区或自动迁移/降floor |
