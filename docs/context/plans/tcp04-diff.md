# TCP-04 Diff（实施前）

新增core/native400-bridge-events（默认OFF内部Event审阅）、tests/verify CLI、原创native Bridge驱动器（可选只读include端侧头）。新增接口映射/报告/SHA证据，替换“端侧Bridge未实现”的旧下一入口并归档。
保持TCP01/02/03代码与七消息/C++字节向量、生产装配/DSH/依赖/固件/素材不变。新Event审阅不当成正式wire decoder，不把宿主调用prepare/display视为实际硬件证明。


实施状态（2026-11-05）：本片代码与21项宿主验证已完成，显式C++ Bridge对照通过；检查/构建和全套证据见[报告](../../reports/2026-11-05-tcp04.md)。新增源审阅发现未接app_main的control_transport.h v0回调Core草稿，另记[共同交接](../../protocol/native400-bridge-event-alignment.md)，未运行或采纳为正式owner。无新wire/loopback/设备结果；旧摘要见[归档](../history/tcp04-evolution.md)。

收尾补强：本地换目标先历史化；同token不能换intent；失败/失效/Touch完成退役token，Remote Completed仅退役cycle，不阻止正常后续圈。追加既有专项负例并复验，计数仍21。
