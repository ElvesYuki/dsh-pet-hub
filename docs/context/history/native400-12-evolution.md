# 400-12替代记录

2026-11-03：以下为实施前原文，由[当前系统](../current-system.md)/[待办](../current-todos.md)及[400-12报告](../../reports/2026-11-03-native400-12.md)替代。只替代选择绑定尚未实施/旧最新验证与下一入口；400-11整体操作设计/原阶段证据保留，不能将其40项验收清单误写为全已通过。

## 原 docs/context/current-system.md

2026-11-03 [400-11显式操作入口评审](../../reports/2026-11-03-native400-11.md)已完成本轮文档/既有API对照：两份独立批准保持由可信调用者提供；拟定来源选择→任务内expectedSource钉住、可信审阅会话/单次引用、有界seq去重/定向job取消、同步提交授权gate及unknown可信重开。原创临时探针OBS-01/02确认选择前后换文件与无job关联cancel的接线缺口，未新增操作实现。全部332条原源SHA保持，check（语法）/含构建1273/1273通过；CTL-01–40只是未来验收清单、未执行，不计新增测试。[Spec/Diff](../plans/native400-11-spec.md)、[拟定契约](../../protocol/native400-source-review-controls.md)、[去敏证据](../../protocol/vectors/native400-11-controls-review-v1.json)、[旧入口归档](native400-11-evolution.md)。当前代码能力仍400-10只读宿主，网页写路由/选择引用/定向取消/授权gate/原生picker及可信页面会话均待实现/验证。下一400-12仅离线实现选择绑定；未读真实素材/cache/固件/备份，无生产/设备或现有配置操作，外部仍400-06快照。

400-07完整周期预算/24专项仍有效，现全套包含其回归；6720提前renew/原4510 floor、GET-only/整体exchange与源/累计compute、严格计划必要条件和170段先job到期均保持。400-08未接生产/IPC/设备来源，也未重验真实cache或全帧媒体。400-09候选保存/重开和只读槽已验；400-10已验显式临时status/owner退出，400-11已完成拟定操作契约评审，下一400-12先实现内部选择绑定，继续不从来源审阅生成设备库存授权。

## 原 docs/context/index.md

管理端最新（2026-11-03）：[400-11 Spec](../plans/native400-11-spec.md)/[Diff](../plans/native400-11-diff.md)、[拟定操作契约/40项未来验收](../../protocol/native400-source-review-controls.md)、[评审报告](../../reports/2026-11-03-native400-11.md)/[两项既有API对照](../../protocol/vectors/native400-11-controls-review-v1.json)、[旧入口归档](native400-11-evolution.md)。已收口独立批准、任务内选择绑定、可信会话/有界去重/定向取消/同步授权gate与unknown恢复设计；无新操作实现，332条原源保持，check/1273回归通过。当前运行能力仍400-10只读宿主，原生picker/可信页面授权未验，CTL-01–40未执行。下一400-12仅内部选择绑定离线实施；无真实源/设备/生产或现有配置变化，正式G0/用途/安全资源/Flash/G1-G2/24fps另审。

## 原 docs/context/current-todos.md

1. **400-12选择身份钉住与既有reader绑定（下一实施入口）**：先Spec/Diff，按[400-11评审/切片](../plans/native400-11-diff.md)在可信运行层显式选择后记录私有文件指纹，由原400-08 reader打开fd后首读前核expectedSource，并经400-09 manager可选传递。复用相同私有/长度/链接/指纹规则，不新建reader或只在外层stat；验证选择后换合法同大小文件/原位改动/mtime恢复/权限与链接、选择失效、实际读退出及原recipe/缺省兼容。仅原创临时文件，不接真实源/设备/生产listener/现有服务；400-13控制器/同步授权gate、400-14交互profile/IPC/UI仍待实现，原生picker/可信页面会话另验。

## 原 README.md

[400-11操作入口评审](../../reports/2026-11-03-native400-11.md)已收口选择绑定、独立批准/可信会话、请求去重/定向取消与同步授权gate设计；两项原创临时对照确认既有接线缺口，332条原源保持，check/全套1273通过。[拟定契约](../../protocol/native400-source-review-controls.md)的CTL-01–40尚未执行，页面操作/原生选择器仍未实现。下一400-12仅离线实现内部选择身份绑定，原400-10只读入口保持。

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
| 下一入口 | 400-01至05已有离线实现；400-06评审已完成文档范围。400-07周期预算已离线实现，400-08已离线完成，400-09保存/独立批准复验/只读槽已离线完成，400-10临时status/owner装配已离线完成，400-11操作契约评审已完成，下一400-12仅内部选择绑定；正式策略/协商/运行期写入和G1/G2/24fps另审 |

400-10[报告](../../reports/2026-11-03-native400-10.md)/[API](../../protocol/native400-source-review-host.md)：36专项/监督CLI/check/1273全套通过赢家专属owner、只读status代理与构建JS宿主实际读取、双进程选主/半启动/挂起attach拒绝、历史重开/取消/unknown/坏档/实际退出。无生产或设备通道、真实DSH/browser加载和页面审阅操作；后续400-11评审已完成，下一400-12先实现选择绑定。

400-11[报告](../../reports/2026-11-03-native400-11.md)/[拟定契约](../../protocol/native400-source-review-controls.md)：已完成文档评审和两项原创既有API对照，332条原源不变，check/1273回归通过。来源选择钉住/可信会话/去重/定向取消/同步授权gate均是后续设计，CTL-01–40未执行；当前仅400-10只读代码，下一400-12内部绑定，不能据评审开启网页写入或真实窗口。

## 原 docs/protocol/native400-source-review-controls.md

2026-11-03。**本页是评审后拟定契约，尚无对应运行期实现/网页写路由/原生picker。** [Spec](../plans/native400-11-spec.md)/[Diff与实施切片](../plans/native400-11-diff.md)、[报告](../../reports/2026-11-03-native400-11.md)、[既有API探针](../../protocol/vectors/native400-11-controls-review-v1.json)。依赖[400-10只读宿主](../../protocol/native400-source-review-host.md)与[400-09存储](../../protocol/native400-source-review-storage.md)，不改变既有证据等级、wire、素材/固件许可或设备范围。

| 项 | 当前实际代码/证据 | 本次决定（待实现） |
| --- | --- | --- |
| 可信输入 | prepare验证快照candidate/catalog与两份独立批准，内容摘要进sourceKey，winner才开owner | 保持原批准边界；网页不提供批准正文或自批准，换批准须可信宿主显式新实例/新目录并保旧历史 |
| 文件选择 | reader接受内部file路径，O_NOFOLLOW/私有/精确28MiB，任务内fd/path指纹与全SHA/逐payload一致 | 路径不进入网页；选择时记录内部指纹，任务打开fd后首读前比较同一指纹，复用既有reader，不在外层stat后再无条件按路径打开 |
| 选择到读的间隙 | OBS-01：早先选定路径被另一份合法原创文件替换，现有reader成功校验实际打开的新文件 | 合法新文件也不能静默替代用户所选对象；expectedSource缺省旧路径保持，仅显式受限流程要求绑定 |
| 取消关联 | owner.cancel()只操作当前任务，无job_id；OBS-02确认下一任务会被当前cancel取消 | 控制器同步核job/会话/代数，再无await地调用cancel；旧取消不得误伤新任务 |
| 宿主与页面权限 | 本仓库已验prefix/React设置槽/只读status，未验native picker或可信审阅页面身份 | DSH网页保持只读。先做临时内部控制器/原创fixture；正式交互必须另核选择provider与授权发放，不因能注册路由就开放写权限 |
| 异步/退出 | 单IPC2.5秒，reader最长可设30秒且I/O可忽略abort；关闭等真实退出 | start只异步受理任务，不等待整文件/持久化；HTTP失败不推断未受理，取消/退出期间busy保持至真实退出 |
| 授权期限到提交 | owner/journal当前valid只核关闭/取消/signal/任务代数，不知道未来审阅会话期限 | 控制器须传可信同步Boolean授权gate到owner最后提交/发布检查；仅定时器abort不能覆盖同步fsync阻塞期间的到期 |
| 持久恢复 | journal原子CAS、rename后unknown、重开仅历史；没有持久请求去重账本 | 去重只在同实例/同审阅会话有界成立，重启旧请求失效；未知提交不重试，可信宿主关闭重开后再实际复验 |

400-12仅可选内部绑定，默认旧调用/recipe/持久格式保持；400-13/14撤控制adapter授权、取消且等实际退出后回只读profile，已提交journal保留，unknown/残锁不删除。新profile不能通过旧descriptor自动启用或改DSH配置。

## 原 docs/protocol/native400-source-review-host.md

后续[400-11操作评审](../../protocol/native400-source-review-controls.md)已收口上述设计，运行实现仍保持本页只读边界；下一400-12先实施选择身份钉住，控制会话/定向取消/同步授权gate与网页交互仍待实现。不开放任意路径读、自动批准/扫描或账本修复。共同G0、真实用途、N_boot协议/当前库存、Flash writer/proof、可信时间/凭据/TLS、G1/G2/24fps仍另审。本轮外部事实沿用400-06快照，生产/实体窗口须另有具体方案、回退及授权。

## 原 docs/protocol/native400-g0-review.md

5. **400-11操作入口评审（仅文档/既有API对照完成）**。见[报告](../../reports/2026-11-03-native400-11.md)/[拟定契约](../../protocol/native400-source-review-controls.md)。选择身份钉住、可信会话/单次引用、seq去重/定向取消与同步授权gate列为待实现；两项原创探针不构成新的准入实现，40项未来清单未执行。332条原源保持、check/1273回归通过。下一400-12内部选择绑定，不开放设备/生产通道或网页写路由，G0/G1-G2/24fps限制保持。

## 原 docs/context/plans/round-pet-g0-handoff.md

[评审](../../protocol/native400-source-review-controls.md)/[报告](../../reports/2026-11-03-native400-11.md)：管理端下一阶段先绑定选择时文件与任务内实际fd，再做可信会话/有界请求去重/定向取消/同步提交授权gate，最后才显式交互profile；目前均待实现，原400-10只读和设备协议字节保持。两项原创探针仅核既有API边界，不读固件/现场；不授予真实源新用途、全媒体proof/设备库存、Flash writer或G1/G2准入。下一400-12内部选择绑定不需设备资源验证，原生picker/可信页面身份及真实源/设备窗口仍另审。

## 原 docs/context/plans/native400-manager-alignment-spec.md

## 400-11评审后的当前入口（2026-11-03）

400-01至05、07至10离线实现及06/11文档评审已完成；[400-11报告](../../reports/2026-11-03-native400-11.md)记录两项既有API对照及332条原源保持/check/1273回归。选择绑定/可信会话/操作控制与同步授权gate尚未实现，40项未来验收未执行，代码仍400-10只读。下一400-12先离线实现内部选择钉住；正式合同、真实用途和G1/G2/24fps另审。

## 原 docs/context/decisions.md

[评审报告](../../reports/2026-11-03-native400-11.md)/[拟定契约](../../protocol/native400-source-review-controls.md)及两项原创探针确认接线缺口；本轮无生产源变更，332条原源保持/check/1273回归通过，CTL-01–40未执行。下一400-12仅选择绑定，之后控制器及默认关闭交互另做；原生picker/可信页面身份未验，当前DSH继续只读，真实用途/G0/资源窗口独立。旧入口[归档](native400-11-evolution.md)。
