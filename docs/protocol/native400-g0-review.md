# 400-06 共同G0评审决定与待确认项

2026-11-04当前覆盖：用户已改设备主线为明文LAN TCP，优先缓存remote0/1/11、4物理触摸；已确认板上f553与未部署a74f分账，旧6882/HTTPS/mTLS/Range及其预算只作历史，不再作当前默认或前置。当前共同待定与下一入口以[TCP-01对齐](native400-tcp-alignment.md)为准；下方旧阶段表保留追溯，不推导已支持新TCP/保存或取消管理页面权限。broker/native选源后置且独立。

2026-11-03，只读核固件新鲜矩阵、400常用版报告及当前源码；[Spec](../context/plans/native400-06-spec.md)/[Diff](../context/plans/native400-06-diff.md)、[证据/报告](../reports/2026-11-03-native400-06.md)。这是管理端评审立场，**不是双方已签核、正式协议分配或设备操作授权**。现400-03 review revision1/94正116反、400-05默认OFF与独立截止保持。

## 已确认的外部基线

固件最新矩阵/报告记400本地只读常用版6882be44…、589248B已安装留驻，N_boot=a34d0c7b…，0/4/1/11四对象及空备用；cache=57ae06ed…/28MiB，启动前全32MiB读回b194ddde…，前2MiB/分区/服务保持。90秒87个可靠快照、1928帧/8段完整SHA、2076次呈现；段内23.947–23.955fps、连续23.297fps、最大跨段889.076ms，24fps未验收。用户实屏/触摸返回反馈已记录，触摸精确时序、冷上电、全78实机、网络/保存/8小时/电池仍待验。这些是对方报告证据，本任务未探测设备或重复实测。

源树已新增LocalPrefetch，但所读已部署6882报告尚无这一版产物/设备证据；四份512KiB前缀加2464B头按64B对齐，前缀存储合计2107136B，另有sizeof(LocalPrefetch)/validator/SHA/scratch与内部publication原子字。三RGB未加第四帧，但总工作集已增加。不能沿用6882的2322168B显式PSRAM或无Wi-Fi动态余量作为此新源码或TLS预算。后续构建/资源证据必须绑定新冻结SHA，当前报告/README内旧“最新”按阶段理解。

## 决定与差异表

| 项 | 管理端立场/已实现 | 固件事实及仍待确认 | 下一验收 |
| --- | --- | --- | --- |
| D01 N与素材身份 | 保留400-01候选P/M/N_offline，禁止用物理N覆盖或换名 | 实际N_boot是格式家族SHA，已安装；不是离线N或package P。V2 root/object存N/F/长度/几何，未见hub P/M字段。尚无共同hub N映射/用途批准 | 400-08已实现PC独立批准/strict映射/误换拒绝，未知N不修复；设备协议正式采纳仍待，不改分区/格式化 |
| D02 初始local来源 | 显式源才接纳touch，缺源不干扰base；不能由PC文件审计造设备库存 | 400本地0/4来自Catalog的已批准sample/F固定四对象。boot root选择成功不等于运行期full-media验证或hub inventory报告 | 400-08只审PC文件整SHA/逐F且明确无设备证据；实际当前hello/session库存和全媒体proof仍待，新字段/能力另审，storage0/null不变 |
| D03 完整性 | review wire只verified-replay：首遍全F/所有CRC/index/RGB/extra，再重读帧SHA收据；保持原义 | 已部署描述是slot首用整文件F，后续逐帧CRC/增量F；当前预取候选后台F＋prefix，未见每周期全媒体proof/7712B帧收据。首用F不等于首帧前全媒体verified | 选择接受两遍及每loop代价，或另起受批准不可变Flash proof/渐进可信帧链策略和独立向量，不能降级现字段 |
| D04 local4与恢复 | 400-05重复touch忽略/不延原local截止，结束回最新有效base；取消remote不取消local；失效仅保历史front | 本地模式20ms轮询、250ms去抖，新的按下边沿可再次start_local(4)；结束按本地Policy回0，三次idle后随机1/11。没有remote最新base/租约 | 需明确hub模式重复点击策略、local自主策略与remote owner互斥；本地已验证0可作为未来fallback候选，失效后是否自动播0需独立授权/合同，当前不伪造 |
| D05 生命周期/尾帧 | remote120000ms和local20000ms是离线固定作业截止；loop/renew/touch不延同意图；42为4917ms/其他10042ms | 本地autoplay无remote租约/120秒截止，长期自主循环；源码见末帧已呈现+F完成即切源，未见独立尾帧完整间隔准入 | 分开本地自主策略和有限remote命令寿命；明确尾帧时长与完整loop边界。hello/任务参数协商未实现，不能默改字段或用周期重发掩盖截止 |
| D06 刷新与旧结果 | 必须独立首帧提交；touch周期proof floor/旧frame拒绝与关闭历史标记已有宿主验证 | view.show返回后current generation才更新first_ack/trace；是可接回调位置。USB ACK V2/local_status是不同协议，未输出hub verification/display序列 | 新adapter应绑定同ctx/target/验证证据及current draw完成点，非物理面板扫描；in-flight draw=1取消尚无真机证据 |
| D07 单IO与退出 | 单TLS/HTTP、段后控制、单pending/一latest/有界flags，普通touch等当前段实际退出；auth/超期失败关闭 | 当前400只读模式无Wi-Fi/HTTP/TLS，USB素材/cancel命令显式Reject。stop_feed清future feed、旧gen块丢弃不证明物理read/draw已退出；存在portMAX_DELAY锁 | 固件交单owner/在途join/取消/退出计量和探针；超期只失效，不提前释放pin或开第二连接 |
| D08 保存/Flash | storage0仍unsupported，saved/offline_available=null，A8只读 | 一次ROM成对安装/读回是已验证bootstrap部署；400运行期无写Flash/NVS。旧360 commit bool/gate不可直接当400事务 | 新400 writer/staging/gate/root/unknown/淘汰/读回/重连与结果版本另Spec；不把安装报告当远端saved |
| D09 能力/安全/资源 | schema3 review/file与ring分离、可信代码scheduling开关；现hello不协商local_source/job/scheduling，不能部署 | 400常用版无hub hello/mTLS/绑定/证书/可信时间/秘密持久化；新预取资源未绑定已测镜像。无网络资源门禁通过与生产G1/G2分开 | 独立默认OFF能力/策略提案与Node/C++向量，固件先RAM凭据TLS资源/时间/退出宿主及构建；后续设备窗口另授权 |

## 身份边界

| 身份 | 已知值/用途 | 约束 |
| --- | --- | --- |
| 真实素材source manifest | a1c7c2a6…，compact78的媒体来源原字节 | 不等于固件源码清单、hub M或cache镜像SHA |
| hub离线N | dd0f19bf…，scope=offline-candidate | 原400-01/03固定，不导入实际设备库存 |
| hub候选P/M_device | 52b2f6cb… /094e69be…，独立recipe | 固件当前root中没有这些域；不能由N_boot/F反推共同接受 |
| 固件已装N_boot | SHA256(UTF8(`round-pet/whale/native400/pet4/tile20/key12/v1`))=a34d0c7b… | 格式家族，不是内容包版本；N相同也须逐对象F/bytes/geometry/generation及根证据 |
| 完整cache镜像SHA | 57ae06ed…，29360128B | 不是N/素材P/根revision或当前实时库存 |
| 6882固件源码ledger SHA | 13983127…，263文件构建冻结清单 | 报告JSON称source_manifest_sha256，必须在管理端命名为firmware_source_ledger_sha256，不能覆盖媒体source manifest |

精确SHA见去敏[证据](vectors/native400-06-g0-review-v1.json)。未来只读映射须独立记录N_boot来源/格式recipe、content P/M/逐F、批准用途和来源审计；不得把offline-candidate scope改成生产，不重写已有review向量。PC审计结果叫来源审阅，不是设备回执或实时offline_available。

## 条件时间预算与400-07实际宿主对照

400-06原6000/1490ms条件算术已[归档](../context/history/native400-07-evolution.md)，400-07[报告](../reports/2026-11-03-native400-07.md)/[API](native400-cycle-budget.md)补冻结旧链R6001/499/999→R4503失败关闭、新6720提前续租及完整exchange500ms/GET-only源1000ms/同pump compute100ms累计检查。原4510拒绝floor/15000租约/120秒作业不改；计划requireBudget先拒超声明计划，不承诺实际总wall。

170段原创5564915B PET4经A2真实全验入临时CAS、实际TLS与原actor在近1秒/段双时钟注入下先作业到期，尚未全验/首帧，lease仍可合法renew。最大实际素材5569645B仍算170段；本片没有读真实媒体或声称网络物理最坏值。控制/解码/IO成本仍是离线声明，端侧RTOS/资源/时间/退出尚待固件实测/共同采纳，不加TTL或改原wire冒充准入。

## 下一实现切片与依赖

1. **400-07：完整调度周期预算（本片离线已完成）**。24专项/独立CLI/check/1150回归验证上述实际链和必要修正。不是设备最坏上界，成本超限失败关闭；400-08来源审阅后续已完成。
2. **400-08：N_boot只读来源映射（本片离线已完成）**。见[44专项/1194回归报告](../reports/2026-11-03-native400-08.md)/[API](native400-bootstrap-review.md)。独立批准/strict header/流式整SHA及逐物理F/实际读退出已验，无全媒体校验或设备证据；400-09审阅产物保存/重开/只读投影后续已完成。
3. **400-09审阅产物保存/重开与只读投影（本片离线已完成）**。见[43专项/1237回归](../reports/2026-11-03-native400-09.md)/[API](native400-source-review-storage.md)。有界CAS journal/两份独立重新批准/实际源复验/失败历史及只读槽已验，不能凭自SHA/来源审阅生成设备库存/保存授权；无默认服务接线。400-10后续已验临时status/owner装配，不启生产/设备通道。
4. **正式能力/策略与端侧适配（需共同决定）**。D03–D05/D09确认后另立review修订/新profile及Node/C++字节，明确local来源、重复触摸、无限自主策略/有限remote目标、全媒体/缓存proof与期限；双方未采纳前不改变现revision1。固件先提供不联网现场的宿主/构建及新工作集清单。
5. **TLS/持久写入与真实闭环（等待资源证据和独立授权）**。端侧时间/凭据/单owner/实际退出/新内存G1/G2合格、真实用途批准、共同合同后，再审0/11＋physical4缓存闭环，后扩未缓存/保存/淘汰/重连；真实设备动作不由本次继续指令自动启用。

## 未来窗口方案与回退前提

先冻结双方源码/合同/具体镜像/配置语义/设备身份/绑定epoch、分区及当前N_boot完整缓存；核在场新鲜备份与保护范围，预先审核单owner和有限步骤/停止条件。以只读hello/能力/库存及单缓存动作开始，内存/可信时间/身份/未知提交/实际退出缺证就不进入下一步；不启动第二网络控制源、停整个pet/bridge或自动降级。

取消/失败先fence，再等待真实HTTP/read/draw/worker退出，保留结果未知保护。当前400无写网络；将来有写入后须按当时N/根floor/epoch单独恢复，不套旧历史备份。若经独立授权回360，必须成对恢复匹配旧app与完整旧cache、核验再启动；只刷旧app会遇N400不匹配。前2MiB/NVS/分区和原服务默认保护，不能把成对回退扩大为整片写入。本轮仅文档回退，无任何现有运行状态需要恢复。

4. **400-10临时宿主来源审阅装配（本片离线已完成）**。见[36专项/1273回归](../reports/2026-11-03-native400-10.md)/[API](native400-source-review-host.md)。只有UDS赢家开journal/owner、只读status与代理白名单及JS宿主真实读取展示已验；重开仅历史、实际复验与退出等待不改原证据等级。不是设备N_boot协议/库存或G1/G2准入。400-11后续已完成显式离线操作入口评审，代码仍只读。

5. **400-11操作入口评审（仅文档/既有API对照完成）**。见[报告](../reports/2026-11-03-native400-11.md)/[拟定契约](native400-source-review-controls.md)。选择身份钉住、可信会话/单次引用、seq去重/定向取消与同步授权gate列为待实现；两项原创探针不构成新的准入实现，40项未来清单未执行。332条原源保持、check/1273回归通过。400-12后续已补可选内部选择绑定，仍不开放设备/生产通道或网页写路由，G0/G1-G2/24fps限制保持。

6. **400-12内部选择绑定（本片离线已完成）**。见[35专项/1308回归](../reports/2026-11-03-native400-12.md)/[API](native400-source-selection.md)。原reader实际fd首读前核所选元数据、撤销/时钟/真实退出和manager原提交valid已验；不是来源用途授权、全媒体proof或设备确认，原wire/布局/只读service保持。后续400-13已实现内部操作/同步授权gate，真实G0/G1-G2/24fps门槛不变。

7. **400-13内部控制/400-14临时交互候选（离线已完成）**。13的单会话/任务/ACK/gate继续有效；[400-14报告](../reports/2026-11-03-native400-14.md)/[API](native400-interactive-host.md)已验42专项/1395回归、显式profile/私有IPC/可信临时页面proxy与共享操作。默认关闭/无provider只读，临时cookie与JS hook宿主不等于真实浏览器/DSH身份/native picker验收；400-15已补该评审与共享UI真实DOM，下一400-16可信本地broker交接适配器；不改设备N_boot/proof/Flash/G1-G2/24fps准入。