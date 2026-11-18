# 独立loopback mTLS Diff（实施前）

状态：先行方案已在2026-10-30实施并验证，见[报告](../../reports/2026-10-30-loopback-mtls.md)。下文保留执行前范围，正式服务/ESP未接入。

- runtime/certificate-profile提取共享受限根/叶校验；offline-lease-auth复用，保留原签名工具契约和回归。
- core/lease-wire公开完整context校验供两个受信适配器复用，不改wire版本或预算算法。
- runtime/mtls-peer新增真实TLSSocket授权、指纹绑定、固定会话、逐次重验、opaque peer/receipt proof及撤销/关闭；无默认监听/服务装配。
- runtime/asset-segment新增单Range及响应边界校验，固定32KiB，不读磁盘/任意URL。
- tests/fixtures独立HTTPS server/Agent/临时PKI及合成资产，白名单路由、deadline、容量及清理；tests/loopback-mtls执行真实握手/绑定/撤销/分段负测。
- verify-loopback-mtls CLI只运行独立有界测试子进程、写去敏摘要到显式忽略目录，不保存端口/证书/私钥或原始报文。
- 协议/报告记录实际通过项与剩余门槛；更新README/index/current-system/current-todos/decisions，并归档被替代段落。

回退按[Spec](loopback-mtls-spec.md)先关本轮socket/Agent/server、清私有PKI；无安装、配置迁移、固件改动或对现有服务的操作。
