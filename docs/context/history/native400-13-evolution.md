# 400-13替代记录

2026-11-03：以下为实施前原文，由[当前系统](../current-system.md)/[待办](../current-todos.md)及[400-13报告](../../reports/2026-11-03-native400-13.md)替代。只替代内部控制尚未实施/旧最新验证与下一入口；400-12/09选择与存储仍有效，400-14页面/宿主授权尚未实现，旧阶段证据保留。

## 原 docs/context/current-system.md

2026-11-03 [400-12内部选择绑定](../../reports/2026-11-03-native400-12.md)已完成离线范围：元数据选择零内容读/短fd关闭后返回opaque引用，共享原BigInt指纹；实际reader可选expectedSource在open后首读前比较，合法同字节新inode/原位改动也拒绝，旧undefined路径接口保持。选择TTL只门禁新任务，撤销/关闭/坏时钟失效在途绑定，busy/fd等真实退出；manager读后/原journal valid与发布前复用选择检查，rename后unknown优先且不称回滚。35专项/独立CLI清理、check（语法）/含构建1308/1308通过；332条原源中329条SHA保持，3修改/3新增，原source-map/golden/400-03/07与service只读边界不变。[Spec/Diff](../plans/native400-12-spec.md)、[API](../../protocol/native400-source-selection.md)、[原创证据](../../protocol/vectors/native400-12-source-selection-v1.json)、[旧入口归档](native400-12-evolution.md)。仅实现CTL-09–16等内部选择子范围，非完整控制授权；定向job取消/请求去重/可信会话/完整同步授权gate、网页/native picker仍待400-13/14。未读真实源/固件/设备/生产或现有配置，外部仍400-06快照。

400-11[操作契约评审](../../protocol/native400-source-review-controls.md)仍是后续控制设计依据；OBS-01选择间隙已由400-12可选绑定补齐，OBS-02无job关联cancel仍待控制器。两份独立批准和global status无授权引用的边界保持，40项整体清单不算全部通过；本片只覆盖内部选择相关子范围。

400-07完整周期预算/24专项仍有效，现全套包含其回归；6720提前renew/原4510 floor、GET-only/整体exchange与源/累计compute、严格计划必要条件和170段先job到期均保持。400-08未接生产/IPC/设备来源，也未重验真实cache或全帧媒体。400-09候选保存/重开和只读槽已验；400-10已验显式临时status/owner退出，400-11已完成拟定操作契约评审，400-12已实现可选内部选择绑定，下一400-13有界控制器先Spec/Diff，继续不从来源审阅生成设备库存授权。

## 原 docs/context/index.md

管理端最新（2026-11-03）：[400-12 Spec](../plans/native400-12-spec.md)/[Diff](../plans/native400-12-diff.md)、[选择绑定API](../../protocol/native400-source-selection.md)、[35专项/1308回归报告](../../reports/2026-11-03-native400-12.md)/[原创证据](../../protocol/vectors/native400-12-source-selection-v1.json)、[旧入口归档](native400-12-evolution.md)。元数据选择/opaque引用、原reader首读前钉住、TTL准入/撤销/时钟、真实I/O退出和manager原提交门禁检查已验；329条原源保持，3修改/3新增，原map/wire/400-07/只读服务保持。下一400-13先Spec/Diff做可信会话/一次选择/请求去重/定向job取消与完整同步授权gate；页面/native picker/真实DSH授权未实现，CTL清单仅内部选择子范围覆盖。无真实源/固件/设备/生产或现有配置变化，正式G0/用途/资源/Flash/TLS/G1-G2/24fps另审。

## 原 docs/context/current-todos.md

1. **400-13有界操作控制器与同步授权gate（下一实施入口）**：先Spec/Diff，按[400-11契约](../../protocol/native400-source-review-controls.md)/[切片](../plans/native400-11-diff.md)复用[400-12选择引用/reader绑定](../../protocol/native400-source-selection.md)和400-09 owner，建立单可信审阅会话/单选择/单任务、uint64序列高水位与最近ACK去重、同步匹配job后取消，以及审阅授权/任务期限的同步Boolean gate进owner提交/发布。不能只依赖timer abort、把取消当回滚或从HTTP失败盲重试；unknown保留至可信重开。保持内部原创临时环境，不接真实源/设备/生产listener/现有服务；400-14交互profile/IPC/UI、原生picker/可信页面授权仍另验。

## 原 README.md

[400-12内部选择绑定](../../reports/2026-11-03-native400-12.md)：元数据选择不读内容、opaque引用/TTL/撤销、原reader打开后首读前指纹比较与manager提交前检查已实现；35专项/监督CLI/check/全套1308通过，原map/wire与默认路径接口保持。[API/回退](../../protocol/native400-source-selection.md)，复现：`node scripts/verify-native400-12.mjs --output .cache/native400-12/results.json`。仅内部离线能力，无网页控制或真实源；下一400-13有界控制器/同步授权gate先Spec/Diff。

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
| 下一入口 | 400-01至05已有离线实现；400-06评审已完成文档范围。400-07周期预算已离线实现，400-08已离线完成，400-09保存/独立批准复验/只读槽已离线完成，400-10临时status/owner装配已离线完成，400-11操作契约评审已完成，400-12可选内部选择绑定已完成，下一400-13有界控制器；正式策略/协商/运行期写入和G1/G2/24fps另审 |

400-10[报告](../../reports/2026-11-03-native400-10.md)/[API](../../protocol/native400-source-review-host.md)：36专项/监督CLI/check/1273全套通过赢家专属owner、只读status代理与构建JS宿主实际读取、双进程选主/半启动/挂起attach拒绝、历史重开/取消/unknown/坏档/实际退出。无生产或设备通道、真实DSH/browser加载和页面审阅操作；后续400-11评审已完成，400-12可选绑定已完成，下一400-13控制器。

400-12[报告](../../reports/2026-11-03-native400-12.md)/[API](../../protocol/native400-source-selection.md)：35专项/监督CLI/check/1308全套已验元数据选择与实际fd首读前钉住、撤销/TTL/时钟/资源及manager原valid门禁；只补内部选择，不改source-map/设备wire/只读service。一次选择授权/会话/去重/定向取消与同步授权gate待400-13，页面/原生provider待400-14；外部仍400-06快照。

## 原 docs/protocol/native400-source-review-controls.md

2026-11-03。**本页整体控制契约仍属设计；400-12已实现内部选择/reader可选绑定，其余审阅授权、请求控制、网页写路由/原生picker尚未实现。** [Spec](../plans/native400-11-spec.md)/[Diff与实施切片](../plans/native400-11-diff.md)、[报告](../../reports/2026-11-03-native400-11.md)、[既有API探针](../../protocol/vectors/native400-11-controls-review-v1.json)。依赖[400-10只读宿主](../../protocol/native400-source-review-host.md)与[400-09存储](../../protocol/native400-source-review-storage.md)，不改变既有证据等级、wire、素材/固件许可或设备范围。

| 项 | 当前实际代码/证据 | 本次决定（待实现） |
| --- | --- | --- |
| 可信输入 | prepare验证快照candidate/catalog与两份独立批准，内容摘要进sourceKey，winner才开owner | 保持原批准边界；网页不提供批准正文或自批准，换批准须可信宿主显式新实例/新目录并保旧历史 |
| 文件选择 | 400-12元数据选择/opaque引用与可选expectedSource已验，原O_NOFOLLOW/private/28MiB和任务内SHA保持 | 400-12已实现上述可选内部绑定；未来交互必须强制携带，不允许失效后降级为undefined旧接口 |
| 选择到读的间隙 | 400-11 OBS-01表明旧路径接口只验任务打开对象；400-12已验可选绑定首读前拒该替换 | 合法新对象也拒绝；expectedSource缺省旧路径保持，页面受限流程尚未接入 |
| 取消关联 | owner.cancel()只操作当前任务，无job_id；OBS-02确认下一任务会被当前cancel取消 | 控制器同步核job/会话/代数，再无await地调用cancel；旧取消不得误伤新任务 |
| 宿主与页面权限 | 本仓库已验prefix/React设置槽/只读status，未验native picker或可信审阅页面身份 | DSH网页保持只读。先做临时内部控制器/原创fixture；正式交互必须另核选择provider与授权发放，不因能注册路由就开放写权限 |
| 异步/退出 | 单IPC2.5秒，reader最长可设30秒且I/O可忽略abort；关闭等真实退出 | start只异步受理任务，不等待整文件/持久化；HTTP失败不推断未受理，取消/退出期间busy保持至真实退出 |
| 授权期限到提交 | owner valid现增加选择撤销/时钟检查，仍不知道未来审阅会话/任务授权期限 | 控制器须传可信同步Boolean授权gate到owner最后提交/发布检查；仅定时器abort不能覆盖同步fsync阻塞期间的到期 |
| 持久恢复 | journal原子CAS、rename后unknown、重开仅历史；没有持久请求去重账本 | 去重只在同实例/同审阅会话有界成立，重启旧请求失效；未知提交不重试，可信宿主关闭重开后再实际复验 |

OBS探针描述400-11时旧接口；[400-12选择绑定](../../protocol/native400-source-selection.md)已补内部选择子范围，但无审阅授权/定向取消实现。已通过的完整文件SHA不是选择时授权、全媒体验证或设备库存。当前`sourceReview/1`与400-03 wire字节均保持。

可信撤销/授权到期必须经同步授权gate进入owner的最后提交与发布检查：核同实例/会话代数和单调时钟，不做I/O、不返回Promise或重新进入owner；非Boolean/异常失败关闭。事件timer只唤醒取消，不能代替在同步文件写/fsync之后、rename之前直接读时钟。当前owner只有400-12选择生命周期checkSource检查，没有完整审阅授权gate，后续400-13须最小扩展，并保缺省旧语义。

后续按切片列实测/未覆盖：400-11仅OBS-01/02和既有回归；400-12的35专项覆盖内部选择换文件/TTL/撤销/资源与提交检查子范围，不能将CTL-01–40整体标完成。协议解析测试不等于OS dialog/真实浏览器/DSH身份授权或设备证明。

## 原 docs/protocol/native400-source-selection.md

原owner.review/revalidate选项可传expectedSource，原路径/label/floor/批准逻辑保持。选定引用传入实际reader后，manager在读后、journal原valid门禁及发布前复用checkSource；这是**选择生命周期**检查，不是400-13审阅会话/任务期限/完整授权gate。

[CTL-09–12](../../protocol/native400-source-review-controls.md)中的内部选择换文件/改动/权限/链接子范围已有覆盖；CTL-13–16仅选择TTL/撤销/读退出子范围，**审阅会话、一次消费、跨实例授权尚无**；CTL-29–32仅选择撤销/原unknown处理，非完整授权gate或定向取消。其余CTL场景不能因本切片标为通过。

下一400-13先Spec/Diff：可信会话/单次选择消费/请求序列与ACK去重、定向job取消，以及同步授权gate进入owner提交/发布；复用本选择和原事务。400-14交互profile/可信页面授权与原生provider另审。真实用途/G0/设备N_boot/库存/Flash writer/proof/TLS时间凭据/G1-G2/24fps仍独立，外部状态沿400-06快照。

## 原 docs/protocol/native400-g0-review.md

6. **400-12内部选择绑定（本片离线已完成）**。见[35专项/1308回归](../../reports/2026-11-03-native400-12.md)/[API](../../protocol/native400-source-selection.md)。原reader实际fd首读前核所选元数据、撤销/时钟/真实退出和manager原提交valid已验；不是来源用途授权、全媒体proof或设备确认，原wire/布局/只读service保持。下一400-13仅内部有界操作/完整同步授权gate，真实G0/G1-G2/24fps门槛不变。

## 原 docs/context/plans/native400-manager-alignment-spec.md

## 400-12后的当前入口（2026-11-03）

400-01至05、07至10/12离线实现及06/11评审已完成；[400-12报告](../../reports/2026-11-03-native400-12.md)记录35专项/1308回归、内部元数据选择/原reader首读前绑定与提交检查。可信会话/操作控制与完整同步授权gate待400-13，网页/原生provider待400-14，CTL整体不能标完成。service仍400-10只读，下一400-13先Spec/Diff；正式合同、真实用途和G1/G2/24fps另审。
