# A7 Diff（实现前）

- A1增加受信会话边界，不用reboot重置命令revision；不放宽旧target或Flash事务。
- 新core根检查点严格codec/维护评审；A3恢复floor/最后完整根，默认库存unknown，旧根/同seq冲突继续拒绝。
- A4/A5仅内部可选checkpoint与导出/选主匹配，失败原因保留，无公共写入/清floor/生产持久化入口。
- simulator/fixture绑定完整context，支持同一actor/medium不重启的真实TLS/新hub owner；新增离线专项与监督CLI。
- 更新协议/交接/当前摘要与待办，将A6未决描述按主题归档；历史报告保持原证据。

边界、验收、失败与回退见[Spec](round-pet-a7-spec.md)。

实施状态（2026-10-30）：本Spec/Diff先于代码建立；24专项、658全套及独立CLI正常/中断清理通过，见[报告](../../reports/2026-10-30-round-pet-a7.md)和[API](../../protocol/round-pet-a7.md)。被替代摘要已[归档](../history/round-pet-a7-evolution.md)。生产权威持久化/防回滚、共同wire/真实包及G1/G2/实体窗口仍未关闭。
