# 离线认证与v5期限 Diff（实施前）

状态：先行文档对应的离线切片已实施并验证（2026-10-30），见[报告](../../reports/2026-10-30-offline-auth-v5.md)。保留以下实施前范围供追溯；没有TLS握手/监听或固件改动。

- runtime/offline-lease-auth：显式CA/绑定映射、真实密码学挑战/报文验证与guard opaque proof，无网络。
- core/lease-wire：4KiB canonical JSON管理候选编码/解码；不传绝对到期字段。
- core/lease-budget、registry：相对grant可缺expires_at，同钟保持原要求；无默认运行装配。
- simulator/lease-delay：轮询/不可抢占分段/排队/网络/处理分解与保守RTT核对。
- 临时PKI fixture、负例/端到端测试及CLI，协议/证据/当前摘要/归档。

不修改现有服务配置、不将离线挑战协议当成部署mTLS，不引入新依赖。
