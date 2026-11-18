# 共同G0、真实许可与G1/G2证据核定

2026-11-02后续目标说明：本文件保留360审查的历史范围；当前主线转[400/78](../context/native400-baseline.md)，下一360审阅建议已由400身份/能力/完整性/新协议分片替代。360兼容回退和旧验证结果保持，不追写为400通过。

2026-11-02，先写[Spec](../context/plans/round-pet-g0-closure-review-spec.md)/[Diff](../context/plans/round-pet-g0-closure-review-diff.md)。本轮完成管理端只读审查，**联合G0未关闭，G1不满足完整维护，G2缺证，真实通道保持NO_GO**。不是固件任务的新答复、双方签核、素材批准或设备操作授权。

## 本轮事实与快照边界

固件HEAD仍9816317ae5ac6f86c982ef773461de595f407747，初读dirty条目186；HEAD不能复现工作区。选定38份规则/文档/JSON/实际源码/许可，内容SHA见[证据摘要](../protocol/vectors/round-pet-g0-closure-review-v1.json)。与R1共有的21份证据中，只有current-status变化；G0回复、输入向量、Store/播放器/策略/HTTP、导出recipe和G1-lite/内存报告均保持原摘要。采样期间current-status/current-todos并发变化，已重新读取并补入新增400-pipeline-ack报告/JSON；初始与重读SHA分开保留，不宣称36文件全程不变。比对范围不包括整个固件仓库，更不代表新代码已部署。固件文档的hub469/385项为其历史读取，不覆盖R7及当前940项。

最新current-status顶部与compact78设备报告一致：400窗口已关闭，恢复原有效应用cbdf316906bfa66752b586c7438ba9f2d943be98bfa91dd2a876cb1b1b30acc9（1318752B）；整个2MiB应用区SHA c3085e0d363afe9b54412f7acfbcf70a106dcd447dffc5a84b96ba558eb56400。正常启动前32MiB结束归档7a4fb43bc12d96e84f4c17b26871355241e49c3f428fcab202bb61ba76107402与窗口前逐字节相同，system及完整28MiB缓存一致，V2 seq5/0、4、1、11/964帧复核；之后原cbdf/id0启动观察8秒、串口释放。**这些是只读上游报告，不是本任务新读Flash/现场；启动后没有再次全片读取。** 原端点/服务未改，报告中的地址不抄入本仓库。

因此替代旧“A/B中断现场尚待收尾”的当前表述，但不把cbdf当67、不自行切回历史版本。67 P3性能基线和a7精确回退仍保护；新400/compact78四动作841帧完整性与无Wi-Fi内存样本、12.395–15.057fps/24失败均不覆盖正式360 G1或G2。本轮未读取任何私有全片/配置/日志/凭据或操作设备。新400可靠ACK/短锁e6fe66d7/410e23e4宿主候选已复核，未部署、无新设备资源证据；其中USB ACK V2不是hub JSON revision2。

## 契约核定与交接

逐项权威清单已回写[C01–C12](../context/plans/round-pet-g0-handoff.md)、[差异表](../context/round-pet-hub-baseline-alignment.md)。没有用重复实现或延长TTL代替固件证据。

| 管理端已确认并保持的决定 | 固件实际证据／未决点 |
| --- | --- |
| schema2由A1单RAM＋持久Flash执行，不只parser；28MiB/4+1/保护动作0/4、center53与数值一致 | 固件只有capability_values候选，实际完整hello/protocols/固件身份及新wire未实现 |
| 受信hub批准固定(P,M,N)，设备只保单descriptor；页≤8且实际body≤4096，F/完整媒体验证不可省 | 固件旧v5仍大目录/双catalog，缺分页消费及旧分配释放预算；不能假定新通道已节省RAM |
| accepted、verified、playing、saved、display、inventory独立；首帧须提交，saved须持久确认，淘汰更新当前库存 | Store.save_root在marker后读回；commit/recover对外仍bool，读I/O失败与坏根混合，旧“previous root retained”日志不是确定未保存证据 |
| 首窗口远端cached0/11、physical4优先，remote4暂禁；触摸结束回最新有效base，维护冻结最后画面 | 管理端R2/R4已有显式门禁，固件旧回复仍写待hub选择，未读到对R3–R7的新增确认；真实UI/触摸适配未接 |
| R7 gate失效保留一次本地收尾，立即失效旧网络/播放；unknown只读恢复，不复活旧回执/降floor | 仅同步模型已验。固件persist在commit前查cancel，commit内无可取消钩子；gate原子性、凭据撤销、RTOS实际退出和最坏残余待确认 |
| R3修订2＋80正/62反、R5 GET关联及R6 loading门禁是管理端当前提案 | 固件回复仍用候选profile round-pet-native360/1，不同于wire/1；未共同采纳完整context、错误/HTTP表、两阶段hello、full-offline-review选择及GET许可/ETag/关联头 |
| 单TLS/单HTTP owner；段后exchange，1在途＋latest＋待段；不足期限不启动，不提前放槽 | 现固件control和loader分别可建HTTP句柄，request只配置旧Bearer；timeout=3000不证明总取消/清理上界。新owner/单调期限/可信时间/持久凭据及新旧源互斥仍缺 |

建议固件任务下一答复逐项绑定**管理端合同与向量SHA、固件文件/构建SHA、选择/拒绝/修订原因、验证层次**。本报告只提供交接，没有发送消息或代签：

1. C07明确接受或修改revision2及R5 HTTP关联；若修改先双端Spec/Diff与新golden，不在已有向量中静默兼容。JSON合同与HTTP附录共同签核，不能只认可路径名称。
2. C04/C08给出取消观测→原子gate→object/root marker→读回→实际退出的状态表与故障分类。R7内部token不出wire。建议gate前撤销拒绝新写；gate后只收尾已验证事务、停止网络/播放，凭据撤销不新授权载荷/控制；这仍是管理端建议，待固件确认。
3. C09明确不可中断残余、全验/擦写/控制等待/HTTP/guard/清理上界和测法；失联/暂停/超期后新owner不抢未退出工作。计时结束仅表示失效，不能自动宣告I/O已退出；没有可信上界仍不准入。
4. C10/C12先交可信时间引导/失效、证书与私钥/epoch原子持久化、撤销/重绑定/丢钥恢复及开机前选择唯一网络owner的Spec。RAM凭据TLS探针与正式配对分开，认证失败不回旧v5或明文。

关键只读定位：[Store.save_root/marker读回](/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio/apps/round-pet/devices/esp32s3-touch-amoled-175c/main/assets/pet_native360_store.h:138)、[Store.recover bool](/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio/apps/round-pet/devices/esp32s3-touch-amoled-175c/main/assets/pet_native360_store.h:179)、[commit](/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio/apps/round-pet/devices/esp32s3-touch-amoled-175c/main/assets/pet_native360_store.h:338)、[persist取消/冻结](/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio/apps/round-pet/devices/esp32s3-touch-amoled-175c/main/assets/assets.cpp:274)、[旧HTTP创建/清理](/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio/apps/round-pet/devices/esp32s3-touch-amoled-175c/main/control/http_request.cpp:18)、[v5配置/请求](/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio/apps/round-pet/devices/esp32s3-touch-amoled-175c/main/control/control.cpp:15)、[刷新后presented标记](/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio/apps/round-pet/devices/esp32s3-touch-amoled-175c/main/playback/playback.cpp:589)。行号按本轮内容SHA，不是永久提交链接。

## 正式真实包身份与许可

只读正式native360-production源manifest、hub360 package/catalog及46 PET4。三份原文件SHA、逐文件F/长度/原ID、manifest内源SHA/index SHA与R1向量一致；独立使用本仓库受限canonical重算P/M/N，没有借用固件导入器或运行其Python代码。46文件共225509627B；本轮未重解11086帧或重读源视频，旧全帧/源blob证据沿R1且明确注明复用条件。缺approval的真实元数据入口仍拒绝，没有生成index I或真实CAS。

| 域 | 复核结果 |
| --- | --- |
| P | 3afe4578cba08cd036c70483befaca1324e1d62e76649ace5557a758e0aef754 |
| M | 9045bd6b99b365a86e3adf3762bebb635984d4839f6c203c7a9cf7c13b05299d |
| N | dfc829e13e7c25d732ae0c0afd011f1232419e603ba06c225104645ea668bdf6 |
| 原源manifest | a6a2ddae50a8fe4ddf15ff07a3a228dccf865bb91a037693ce0a72232204c39e |

固定86181ce的[README许可段](https://github.com/PC2005-cloud/dsh-pet/blob/86181ce1660a57ab27336630bab5b344de71b28c/README.md#许可)经GitHub只读工具取得，文本SHA与R1相同（20bfd7f6…）；它区分MIT代码与非商业素材，要求公开衍生标源，并列出上善无形、ZipZipPipe与非官方形象来源。[代码LICENSE](https://github.com/PC2005-cloud/dsh-pet/blob/86181ce1660a57ab27336630bab5b344de71b28c/LICENSE)仍为MIT；固件Apache-2.0、LZ4 BSD-2-Clause分别核对，无外部实现复制。

本次已直接读到[ZipZipPipe原声明](https://www.bilibili.com/opus/1247156596114456581)（页面标记编辑于2026-09-20）：声明将形象置于CC BY-NC-SA 4.0，允许个人定制留念并反对售卖/商业化。它不等于所有视频/提示词/衍生素材的独立权属证明。旧“原文503未读到”缺口已替代。

[CC官方简述](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans)及[法律文本](https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.zh-hans)本次均可读：非商业范围，分享时保留署名/来源/许可链接并说明改动；分享演绎作品时适用相同方式共享，且不能附加限制。协议只覆盖许可人有权许可的范围，不能当商标或其他人格权授权。

**原文证据已补齐；A2用途批准仍未创建。** 这里的approval是项目的受信审阅输入，不是要求原作者每次另发授权，也不是哈希证明或本仓库MIT能替代的许可。下一可单独进行仅非商业offline-validation审阅：记录审阅责任/日期、精确P/M/N/source/46 IDs、用途与传播范围、原文链接、署名和转换说明，审核后由受信调用方提供A2的reviewed-upstream approval。审阅责任/日期放审阅记录，不能向闭合approval schema随意加字段；approval含approval_id、credits、license_ref等既有字段。尚未提供的审阅人不得伪填为用户。

建议署名内容覆盖PC2005-cloud/dsh-pet固定提交、原型上善无形/设计ZipZipPipe、CC链接、360裁切/量化/遮罩/PET4转换说明；发布媒体衍生包前落实SA及非商业传播。保留当前license_ref=upstream-reference-only也可由独立审阅输入精确匹配，**不必为了补证改P/M**；若实际更改license_ref或catalog则重算P/M再审。400视觉批准/分层导出/原创测试批准不继承为本360库用途批准。商业设备、公开素材包或其他用途不在此次审阅范围。

## G1/G2门禁核定

| 门槛 | 可核验证据 | 结论与缺少项 |
| --- | --- | --- |
| G1完整v5维护 | 39候选联网低位40059B早停；fc55联网60s/待机通过，缓存挥手呈现后SDK历史低位46527B＜49152B，写尝试0；后续A/B仅A准入/待机、切换/点击及B未执行 | **未通过**。M1其余动作及M2下载/保存、M3下载取消、M4写取消、M5故障、M6淘汰、M7业务离线重启缺证，不能用恢复备份冒充M7 |
| 内存修正 | 控制RX512/下载4KiB及清理包装、阶段样本/无TIMING main栈输出已宿主/构建；cbdf是RX4096维护对照，fab208 RX512无完整对照实测 | **代码已实现、改善未核定**。名义RX减少3584B而新增静态912B，不能算术通过；SDK聚合历史低位不当同刻最低或泄漏证明 |
| G2单TLS/HTTP及安全 | 固件G0仅设计；选定生产路径无新wire owner/持久凭据实现，docs/reports无可交付G2探针报告；Node loopback为管理端宿主 | **缺证/待实现**。需精确构建/SDK选项、可信时间/日期失败、握手/复用/重连/撤销/段式读/保存竞争及退出实测；不能用400无Wi-Fi内存代替 |
| 动态资源与最坏等待 | 正式P3显式PSRAM6916777B含65536 read-ahead；旧内部59035B是播放样本 | 保持内部≥49152B、PSRAM≥1048576B/最大块≥524288B、main剩余≥1024B、2MiB app及≥256KiB余量目标；TLS内部最大连续块/新任务栈阈值与清理上界须固件先固定后测，无值不准入 |

G1与G2离线设计/宿主准备可分开；G2 RAM凭据探针不是持久绑定完成。G3设备窗口仍需G0共同签核、真实包批准、G1/G2与管理端生产装配，另审精确现场/方案/回退；首窗口仍缓存0/11＋physical4、无保存，再G4未缓存完整校验/首帧/保存/淘汰/重连。新400方案和不同设备不并入首闭环。

## 下一最小切片及回退

1. **可先离线：真实360用途审阅与批准输入交付**。只补审阅记录/署名/范围，受信独立approval齐备后另Spec/Diff做私有A2完整库导入/重开；不改recipe/素材或从账本自取批准。本轮不导入。
2. **可先离线：固件C04/C08结果分类与C07共同向量回复**。先固件Spec/Diff/宿主失败向量及构建，给出原子gate和unknown分类；随后管理端对照其交付。不需要重复实现R7或再次跑同一loopback作为固件证据。
3. **可先离线但由固件负责：C09/C10/C12持久身份/单owner/资源方案**。默认OFF探针及预算先审；如需异步设备模型，必须另Spec/Diff验证实际退出，不沿同步模型推导时限。
4. **必须另获设备授权：G1续测和G2动态资源**。冻结当时实际app/ELF/配置语义/epoch/完整缓存及备份，不把旧67或7a4历史快照强刷成未来现场。准备只替app的边界、门禁停止点、app/配置/凭据/缓存分别核验回退，再申请窗口；本轮不执行任何步骤。

本轮回退仅撤回文档/去敏JSON或删除自有忽略审计输出，无外部服务/格式/批准迁移。保留全部既有源码/素材/向量，不复制媒体或配置到Git，不提交推送。固件回复中旧hub快照由固件任务未来自行更新，本轮未发送消息或修改外部文件。

## 验证与保护

| 检查 | 实际结果与范围 |
| --- | --- |
| npm run check | 退出0；仅现有.mjs语法检查 |
| npm test | 含候选构建940/940通过，失败/取消/跳过均0，112771.655292ms；没有新增测试或将审计计入940 |
| 只读身份审计 | 46 F/长度/原ID及P/M/N/source/三元数据原SHA保持；无approval入口拒绝；未重解全帧/读源视频/真实导入 |
| 文件身份保护 | 本仓库285份既有源码/脚本/测试/native内容SHA保持；合同修订2/向量SHA保持；38份外部重读证据再次核对，采样期两份上下文变化已明确记录 |
| 文档核对 | 20份Markdown/609本地链接、证据JSON/空白与未决状态核对通过；不作为已实现的自动准入门禁 |

忽略证据位于.cache/round-pet-g0-closure-review：check.log、test.log、identity.json、firmware-before-sha.json、firmware-reviewed-sha.json及source-before-sha.json。公开证据JSON只保存选定摘要/结论，没有服务地址、令牌、原始设备响应或素材；固定README/代码许可副本只在忽略审计目录。

临时只读审计初次有键名点访问及null-prototype对象比较错误，修正为原键索引和既有canonical相等后通过；不是素材变更或产品校验放宽。公开GitHub页/原始链接经网页工具cache miss后使用GitHub只读工具取得固定文本；原B站与CC页面由网页工具直接读取，没有绕过登录或使用私有接口。未构建/执行固件测试、未启动本轮生产服务。当前摘要/待办/索引/正式目标与C表已更新，被替代部分见[归档](../context/history/round-pet-g0-closure-review-evolution.md)。
