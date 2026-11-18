# A5 Diff（实现前）

- 新runtime CAS reader/装配owner；strict worker输出同fd验证指纹，material-store仅内部ready转交，不进公开状态。
- managed-sessions仅提供内部同步readView给同owner装配，复用既有生命周期/scoped，不重做认证。
- A4新增受信onOpen/操作准入hook和候选save可选victim字段；默认旧A4行为保持。A5在入队/派发执行初始库存/verified/保护与uncertain门禁。
- service内部显式选主装配/异步status/lifecycle，宿主/共享UI增加只读装配状态；无页面控制/自动TCP listener/CLI配置。
- 新原创集成fixture/专项/隔离CLI；复用原mock peer，真实listener只在临时loopback fixture创建。
- 更新活动合同、报告、当前摘要/待办/差异与主题归档，不改固件/pet/bridge/DSH。

范围、失败、验证与回退见[Spec](round-pet-a5-spec.md)。

实施状态（2026-10-30）：本Spec/Diff先于代码建立；范围内41项离线专项及604全套通过，正常/中断清理已验，详见[报告](../../reports/2026-10-30-round-pet-a5.md)和[活动API](../../protocol/round-pet-a5.md)。保留上述生产/设备/共同G0与G1/G2限制。
