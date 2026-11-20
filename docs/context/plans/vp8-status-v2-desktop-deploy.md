# Status v2 日常 DSH 换包 Spec 与 Diff

2026-11-19。用户已授权在现有日常 DSH Desktop 替换 Hub。当前圆屏仍为 0.1.30。只换 Hub 的同名 rc.5 单包，维持默认旧版 USB 查询。Status v2 随包提供，部署不写入 vp8StatusV2 开关，不启用设备 TCP 监听。继续使用当前桌面 profile 和窗口。

| 范围 | 变更 |
| --- | --- |
| 插件文件 | 用已经过 2119 项全量回归和独立 Keychain 测试的 Status v2 tarball 替换同名 Hub。版本仍为 0.0.8，按 tarball 摘要和安装文件核对。 |
| Profile | 由 rc.5 自带 CLI 更新本地包、依赖来源和锁文件。原 Hub patch、登记与 Keychain、其他插件配置与内容继续沿用。 |
| 验收 | 整体私有备份，临时 profile 离线预演，再执行原 profile 更新。核对新模块、包加载、唯一设备设置入口和旧 USB 模式。 |
| 回退 | 用原 tarball 和相同离线 CLI 恢复 Hub，核对原配置。若部分失败且 CLI 无法恢复，使用本轮安装前私有快照恢复受影响的 profile 文件，先排空该插件相关请求。 |
