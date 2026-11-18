# VP8 Desktop USB 电池查询 Diff

- 提取现有 VP8 有界串口行缓冲与 USB 身份确认供 STATUS2 和 BATTERY1 共用。
- 合并 Desktop owner 装配限流和取消，使用现有 Connection 权限发布仅电池的命令和能力信号。
- 合并页单独调度电池，按 USB 归属投影。退出取消，过时值和断开分别呈现。
- 回归实际 tarball、模拟独占 USB 及页面生命周期。只打包主插件，不更换现场插件、配置或固件。
- 0.0.4 对齐合并包 `main` 和包根导出。从解包后的包名进入 rc.3 宿主装配，回归临时 Unix socket 的状态、路由及卸载。普通构建继续使用 `host-022.mjs`。
