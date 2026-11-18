# 绑定权威与会话一致性演进

2026-10-30。替代当前“统一持久绑定/撤销、hello挑战与注入休眠失效尚未实现”的片段；生产服务装配、真实OS事件/可信时间/密钥存储及设备门槛仍有效。原loopback22项和离线认证证据保留，当前结论见[报告](../../reports/2026-10-30-session-consistency.md)。

## 原系统当前片段

下列原文内部链接沿用原文件位置，证据统一从上方报告进入。

```text
2026-10-30独立loopback mTLS：check（仅.mjs语法）及test（含构建）全套308项通过，含本轮22条真实HTTPS互操作及原离线认证12条回归；合计也包含并行角色导出新增16条。固定TLS1.2/P-256/ECDHE-ECDSA-AES128-GCM-SHA256，实际peer证书→指纹绑定/credential_epoch→固定完整context→opaque peer proof进入Registry，真实TLS上的严格TTL回执→receipt proof进入lease guard。同连接复用/新连接重认证、撤销/凭据轮换/可信时间丢失、过大/旧context报文、三段合成素材及异常响应验证通过。见[报告](../reports/2026-10-30-loopback-mtls.md)、[契约](../protocol/loopback-mtls.md)、[被替代摘要](history/loopback-mtls-evolution.md)。

测试仅创建literal loopback动态listener、临时Agent/PKI；正常与SIGTERM取消后清理通过，所有本轮listener/socket/request/timer和认证会话已关闭。正式服务仍deviceTransport=false，无生产listener/凭据存储或ESP接入；TLS成功不代表设备绑定/Flash事务或现行v5管理租约已支持。系统休眠自动失效、统一持久绑定/撤销权威、真实hello挑战与生产协议装配仍待实现，NO_GO_UNTIL_MEASURED保持。

```

## 原下一入口

```text
1. **生产会话生命周期与撤销权威**：独立loopback真实peer→绑定→Registry/guard、撤销及Range互操作已完成，见[报告](../reports/2026-10-30-loopback-mtls.md)，不重复握手原型。下一先补Spec/Diff统一绑定/凭据记录的权威与持久CAS、主动撤销/断线/休眠恢复时auth+guard+Registry的失效顺序、hub生成新session与hello挑战、服务实例隔离和过期异步保护。继续离线/临时验证，不自动开放生产listener；1900ms/500ppm不作实物准入。
```

原308项为loopback阶段，后续并行角色加载12项和本轮28项在本轮组成348项。只统一临时元数据与会话owner，不把元数据持久化当成设备配对、密钥存储或持久撤销确认。
