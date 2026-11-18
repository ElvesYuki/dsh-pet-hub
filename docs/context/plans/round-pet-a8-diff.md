# A8 Diff（实现前）

- binding-store显式rootState新schema/profile，同文件绑定+root/commit证据、CAS/耐久/无变化写优化/实例内回放检测；不自动迁移旧文件。
- managed仅内部提供根authority；A3增加一次性prepare/commit/discard，A4只在显式持久路径离开readView后提交磁盘再发布投影，旧路径保持。
- A5/选主新增显式rootPersistence互斥配置、固定副本和自动从权威恢复；无生产listener/CLI/UI写入口。
- 新临时profile/进程崩溃/真实TLS对照和CLI；更新协议/报告/当前摘要/差异/交接，归档A7被替代状态。

详见[Spec](round-pet-a8-spec.md)。跨重启防整盘回滚、物理断电和设备准入不在本轮完成范围。

实施状态（2026-10-30）：本Spec/Diff先于代码建立；34专项、692全套和独立CLI正常/中断清理通过，见[报告](../../reports/2026-10-30-round-pet-a8.md)、[API](../../protocol/round-pet-a8.md)。原A7摘要已[归档](../history/round-pet-a8-evolution.md)。新增成本/最坏延迟、跨进程可信锚/整盘回滚/物理耐久、生产迁移及共同G0/G1/G2/设备准入保持待验。
