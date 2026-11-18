# TCP-19 Diff（实施前）

- controls策略新增显式shared/autoRecover，channel分离共享逻辑状态与有界页面凭据/回执，提供本地detach/end；Node窗口转接，默认legacy不变。
- TCP owner内部增加按intent key的恢复handle；control loan捕获，shared维护器只在新OPEN且最新有效时复用剩余TTL reapply；不改wire/codec/固件或默认自动行为。
- core envelope增加版本化shared可选状态；共享UI挂载同步后台状态、换代清pending而不重发，保留legacy旧会话保护。
- 提取原测试fixture供新旧回归复用，新增共享/重连/撤销/期限/多页面与真实loopback验证CLI/文档/证据，更新当前摘要及归档。无新依赖或现有运行配置/服务操作。

实施状态（2026-11-05）：已完成。29专项/隔离CLI、npm run check与含build全量1784/1784通过，最终build通过；旧窗口ready/handler竞态和页面读取恢复旧提示均先复现再修复，未放宽断言。仅原创临时源/真实loopback/组件hook，浏览器、实际DSH provider和ESP待验。[报告](../../reports/2026-11-05-tcp19.md)/[API](../../protocol/native400-shared-control.md)。
