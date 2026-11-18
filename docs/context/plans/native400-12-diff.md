# 400-12 Diff（先行范围，实施后核定）

- runtime/native400-source-selection：共享私有文件指纹/稳定检查、元数据选择工厂、opaque引用/单调期限与撤销、任务级绑定；无内容读取或第二套reader。
- runtime/native400-bootstrap-review：原指纹提取复用；可选expectedSource、open后首读前比较与任务内选择有效性检查，增加供manager同步门禁检查的方法；旧读验与recipe保持。
- runtime/native400-review-manager：可选绑定透传，读后/持久valid/发布前检查撤销，选择错误稳定映射，unknown优先；不改journal事务/schema。
- core/native400-source-review-view：仅允许新的安全选择错误枚举；view字段/渲染不变。
- tests/native400-12与verify CLI：原创临时文件的选择/替换/撤销/时钟/资源与兼容对照，不读取外部状态或素材。
- protocol/report/context/history/许可边界：同步实际API/验证/限制，归档被替代入口；400-11整体控制设计仍非已实现。

不改依赖、固件、pet/bridge/DSH、service/profile/IPC/代理/UI、400-03合同/golden、400-07调度、journal格式和旧尺寸；不实现400-13授权/定向取消/去重或400-14交互。

2026-11-03核定：329条原源SHA保持、3修改/3新增，35专项/监督CLI/check/含构建1308通过；仅内部选择与提交前撤销检查，完整控制器/授权gate和交互未扩入，见[报告](../../reports/2026-11-03-native400-12.md)。
