# 可信租约预算 Diff（实施前）

新增core/lease-budget：纯预算函数及显式可信回执guard，复用Registry相对观察/expect；不改变旧入口。新增simulator/lease-budget：复用双时钟台与绑定完整消息的可信fixture。新增tests/lease-budget和verify脚本：安全边界、失败零修改及漂移/延迟矩阵。不添加依赖或真实网络。

文档新增协议/报告，当前摘要与待办直接替换已完成项，被替代记录归档history；实际TTL承载、实测参数及v5转换保持未验。

Registry相对observation增加可选request_seq：同毫秒续租按uint64序列前进；一旦进入有序观察不能退回无序，旧接口在未进入新模式的会话中保持原行为。guard始终提供该序列，避免下游以同sent_at异内容误拒绝新续租。没有添加生产网络入口。

实施完成：core guard/预算函数、合成证明、精确矩阵与11条验收及CLI均已引用。257项全套、SIM30+4、13条双时钟通过；参数未实测、旧入口未自动接管。当前摘要/待办已替换、旧片段归档；详见[报告](../../reports/2026-10-30-lease-budget.md)。
