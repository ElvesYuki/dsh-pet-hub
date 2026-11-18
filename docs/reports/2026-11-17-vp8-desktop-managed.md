# 签名 Desktop rc.3 插件自动托管 Hub

2026-11-17。[Spec](../context/plans/vp8-desktop-managed-spec.md) · [Diff](../context/plans/vp8-desktop-managed-diff.md)。

已打开的 DeepSeek Harness Desktop 0.2.2-rc.3 使用同一个 Hub 插件、私有 IPC 与既有授权码。仅添加 Hub 的 `vp8DesktopManaged: true` 并更新本地插件包。pet 0.4.8、授权文件、原 Web 和原手动命令保留。自动 owner 在 DSH 后端进程内运行，只绑定原 Unix socket。macOS 登录启动项和额外后台进程均未部署。

## 实测

更新插件后确认日常 Hub 自动运行，socket 由原 DSH 进程持有。首次状态为只读 idle，revision 为 0，串口无持有者。Desktop「设置 → 实体宠物设备」授权后点击一次「查询设备」。管理端确认发出 STATUS2，设置页显示 `0.1.4`／`ota_0`，没有挥手入口或写入。

在真实 Desktop 的插件面板停用 Hub，IPC 描述文件、Unix socket 均消失，USB 无持有者。再启用后，同一 DSH 进程内自动出现新实例，设置页重新显示服务已连接。新实例保持 idle、只读、未打开 USB。验收完成后保持插件启用及 Hub 自动托管。桌面进程与会话未重启。脱敏结果在 `.cache/hub-desktop-rc3-managed/proof.json`。

宿主测试用同一 disposer 覆盖退出过程、正在查询时等待独占串口关闭、快速重新启用、同配置外部实例留存、不同配置的手动挥手实例不被接管。已读取安装包中的 Desktop shutdown 路径，正常退出等待 profile fiber dispose。本轮在真桌面验证插件停用，应用退出由宿主测试覆盖。

`npm run check`、标准构建、rc.1／rc.3 候选均通过。首次全量运行的既有 Node/C++ 向量子进程触及 2 秒期限。单独复跑通过，随后原命令全量复跑通过 2,038 项，零失败、零跳过。未调整测试限时。

## 日常使用与回退

- 打开 DSH 后直接进入「设置 → 实体宠物设备」，沿用原本机授权码。Hub 随插件启用，无需手动启动命令。
- 手动挥手继续使用同一私有目录的 `hub-query stop`、`hub-query start-wave`。测试后执行 `hub-query stop`，然后在 DSH 插件面板停用并重新启用 Hub，恢复自动只读托管。
- 要回退为手动管理，先停用 Hub 插件，再移除该插件配置中的 `vp8DesktopManaged` 后重新启用。如需恢复旧插件包，使用私有 `.cache/hub-desktop-rc3-managed/profile-before/package.json` 记录的原本地包。保留登记设备、授权文件与 pet。
