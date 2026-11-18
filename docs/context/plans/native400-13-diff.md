# 400-13 Diff（先行范围，实施后核定）

- runtime/native400-review-controller：独立拥有原owner、会话/选择/任务容量、一次消费/seq高水位ACK去重、定向取消、动态时钟/期限与退出；复用400-12 selector和原事务。
- runtime/native400-review-manager：每任务可选authorizationGate，严格同步Boolean/防重入修改，复用原valid检查提交/发布；unknown优先，缺省保持。
- core/native400-review-controls-view：独立无Node/DOM的允许字段投影，不暴露选择token/源路径/批准正文，不伪造设备事实。
- core/native400-source-review-view：只增加安全授权错误枚举，旧view schema保持。
- tests/native400-13与verify CLI：原创临时文件/虚拟clock、受控timer/真实持久切点与资源负例；无真实源/设备或新服务路由。
- docs protocol/report/context/history：写清已实现、未覆盖/400-14边界与回退，归档被替代入口。

不改service/profile/CLI/IPC/代理/UI、400-03 wire/golden、400-07、selector/reader/journal格式/原逻辑、依赖或旧尺寸；不改固件/pet/bridge/DSH，不新增设备listener或原生picker。

2026-11-03核定：333条原源SHA保持、2修改/4新增；45专项/监督CLI/check/含构建1353通过，见[报告](../../reports/2026-11-03-native400-13.md)。source selector/reader/journal和service/profile/IPC/代理/UI保持，真实宿主身份/交互仍待400-14。
