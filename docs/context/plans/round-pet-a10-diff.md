# A10 Diff（实现前）

- binding-store私有load结果携带已验证digest，reduced复用它做原revision检查；noop只在锁内完整验证/CAS/全内容匹配后跳过编码。保留full，v1/持久格式/TTL不变。
- 可选metrics增4个固定数值计数，无原始数据/缓存/新公开管理接口。
- 既有A9 fixture/CLI显式full，新A10复用相同四档采样作同次full/reduced对照及严格证据校验；新增边界负例，保持706基线。
- 更新API/报告/当前摘要/待办/差异/交接，归档A9减量待办；不触碰固件/pet/bridge/DSH。

详细不变量、证据与回退见[Spec](round-pet-a10-spec.md)。

实施状态（2026-10-30）：按本Spec/Diff实现，24专项/730全套、独立CLI同次新鲜full/reduced对照与SIGTERM清理通过。见[报告](../../reports/2026-10-30-round-pet-a10.md)和[API](../../protocol/round-pet-a10.md)，原A9摘要/减量待办已[归档](../history/round-pet-a10-evolution.md)。局部切片闭合；共同G0/真实包批准、可信恢复/实体资源与窗口仍待完成。
