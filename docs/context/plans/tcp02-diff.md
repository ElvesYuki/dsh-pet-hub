# TCP-02 Diff（实施前）

状态：本片临时宿主范围已实现，见[报告](../../reports/2026-11-04-tcp02.md)。生产/ESP/共同扩展仍未验，原实施前边界如下。

- runtime/native400-tcp：原借socket适配器补可观察的实际退出/发送忙态/进度通知，旧调用参数保持；不增加自动listener。
- runtime/native400-tcp-owner：显式临时loopback listener、单活会话与随机ID、截止/tick/PING/有界latest、退避准入、断线不重放与明确reapply、pause/resume和关闭所有权。
- tests/native400-tcp-owner、verify CLI：真实TCP/可控时钟/延迟写回调与资源负例。
- docs：API/报告/结果、当前摘要/优先级/归档。TCP七消息、core与固件/素材/现有服务/依赖保持；不接DSH写路由或生产listener。
