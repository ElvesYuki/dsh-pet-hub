# TCP25 Diff（先写后实施，已完成本片）

- bridge增加显式endpoint-arbitrated策略，拒与priority回调混用；默认event/observed-local保持。
- shared CANCEL允许down/paused清理逻辑意图，原授权/CAS与BASE门禁不变，防止停止后的旧目标恢复。
- 新增持续device actor fixture与A跨TTL/语义/回执/取消/重连验证，核core/owner是否需修；不新增wire或触摸上报。
- 更新A合同/对端交接/报告/候选摘要/长期上下文，归档当前B前置结论。无终端修改或设备/现有服务操作。
- 只读核实Node及真实C++同动作新BASE均重建播放身份；新增反例与最小保位续租交接，保持待端侧实现/联合验证，不改wire或伪造首帧。

完成证据：[TCP25报告](../../reports/2026-11-06-tcp25.md)；20专项/1885全量、check和两构建通过。保位续租只完成反例与交接，不算已实现。
