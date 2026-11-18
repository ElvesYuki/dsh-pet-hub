# G0-R1 Diff（实施前）

- 新增本轮只读复核Spec/Diff和报告；不改runtime/core/UI/插件或设备wire，不执行固件导入器。
- 更新既有baseline、C01–C12交接和三摘要提案的事实/未决标记，对照最新固件答复与真实360/46来源、recipe、许可；来源一致不等于生产批准。
- 用既有管理端代码离线核F/M/P/N/原ID/时序/媒体，临时结果留忽略目录，Git只含必要摘要/验证结论。若缺输入则明确缺口，不补造approved记录。
- 更新当前摘要/待办/索引/第三方边界，将旧G0快照与完成项按主题归档，保留并行400/分层候选和A10结论。
- 运行check/test，写清仍需双方选择的字段/跨语言向量及G1/G2/设备准入；本轮无外部服务/数据迁移，回退见[Spec](round-pet-g0-reconciliation-spec.md)。

实施状态（2026-10-30）：本Spec/Diff先于复核；24份选定外部证据前后SHA保持，46全媒体/源blob身份、9审计负例与check/test746通过。见[报告](../../reports/2026-10-30-round-pet-g0-reconciliation.md)，旧快照/待办已[归档](../history/round-pet-g0-reconciliation-evolution.md)。仅文档/复核向量，无生产实现/独立approval/设备操作，联合G0及G1/G2未关闭。
