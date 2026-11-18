# Desktop VP8 日常只读查询 Diff

2026-11-17。

- 新增窄范围手动入口和私有配置，复用 query-only owner 和原 UDS 凭据。普通 VP8 与 Web 继续原有契约。
- 只读 USB 每次校验登记身份，查询与审批后的停止分别使用窄范围 IPC。补齐配置权限、串口失败阶段、重复启动和退出用例。
- 在用户私有目录安装已构建副本和手动命令，现有 DSH patch 只替换 Hub runtimeDirectory。无自动启动和新增生产网络监听。
- 回退时手动停止，恢复 Hub 原 runtimeDirectory，保留原插件和 pet。私有目录保留到备份确认后由使用者决定是否删除。
