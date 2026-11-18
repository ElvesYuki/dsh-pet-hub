# 绑定与会话一致性 Diff（实现前）

状态：先行切片已于2026-10-30在临时存储/虚拟时钟/loopback实现并验证，见[报告](../../reports/2026-10-30-session-consistency.md)。以下保留实施前范围，正式服务与设备未接入。

- runtime/binding-store：单文件有界元数据、私有文件、摘要/CAS/写锁/fsync、冻结与提交不确定语义；显式register/revoke/rotate及Registry只读/映射接口。
- core/registry：当前binding代数/准入检查、可信幂等invalidate；verifyPeer附带hello供真实proof核对；不更改旧同钟/重连actual语义。
- runtime/mtls-peer：公开受信peer识别入口，验证hello与proof的完整boot/session关联，复用既有证书验证。
- runtime/session-runtime：独占会话协调、hub挑战/新session、断线/撤销/轮换/休眠统一失效、任务票据与旧回调保护。
- tests/fixtures/mtls-lab增加显式managed装配模式，原22条TLS fixture行为保留；新测试只使用临时统一存储/虚拟时钟/真实loopback。
- 专项验证CLI与既有loopback CLI提取共享隔离进程组监督器，保留既有22项入口并为本轮28项提供独立入口；临时故障子进程验证提交前后崩溃，不输出敏感数据。
- 新协议/报告、当前摘要/待办/索引/决策和替代历史，保留并行动画工作及阶段证据。

无npm依赖、生产服务/IPC/UI路由、旧配置迁移、设备或固件操作；回退见[Spec](session-consistency-spec.md)。
