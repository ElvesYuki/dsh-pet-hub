# TCP-01替代记录

2026-11-04：以下旧6882/预算/TLS方向及broker优先入口，由当前TCP对齐取代，旧报告与成果保留历史，不据此推断当前设备或新网络余量。

## 原 README.md

当前已完成宿主离线管理、mTLS/会话一致性及选主后managed review装配；基础设施包括单实例Unix socket服务、鉴权IPC、状态来源装配、配置CAS和插件管理设置区。候选已通过临时独立DSH Web profile的加载、热重载和卸载验证；现有desktop未安装，无设备通信和BLE实现。当前管理端开发目标已按用户确认对齐**1.75C／400×400／78动作**，466×466屏居中(33,33)，42号118帧、其余241帧/24fps；使用已批准compact78素材。400已确定为后续方向，旧尺寸暂作备份回退。通用400宿主、400-01身份/严格导入及400-02纯core窗口/本地review能力/完整性对照已验；400-03独立review wire/宿主向量已实现，400-04默认OFF临时装配/实际loopback与actor已离线验证；400-05触摸/最新base/自动调度已离线验证，持久化和正式资源准入仍待完成，见[当前400基线](../native400-baseline.md)和[规划Spec/Diff](../plans/native400-manager-alignment-spec.md)。2026-11-03只读固件最新矩阵/报告已记400本地6882版及N_boot四对象留驻，连续23.297fps/24未验；源码新增预取须另核资源，详见[400-06评审](../../reports/2026-11-03-native400-06.md)。本任务未接设备或干预现场。360媒体/代码/旧合同与67/a7保留[兼容回退](../native360-baseline.md)，分层360不迁移。旧128的240×240、约24FPS与四PSRAM槽仅作历史参考。

## 原 docs/context/current-system.md

2026-11-03只读刷新固件矩阵/报告：400本地只读常用版6882be44…/589248B已留驻，N_boot=a34d0c7b…和四对象0/4/1/11已安装；cache=57ae06ed…/28MiB，启动前全片b194ddde…/32MiB。90秒87快照、1928帧全SHA/2076呈现、连续23.297fps/最大间隙889.076ms，用户实屏/触摸返回确认；统一24fps未过。当前源码另有四份512KiB首段预取（仅前缀存储2107136B，其他状态另计），未由6882资源/构建证据覆盖。外部候选源码读取期间并发变化已重读并记录SHA；本任务只读文件，不访问现场。详见[400-06报告](../../reports/2026-11-03-native400-06.md)/[决定与预算](../../protocol/native400-g0-review.md)。

## 原 docs/context/current-system.md

2026-11-03 [400-15可信provider评审与真实浏览器验证](../../reports/2026-11-03-native400-15.md)已完成本片范围：只读安装产物确认当前DSH为rc.5，raw webServer路由不自动鉴权，公开Connection有请求准入/registry；Desktop单目录picker/页面pathFor不能作为可信单文件选源交接，HTTP转发会删Origin，14默认严格写代理继续拒绝该未经适配的承载。原rc.3宿主实测及manifest peer不扩大为rc.5兼容。独立浏览器context（UA Chrome156）/固定历史React18.3.1种子/实际DOM，经既有14 proxy/UDS/controller/reader/journal验证点击审阅/历史复验、取消等真实I/O、503抑制ACK后手动原请求确认、刷新不重放、代理卸载重挂和unknown→历史→新会话显式复验。10专项/独立CLI/check（语法）及含build1405/1405通过；344条既有文件SHA保持，新增4个验证文件，无生产源码/协议/依赖修改。[Spec/Diff](../plans/native400-15-spec.md)、[API与交接决定](../../protocol/native400-provider-review.md)、[闭合证据](../../protocol/vectors/native400-15-provider-v1.json)、[替代归档](native400-15-evolution.md)。默认关闭、无provider只读；cookie为模拟可信交接，真实DSH身份/native dialog/rc.5 profile与正式broker未实现或未验；下一400-16先做可信本地交接适配器Spec/Diff与离线验证。未启动DSH/生产listener、不接设备/真实源/固件或现有配置，外部仍400-06快照。

## 原 docs/context/index.md

管理端最新（2026-11-04收尾，验证于11-03）：[400-15 Spec](../plans/native400-15-spec.md)/[Diff](../plans/native400-15-diff.md)、[可信provider/选源/承载评审](../../protocol/native400-provider-review.md)、[10专项/1405全套与真实浏览器报告](../../reports/2026-11-03-native400-15.md)/[闭合证据](../../protocol/vectors/native400-15-provider-v1.json)、[替代原文](native400-15-evolution.md)。安装产物新鲜核为DSH rc.5，原rc.3宿主实测/候选peer保留历史范围，不自动扩兼容；raw路由无自动Connection鉴权、Desktop转发删Origin与单文件选源缺口已核。既有14链路在独立Chrome/React18.3.1真实DOM完成审阅/复验/取消待I/O/503原请求确认/刷新/代理重挂/unknown历史恢复；仅模拟可信cookie交接，不是DSH身份/native picker。344条原文件SHA全保持，新增4个验证文件；默认仍关闭/无provider只读。下一400-16先Spec/Diff做可信本地broker交接适配器，先离线晚结果/撤销/期限测试，真实宿主/native与设备准入另验，外部仍400-06快照。

## 原 docs/context/current-todos.md

素材设备侧：新鲜文件核对已记400本地常用6882/N_boot四对象安装、用户实屏/触摸返回确认，见[400-06](../../reports/2026-11-03-native400-06.md)。不再把“尚待换新素材输入”列为当前首步。下一设备任务按其授权优先首用SHA/首GOP优化并绑定新源码资源证据，补24fps/精确触摸/长测；本管理端保持离线，不操作现场或重复制作素材。

## 原 docs/context/current-todos.md

1. **400-16可信本地broker交接适配器（下一实施入口）**：先Spec/Diff与具体方案/回退，依[400-15决定](../../protocol/native400-provider-review.md)明确可信调用端、独立批准摘要、固定实例/单会话/单picker、取消/晚结果、撤销/到期/unknown与实际I/O退出，复用14 private channel。先注入身份/picker回调做独立离线验证，不把它标为OS dialog或DSH用户身份；不重复13 controller/原reader/journal或基本浏览器按钮。真实DSH接入须先核rc.5的Config/React/slots/Connection与profile兼容，原peer rc.3不自动放宽；Desktop HTTP会删Origin，禁止通过接受缺Origin绕过旧代理。实际宿主/native窗口另按已授权边界准备方案，当前仍不安装/启用、不改现有服务/配置、不接设备。

## 原 docs/context/current-todos.md

2. **共同G0与固件资源交付（仍未签核）**：按[D01–D09](../../protocol/native400-g0-review.md)/[W01–W10](../../protocol/native400-wire-review.md#交固件的决定待确认项尚未共同签核)400-08已有PC只读映射，仍须共同确认设备侧N_boot/P/M/报告协议、首用Flash proof/verified-replay、重复点击/失效fallback、local自主与finite remote寿命、正式能力和退出上界。新预取资源必须独立绑定构建/动态证据；安全时间/凭据/单TLS/400运行期保存/G1-G2/24fps/真实用途仍缺证，当前本地安装不能放行新网络通道。400-07已补声明预算下实际调度/170段负例，不等于设备最坏延迟；物理窗口另审具体方案/回退及授权。

## 原 docs/context/native400-baseline.md

2026-11-03，[400-06只读评审](../../reports/2026-11-03-native400-06.md)已刷新：目标为批准compact78；固件报告记400本地只读版已留驻，但hub真实通道、400@24和运行期下载保存仍未验。旧尺寸实现/媒体/成对回退保留，分层360不迁移。[共同决定](../../protocol/native400-g0-review.md)、[G0交接](../plans/round-pet-g0-handoff.md)、[素材交付](../../protocol/native400-device-handoff.md)。

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
| 下一入口 | 400-01至05已有离线实现；400-06评审已完成文档范围。400-07周期预算已离线实现，400-08已离线完成，400-09保存/独立批准复验/只读槽已离线完成，400-10临时status/owner装配已离线完成，400-11操作契约评审已完成，400-12可选内部选择绑定已完成，400-13内部控制/400-14默认OFF临时交互接线已完成，400-15评审/真实共享DOM已完成，下一400-16可信本地broker交接适配器；正式策略/协商/运行期写入和G1/G2/24fps另审 |
