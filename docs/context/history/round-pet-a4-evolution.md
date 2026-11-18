# A4主动拉取与有界承载演进

2026-10-30。替代A4宿主候选未实现的描述；生产/ESP/共同wire及A5仍待验。当前[报告](../../reports/2026-10-30-round-pet-a4.md)/[API](../../protocol/round-pet-a4.md)。以下链接保留原文件语境。

## 原当前摘要

```text
2026-10-30 A3观察离线候选：check（仅.mjs语法）和test（含候选构建）全套515项通过，新增46项；独立CLI46项及SIGTERM均清临时环境。新RoundPetObservations分离requested/sent、认证候选playback、display、storage和完整inventory；首帧/保存证据、流seq/refresh/root高水位、查询单调ID/未知库存/迟到结果已验。仅内部显式review由UDS赢家创建，经GET status/宿主白名单/共享只读界面，默认无review、deviceTransport=false、无观察写路由。[报告](../reports/2026-10-30-round-pet-a3.md)、[API](../protocol/round-pet-a3.md)、[替代记录](history/round-pet-a3-evolution.md)。

A1纯core单encoded/Flash4＋1/root恢复/read lease和A2独立批准/F/M/P/N/I/严格241流式CAS/provenance重开保持，见[A1报告](../reports/2026-10-30-round-pet-a1.md)/[A2报告](../reports/2026-10-30-round-pet-a2.md)。本轮不把它们自动装配为设备证据。旧Registry仍是simulation参考；新候选只接WeakMap合成proof/虚拟时钟，实际managed TLS/guard适配尚未接入，真实DSH/浏览器本轮未重新加载。

G0管理端审查/[Spec/Diff](plans/round-pet-single-device-spec.md)有效，联合C01–C12未关闭。A3对象schema/四流版本/维护恢复提高refresh代数仍待C04–C07确认；真实包P/M/N/ID/源SHA/许可待C02。A4实际pull/队列/截止、A5默认OFF装配、G1/G2资源/可信时间/凭据和实体首帧/Flash/触摸均待验，模型/宿主预览/HTTP成功均非设备确认。
```

## 原下一入口

```text
1. **A4实际拉取与有界调度离线互操作**：A3候选观察/只读IPC与UI已完成[46专项/515全套](../reports/2026-10-30-round-pet-a3.md)。下一先补A4 Spec/Diff，使用独立临时loopback模拟设备主动exchange、两个HTTP周期回传、分段/段间控制、单TLS/单HTTP、有界latest base与副作用操作、绝对deadline及真实I/O退出。复用现有scoped/managed，不重做密码学优化，不用宿主样本定ESP最坏上界；共同wire未冻结部分须标候选，不启用生产listener。
```

## 原承载差异

```text
| 单TLS／单HTTP | **待实现（生产）**：fixture Agent串行；service仅disabled/simulation且deviceTransport=false | 现行v5 control与loader分别request整文件，不是单TLS owner | A4真实device-pull角色＋A5默认OFF候选；旧v5控制源互斥待固件提供机制 |
| 队列／截止／重试 | **已实现（离线参考）／待实现（生产）**：lane8控制＋1素材，预算反例、close等实际退出已验 | RTOS／Flash忙时控制机会／有界cleanup**待固件确认** | 不照搬8队列；1在途control＋1未派发latest base，段间先控制，未知界限NO_GO |
```

515为A3阶段结果，563包含A4临时mTLS/mock peer，不能改写为实体回执或设备最坏上界。旧8项lane仍为反例参考，未作为新生产队列。
