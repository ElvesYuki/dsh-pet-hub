# 签名 DSH Desktop rc.3 只读设备查询 Diff

2026-11-17。

- 为 Connection 候选提供可选的只读 VP8 查询路由，复用 Hub UDS 授权和最小投影。新桌面配置与原 Web 控制配置显式分开。
- Hub 增加只读门禁和状态字段。共享设置页在该模式只显示查询，保留其他宿主行为。
- 构建候选保留历史摘要。夹具覆盖鉴权、实例和 revision、非查询拒绝。实际签名进程用临时 home/profile 跑 fixture，再按固件交接执行一次真实 STATUS2。
- 回退停止临时实例和 Hub，释放串口后删除临时数据。既有服务和默认 profile 无迁移。

用户随后明确指定在已打开的签名客户端安装。实际安装只变更该 Desktop profile 的 Hub 依赖、bundle 和只读配置；先备份 package、lock 和 Cordis 文件。复用已运行的 App 热加载，查询夹具和设备 owner 仍独立。保留已装插件，停止本轮 Hub 与调试实例；回退只移除本次 Hub 差异。
