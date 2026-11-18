# 400-01 Diff（实现前）

- 新增独立400离线身份profile/整数recipe、候选N与P/M/I/source分域，不改360常量或设备wire/能力。
- 新core候选转换/metadata/独立approval与runtime严格源/record/全媒体验证策略；真实库仅只读算候选，不建立批准或导入。
- A2 importer/worker按显式可信profile选择策略，默认360/旧record保持，复用同仓库/生命周期/逐blob证明/失败和实际退出，不另建CAS或认证栈。
- 新原创78描述/241与118帧/extra tag0 fixture、golden、30专项及独立临时CLI；check/test后更新摘要/C表与归档。
- 400-02能力与执行、400-03新wire及400-04生产装配均不在本轮，回退和外部禁止项见[Spec](native400-01-spec.md)。

实施状态（2026-11-02）：本轮离线身份/recipe/400主入口已实现，30专项、独立临时CLI与check/全套970通过；真实候选P/M/N已只读核定，无真实批准/导入，正式N/设备仍待共同确认。见[报告](../../reports/2026-11-02-native400-01.md)，当前摘要/C表已更新，旧缺口已归档。
