# Codex App Hooks 日常 DSH 换包 Spec 与 Diff

将已验证的 Hub `0.0.8` Hooks 包装入当前 DSH `0.2.2-rc.5` 日常 `desktop`。上一份主动状态包及 profile 清单、锁文件、补丁和旧 Hub 文件保留为私有回退。通过包来源和 SHA-256 区分同版本构建。先在复制的 profile 离线预演，按原窗口插件详情和设备页核对实际加载。

仅更新 Hub tarball 和其配置中的 `vp8TaskMotion.enabled`，用于显示「动画联动」设置。联动从「关闭」开始。Codex 尚无获准的日常端点，保留「未配置」。保持设备主动状态、绑定、运行路径和其他插件的原配置。此次不选择任务来源、创建 Hook 权限或触发设备动作。

验收核对实际 rc.5 loader 和 Hub schema、候选包文件、旧版 pet 清单、原窗口的插件来源与运行状态。在 Hub 启用时再核对设备状态和联动关闭。如果预演期间用户窗口的启用状态发生变化，先以最新 profile 备份为基准保留该状态。未经验收的 Codex App 活动及设备首帧各自留在后续联调。出错时用同一离线 DSH CLI 安装上一份主动状态包并恢复原 Hub patch，重新核对设备页和 profile。私有文件快照供 CLI 恢复失败时使用。
