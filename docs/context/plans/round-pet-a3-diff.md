# A3 Diff（实现前）

状态：离线候选已完成，见[46专项/515全套报告](../../reports/2026-10-30-round-pet-a3.md)和[活动API](../../protocol/round-pet-a3.md)；共同wire/实体门槛未关闭。

- 新core观察reducer与严格候选记录验证：四流分离、context/target/package关联、受信回调、root/刷新高水位、查询/操作容量及历史/当前区分。
- 新runtime review描述/公共投影校验；service仅内部显式工厂、赢家创建/close释放、GET status候选字段；默认无新装配。
- 新UI只读观察区与白名单view；既有宿主status代理增加候选summary白名单，build加入纯UI模块。不新增client写方法、CLI/Config开关或设备listener。
- 新原创golden、模拟proof与专项/隔离CLI；不改旧Registry/DeviceModel、A1/A2、现有认证/调度。
- 更新活动协议/报告/基线差异/当前摘要/待办/主题历史；未决wire不标生产完成。

依赖、验证与回退见[Spec](round-pet-a3-spec.md)。
