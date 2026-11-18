# TCP27：单设备有限自动hold窗口执行与回退方案

2026-11-06。状态：**方案已准备，本轮未执行；不是设备准入凭证**。[准备Spec](tcp27-spec.md)/[管理端报告](../../reports/2026-11-06-tcp27.md)。仅一块1.75C-EN，400×400 compact78四缓存0/4/1/11，remote仅0/1/11、4仅物理触摸。无新type/HELLO字段，CRC/SHA不变，nonce/controller ID不冒称认证。无媒体流/保存/V3/分区/cache修改，严格24fps不作为门槛。

## 固定实现与仍缺证据

| 对象 | 本次静态固定 | 运行窗口仍需 |
| --- | --- | --- |
| 管理端host-core | [TCP26六模块pins](../../protocol/vectors/native400-tcp26-manager-pins.json)，文件SHA 77d4ab79a8dcb10a38436165a16d6d0c55a1f33f2772f3e8fcbc63f8729fae9f | 实际运行来自本次冻结副本/候选，Node可执行文件SHA和本次启动实例；不是事后读取工作区SHA |
| A hold与owner/权限链 | [TCP26源码和候选指纹](../../protocol/vectors/native400-tcp26-results.json)；bridge/source/channel/owner/wire保持 | 可信本地装配、原genuine素材/用途/window/shared授权；禁止网页或JSON自行发权 |
| 端侧保位候选 | station SHA 2759f2e48d14d2716a667157f723bdd24791d315a612ded3346209a5efb90681，1214096B；final-manifest aef9843f872bc806757052fef8a7e48c38ae6fbf43b408333d94340b7407500b | 由终端按独立方案准入/只app临测、实际读回/加载关联；HELLO本身不能证明保位版本 |
| 设备/缓存/回退 | 最后确认仍原f553/完整af5b；0/4/1/11；400/360回退保留 | fresh设备/完整回退SHA、15段保护、缓存身份；历史PC V2不能代当前库存 |
| 真实pet | 既有公开只读state/counter，TCP22真实空闲已验 | 实际加载build常量或loader注册记录+宿主实例+来源代；安装包SHA/版本或HTTP空闲不够 |
| 素材用途 | 原compact78批准与TCP26身份边界保持 | 新鲜audit生成source_evidence/mapping，与独立materialReview/windowDecision引用一致；不复用旧窗口批准 |
| 资源 | 端侧静态内部3944B/+40B、PSRAM4439288B，原栈配置不变 | SDK动态最低余量/最大块/任务栈及进展；沿终端现行准入谓词，不能用旧57563B样本或静态差值放行 |

真实pet运行身份当前缺少证据。可先单独安排**手动缓存控制**窗口核新候选；该结果不能标成真实pet自动hold通过。自动来源窗须在相关身份/来源/批准具备后安排，不靠重建来源、重复空闲观察或自动发模型任务绕过。自然迁移未发生时记“未覆盖”，按时结束。

## 准备检查（本轮允许执行，不开启服务）

在本仓库先正常build，再构建独立DSH候选；只生成本地文件，不安装。运行：

```sh
node scripts/prepare-native400-hold-window.mjs --output .cache/tcp27/new-preparation.json
```

该工具只读核TCP26已固定源码/候选SHA，复用execution snapshot与Node load audit，在独立私有副本中import候选bridge并验证export；不调用任何start/bridge/issuer，不读Wi-Fi/令牌/设备配置/真实pet，不证明实际DSH已经加载。输出prepared=true和**device_admission=false**，明确七类待验；前后核pins、等待child/stdio/lease退出后删除副本。代码或候选变化即拒绝，不自动重算批准，已有输出不覆盖。只有声明库存和本次实际import覆盖，不是完整执行闭包。

原有最小宿主链按以下API复用，不新增broker：`createNative400LanInputAudit`→独立`materialReview/windowDecision`→`prepareNative400ReviewedLanRequest`→`prepareNative400NodeControlAccess(shared:true, autoRecover:<明确选择>)`→`createNative400NodeControlWindow`。独立私有runtime目录只有UDS赢家开单listener；link由可信单publisher实测给新epoch，不能把旧peer、listen ready、Queued或DHCP历史当设备上线。

TCP28已补[有限运行器](../../protocol/native400-pet-hold-run.md)：可信外层在genuine shared client/实际OPEN及来源身份等准入满足后，显式构造createNative400PetHoldRun并start；内部仅创建本次source和原A bridge，默认最多45秒。它不启动listener、不授client或关闭共享组/外层window。TCP29已完成[固定副本实际宿主](../../protocol/native400-pet-hold-host.md)，父原能力经私有IPC交接，子实际construct/start和清理；真实pet/设备身份仍待，不能把TCP27准备工具当启动器。

## 有限预算与执行片段

建议把手动准入、自动保持和失联恢复拆成独立有限窗，分别记录，不以一个大窗口反复试到成功。沿现有lane上限120秒、不延长或重建；自动来源与页面权限各60秒，开始自动片段前各自有效余量需>52.5秒，**片段最多45秒**，包含退出余量。若端侧准备已耗掉lane余量，结束本窗另行评审，不重置其起点。运行中的硬门禁仍是原三余量>7500ms、新5秒BASE/2秒低水位、收据<=1500ms与往返扣时；新增建议预算不改变实现阈值。TCP28运行器已装配45秒监管、单次start、查询耗时扣除与每次BASE提交前截止检查；调用方仍须显式使用，TCP27准备CLI不会调用它。

| 步骤 | 执行方／操作 | 必须保留的独立证据 |
| --- | --- | --- |
| W01 | 双方核固定副本/候选、fresh完整素材/用途/window引用；终端确认设备/恢复和资源准入 | 不含地址/口令/凭据的证据ID+SHA；加载记录不混为静态源码SHA |
| W02 | 终端按既有独立方案仅临测app；实际RAM配置与新peer/链路交接；管理端仅自有runtime赢家 | 原保护不变、真实app关联、实际link epoch；Queued/host ready不能替代OPEN |
| W03 | 手动0→1→11分别提交，4只物理触摸 | 提交、设备ACK、首次真正draw回执分别记；PC预览/下载/HTTP无替代关系 |
| W04 | 同一remote动作跨至少两次有限续租，不发送CANCEL | ACK token稳定与帧进展；source/cycle/mail在续租点不重建需可信端侧观测，缺观测时单列未覆盖，不能仅从token推导或只凭目视 |
| W05 | 下个真实loop frame0到达 | 续租后新request关联；中间unknown正常，没有合成PRESENTED/whole SHA或新增PRESENTED超时 |
| W06 | 物理touch，期间保持来源新鲜并可自然更新base，完整EOF | touch不被抢；EOF回最新有效remote，旧request/旧EOF不复活；不远程强制4/人为延长触摸 |
| W07 | 人工manual接管或明确取消本桥目标 | CAS阻断自动覆盖；只撤自身目标，不取消人工；设备执行与host逻辑清除分记 |
| W08 | 独立恢复片段仅控本host lane/link的失效与新epoch，不改物理AP/网络服务 | 新HELLO/OPEN，true仅原剩余TTL、false不恢复；过期不得复活；不外推真实AP断网 |
| W09 | 自动来源窗只观察自然任务迁移/失联，执行方不发造任务 | 过滤state/counter与相对时序；仅空闲即自然迁移未覆盖，不重启轮询延窗 |
| W10 | 退出、端侧清理、精确恢复与现场检查 | host退出/端侧stop+STA退出/实际恢复保护/实屏分开确认，不能互相替代 |

观测能力限制：当前PTC1 ACK只有token，PRESENTED包含source但没有cycle/mail；内部Bridge事件未作为网络状态输出，当前app也没有完整续租stamp遥测。因此本方案不承诺首窗可直接逐项验收内部cycle/mail；其合成证明沿TCP26，实屏/帧进展与ACK身份单独核。若必须取得逐项设备实证，先由终端另审只读观测/现有采集扩展，不擅自扩wire或把缺项记通过。

一条实际socket/一个在途、latest有界、PING独立。旧连接、旧命令、迟到draw、重放不续期的完整负例沿TCP26离线证据，真机窗口不注入坏包或堆积请求来扩大风险。正常真实SHA/metadata/CRC与首帧提交仍由设备本地链确认；仅PTC1报文当前不能独立证明完整SHA或当前持续playing，界面维持accepted/历史首帧/unknown等级。

## 停止、失败和回退

1. 每个片段到时、unknown、source/权限/预算不足、人工冲突、时钟/链路故障或资源不满足即停止发新意图。unknown保原body/原期限；仅明确确认原body，不换request/TTL盲重试。恢复授权不自动延原目标。
2. 管理端若使用TCP28则`await run.close()`（内部先bridge.close中止并等待活动HTTP/IPC，再关自己source），只撤自己已确认且仍持有目标；不关闭借用client/外层window。unknown或撤权时不猜是否取消成功，不end别人的共享组。
3. `await window.close()`关闭自己的TCP/UDS赢家并核实际资源0；附着者不能关闭赢家。cleanup_unknown保留现场和句柄，修复后明确close，不抢锁、删别人的socket或重启服务。host完成不代表设备收到CANCEL、退本地或STA退出。
4. 终端独立核stop/owner fd退出/STA清理；设备连通未知时不报告成功。依实际接纳的原TTL和断链本地策略收敛，但不声称“PC停止起5秒内必然回本地”，最坏网络延迟未实测。禁止改TTL掩盖排队。
5. 由终端按已审既有工具，仅一次精确恢复原app/完整2MiB恢复输入（full SHA由其fresh核定，不只看前缀），完整读回、15段保护及N400原缓存不变；不得写分区或缓存。恢复失败/USB不可用时保留unknown，不自动多轮重刷，沿原物理恢复方案处理。
6. 恢复后30秒原CRC/帧进展/EOF和错误/欠载/skip/TX检查，关闭串口，再由用户确认持续播放与物理触摸返回。缺任一项单列待验；400/360完整回退与失败记录保持，不覆盖原镜像。

## 最小结果格式

只记录窗口ID、双方固定文件/候选SHA、实际运行证据ID、素材/用途批准引用、动作request/session/token/source关联的过滤结果、各余量/ACK与实际draw相对时序、动态资源/帧/CRC计数、取消/unknown/退出/恢复的分层结论。不把完整日志、账号、任务正文、SSID/IP/端口/凭据、USB配置或素材写Git。共享会话仅后端有限逻辑组，新TCP仍新会话；此轮不保证跨服务崩溃持久恢复。

本方案准备完成后，下一是补齐现场缺项并由终端独立安排具体有限窗口；不是由本准备命令自动连接或刷写。若缺现场运行身份或原genuine能力，明确停在准备阶段，不重做已通过的空闲/协议/DSH加载。
