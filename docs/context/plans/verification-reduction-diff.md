# 重复复验减量 Diff（实施前）

状态：已按实现前记录完成宿主切片，见[报告](../../reports/2026-10-30-verification-reduction.md)和[活动契约](../../protocol/verification-reduction.md)。生产承载/跨进程事务和物理准入不在完成范围。

- certificate-profile：实例内、用途/完整DER匹配、64条FIFO可选静态缓存，动态日期始终检查；只返回指纹的入口与缓存close/计数，不暴露内部X509。
- binding-store：仅同步栈内withReadView，惰性完整读/失败保持/clone/嵌套/finally释放；禁止视图内变更，无跨请求文件缓存或持久格式修改。
- mtls-peer/session-runtime：scoped默认装配静态缓存与一致视图；full对照/回退，不削弱peer、动态凭据和失效语义，不增加设备listener/IPC配置。
- metrics/固定TLS探针：保留full历史入口，增加静态/动态计数和相同四档负载对照、严格数值证据验证。
- 新专项负例与独立CLI；运行语法/构建/全套及正常/取消清理。
- 活动契约、报告、当前上下文/待办/决策及主题历史同步；保留并行动画与既有文件修改。

边界及回退见[Spec](verification-reduction-spec.md)。
