# TCP23 Diff（实施前）

- 新opaque HTTP hold-source与不可重建采样收据、有限观察代/时钟/关闭检查。
- shared私有view新增可选versioned limits，按真实lane提供source_window_ms；旧event view兼容，hold缺失拒绝。
- 原bridge显式hold策略及所有权/期限/freshness/priority/unknown恢复门禁，默认event不改。
- 有界只读观察CLI、genuine临时宿主正负测试/监督CLI、报告/候选证据/上下文归档。
- 不新增DSH会话监听、不改固件、运行配置或上游素材；新代码MIT、零依赖。

实施状态：代码/宿主合同已完成。24专项/隔离CLI、默认event20项定向、check及含构建全量1848/1848、标准与独立候选build通过；真实15秒观察无自然迁移，运行加载版本/真实priority provider仍待。见[报告](../../reports/2026-11-06-tcp23.md)。
