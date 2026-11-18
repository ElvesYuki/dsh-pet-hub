# 承载负载与延迟 Diff（实施前）

状态：已按本实现前记录完成宿主切片，见[验证报告](../../reports/2026-10-30-transport-load.md)与[活动契约](../../protocol/transport-load.md)。物理上界、生产队列和优化未包含在完成范围。

- runtime/load-metrics：固定类别的有界数值计数/计时/直方图及去敏schema验证，不保存原始输入。
- certificate-profile、binding-store、mtls-peer、session-runtime：显式可选metrics，保持原验证/同步读取/失败和关闭语义；无缓存优化或默认统计输出。
- simulator/transport-lane及预算评估：明确容量/段边界优先、运行失败冻结及槽回收，仅离线参考，不接生产。
- TLS fixture支持显式metrics/块/段测量档位与已有owner借用；默认32KiB/4KiB行为保持。
- 临时负载探针/专项及隔离CLI；共享监督器仅为已通过验收收集固定schema的去敏观察文件。
- 协议/报告、Spec状态、README/index/current摘要/待办/决策及主题历史；不覆盖并行角色成果。

不新增生产监听、真实素材导入、设备/固件或外部配置操作；回退见[Spec](transport-load-spec.md)。

取消补充：共享监督器对非ESRCH终止错误记录失败，使用自有child句柄后备；私有根清理独立执行并有限重试，失败不保留观察。背景及验证见Spec补充和报告。
