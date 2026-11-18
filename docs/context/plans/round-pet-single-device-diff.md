# 管理端单设备闭环 Diff

2026-11-02范围标记：本文件保留360/46兼容与当时实现依据；当前管理端目标已按用户确认转[400/78 Spec](native400-manager-alignment-spec.md)/[Diff](native400-manager-alignment-diff.md)，[共同G0](round-pet-g0-handoff.md)已更新。不得将下文旧360阶段下一项或旧常量当新400已支持。历史报告/代码/合同不改写，当前实施入口400-01至04。

2026-10-30。状态：G0阶段仅文档交付；后续A1–A10宿主候选已另行实现，真实通道仍关闭。范围与回退见[Spec](round-pet-single-device-spec.md)，A1实际差异见[独立Diff](round-pet-a1-diff.md)。

## G0阶段实际差异

- docs/context：刷新175C报告基线和双端契约差异表，明确管理端当前399项／scoped已实现，固件385项hub快照不覆盖当前事实。
- docs/protocol：新增round-pet-native360/1共同提案及原创散列recipe向量；saved／inventory／maintenance为未实现的新协商扩展，不插入旧phase。
- docs/context/plans：本Spec／Diff、固件交接决定／待确认表，明确A1–A5及G1/G2/G3/G4依赖。
- docs/reports及history：G0审查证据、源码／规划摘要和只读保护核对；被替代的旧175C状态归档，README/index/current摘要／待办更新。

G0阶段不改变packages/apps/native/scripts/tests、锁或依赖，不修改固件仓库，不执行其导入器、构建、服务或设备命令。现有npm test可生成忽略的dist候选，但不安装／启用；无新的生产listener或运行配置。

## 分阶段拟实施Diff（A1–A4离线候选已交付，A5默认OFF已离线交付）

| 切片 | 拟修改 | 不可顺手扩大 |
| --- | --- | --- |
| A1 | 已另行完成独立Flash/Device资源actor和schema2专项，见[报告](../../reports/2026-10-30-round-pet-a1.md) | 不以删除schema1保护代替Flash事务，不改固件Store |
| A2 | 已另行完成专用导入、worker严格分支、独立provenance及35专项，见[A2 Diff](round-pet-a2-diff.md) | 不把P当M，不改namespace／分区，不复制动画大文件 |
| A3 | 已完成候选观察reducer/公共view/内部review/GET只读UI，见[A3 Diff](round-pet-a3-diff.md)；真实协商未装配 | 不把本地expect当设备accepted，不把PC帧当实体playing；不悄悄放宽旧schema |
| A4 | 已另行完成候选pull/handler/实际退出owner与48专项，见[A4 Diff](round-pet-a4-diff.md)；未装配生产 | 不重做scoped优化，不依据宿主耗时更新设备上界 |
| A5 | 已完成单owner默认OFF装配、A2磁盘reader/初始库存/准入与退出恢复，见[A5 Diff](round-pet-a5-diff.md) | 未具备G1/G2和明确执行授权，不开真实listener／安装插件 |

A6另行完成[A1执行器端到端离线对照](round-pet-a6-diff.md)，不改A1–A5核心和运行时源码；会话revision/低root回滚恢复与实体准入继续待定。

每个切片实施前重读本Spec与双方决定，补自己的细化Spec/Diff、失败／回退和新增测试。固件实际修改由固件任务另行交付，不在本仓库代写。

A7另行完成[会话边界/根检查点/维护候选](round-pet-a7-diff.md)，局部扩展A1/A3/A4/A5、选主前固定检查点副本；缺省不自动持久化，不改变公开wire/生产准入。

A8另行完成[显式同文件绑定/根权威](round-pet-a8-diff.md)，新schema/profile隔离、readonly准备后durable CAS、发布前复验；旧v1不迁移，跨进程防整盘回滚与生产准入未完成。

A9另行完成[持久成本复评](round-pet-a9-diff.md)，只加可选数值计量/同负载及条件预算，A8行为/格式/TTL不变；后续A10已按新Spec/Diff完成局部减量，不把样本当上界。

A10另行完成[局部减量Diff](round-pet-a10-diff.md)：保留锁内完整验证/CAS，noop省候选编码，remember复用同次已验摘要；同次full/reduced对照及坏档/冲突/unknown/期限回归通过。无格式/协议/队列/TTL或生产通道变化；共同G0/真实包与G1/G2仍待完成。

G0-R1按[独立Spec/Diff](round-pet-g0-reconciliation-spec.md)完成只读对齐：更新身份、首窗口及取消/恢复的设计边界，旧快照归档，无生产代码或设备配置改动；本轮全套746含并行素材切片，不改写A1–A10阶段报告。正式wire与用途批准/资源仍未准入。

G0-R2已按[独立Spec/Diff](round-pet-g0-r2-spec.md)完成显式首窗口profile/固定选主身份、A5入队/派发门禁及内部选项、纯local模型与A1取消gate/未知恢复；35专项/784全套及check通过。默认通用候选/既有wire/TTL/磁盘格式保持，无生产通道或外部配置变更。R2当时真实UI/wire/固件适配与G1/G2/独立素材批准仍缺；其中wire表示/宿主向量已由下述R3补齐，R4临时宿主装配见后述，生产/设备装配仍缺。

2026-11-02 G0-R3按[独立Spec/Diff](round-pet-g0-r3-spec.md)新增独立合同/codec/有界关联、C++宿主oracle及固定字节向量，旧A4/A3/lease/runtime/设备不迁移，不安装/启生产listener。字段由管理端提案冻结，R3当时固件签核/实际adapter/独立批准与G1/G2仍缺，临时宿主adapter已由R4补齐。

2026-11-02 G0-R4按[独立Spec/Diff](round-pet-g0-r4-spec.md)接默认OFF临时hello/exchange adapter、A3显式schema2/一次来源校验与A8故障恢复，合同修订2仅扩显式离线full-review选择；无GET/生产/设备装配，旧hello/A4/磁盘格式/TTL不迁移。共同签核/真实许可与G1/G2仍缺。

2026-11-02 G0-R5按[Spec/Diff](round-pet-g0-r5-spec.md)提取A4共享lane/writer、接临时metadata/asset GET与逐块授权/实际退出，默认OFF/首窗口不发许可，合同修订2JSON字节不变；生产/设备/共同签核/真实许可/G1/G2未放行。

2026-11-02 G0-R6按[Spec/Diff](round-pet-g0-r6-spec.md)复用A1/executor接新wire执行闭环，显式schema2记录/命中/取消，窄修loading与安全bootstrap；R3合同/A1核心不迁移，真实gate失联/生产/设备/共同签核/许可/G1/G2未放行。

2026-11-02 G0-R7按[Spec/Diff](round-pet-g0-r7-spec.md)补显式模拟executor的gate本地任务、失效收尾/unknown恢复/新会话竞争与实际同步退出；旧默认/A1核心/R3合同不改，真实异步固件边界及生产/许可/资源准入仍待验。
