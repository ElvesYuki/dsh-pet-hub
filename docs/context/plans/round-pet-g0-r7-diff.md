# G0-R7 Diff（实现前）

- 显式新wire executor增加一个gate完成任务/opaque token及只读终态结果；断线/lease/暂停fence控制但保留本地收尾能力，结果不跨会话报告。
- 复用原actor gate/commit/recover；增加finishCommit/recoverCommit、suspend/resume/expire与等待诊断，不改A1核心、R3合同/80正62反、guard/根权威/期限。
- actual同步commit中失效/close不得重入busy actor；close等待真实退出再释放claim，新session/控制/重启竞争拒绝。旧executor缺省及正常R6路径保持。
- fixture增加可信beforeClose清理钩子，R6/R7等待executor再释放根；新增30专项/监督CLI，正常取消清理及check/test，区分模型与真机未覆盖。
- 更新摘要/交接/待办并归档被替代gate缺口；不触设备/固件/pet/bridge/DSH或生产服务。[Spec](round-pet-g0-r7-spec.md)。

实施状态（2026-11-02）：上述修改已完成，30专项/check/全套940通过，监督正常/取消清理通过。实际改动仅executor、两份fixture、新专项与监督CLI及文档；A1内核、runtime宿主adapter和R3固定合同/向量字节保持。详见[验证报告](../../reports/2026-11-02-round-pet-g0-r7.md)及[替代历史](../history/round-pet-g0-r7-evolution.md)。同步模型之外的共同签核与物理资源/退出边界仍待验。
