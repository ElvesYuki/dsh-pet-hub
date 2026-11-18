# G0-R2 Diff（实现前）

- core新增首窗口动作/库存策略及有界可信事件模型；无DOM/DSH/网络依赖。
- A5内部可选executionProfile纳入既有选主descriptor，统一入队/派发门禁及内部选项投影；默认通用候选/公共IPC/UI schema不迁移，不新增listener或配置入口。
- A1 Flash/actor复用现有暂存/commit/恢复，补显式取消gate及gate后旧播放失效、受信只读恢复；A6模拟适配可显式选择缓存命中不造新saved，不换生产回执schema。
- 新增原创fixture/专项/监督CLI，覆盖策略、竞态、I/O未知/floor及临时TLS装配；运行check/test和正常/取消清理。
- 更新协议/报告/当前上下文及交接，归档R1被替代状态；固件/设备/pet/bridge/DSH与并行素材保持。详细验收与回退见[Spec](round-pet-g0-r2-spec.md)。

实施状态（2026-10-30）：按本Spec/Diff完成，35专项/784全套、check与独立CLI正常/SIGTERM清理通过；[报告](../../reports/2026-10-30-round-pet-g0-r2.md)列实现/未覆盖/源码SHA。原R1未实现摘要与R2待办已[归档](../history/round-pet-g0-r2-evolution.md)。真实UI/wire/固件适配、独立许可批准/G1/G2/设备窗口保持待验；无外部配置/设备变更。
