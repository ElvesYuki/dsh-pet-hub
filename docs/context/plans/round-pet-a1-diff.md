# A1资源执行模型 Diff（实施前）

状态：已按实现前记录完成纯core切片，见[35专项/434全套报告](../../reports/2026-10-30-round-pet-a1.md)与[活动API](../../protocol/round-pet-a1.md)。仅资源模型，不关闭联合G0或设备准入。

- 新core/native360-profile：固定能力、namespace、资产/验证详情约束；不改通用schema2 parser或旧DeviceModel。
- 新core/native360-flash：双root/对象引用、4＋1、暂存/取消/不确定提交/恢复、保护与read lease、单owner的纯同步模型。
- 新core/native360-device：单RAM/Flash stream、工作与刷新票据、显式首帧、保存与库存/维护投影，供受信离线装配调用。
- 新simulator原生Flash内存介质和原创fixture/专项；现有schema1/认证/素材/服务回归保持，零依赖。
- 新活动契约/报告；上下文/基线差异/待办与主题历史更新，只替代“所有Flash执行模型均未实现”，实体通道/固件/wire仍待验。

本轮不改runtime/UI/插件、固件/设备或服务配置；完整边界/故障/回退见[Spec](round-pet-a1-spec.md)。
