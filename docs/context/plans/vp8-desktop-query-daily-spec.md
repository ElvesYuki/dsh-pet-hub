# Desktop VP8 日常只读查询 Spec

2026-11-17。复用已加载的签名 Desktop rc.3、Connection owner 授权、现有 Hub IPC 和 STATUS2。私有安装目录与 IPC 持久化，启动前无需设备在线。用户在终端显式运行 `hub-query start`，前台运行；另一终端可执行 `status`、`stop`、`copy-code`。重复启动走现有 UDS 选主，禁止接管残留或陌生实例。停止走本地 IPC 的双凭据与实例校验，等 owner 关闭串口和移除 IPC 后才报告停服。程序不注册启动项。

私有目录 0700，配置 0600，授权码由系统随机源生成，不输出到终端或日志。使用者主动执行 `copy-code` 时复制到系统剪贴板。只读配置仅包含授权码和从 ioreg 登记的指定 USB 设备路径与身份。以显式 `select-device` 登记，查询前后核对同一身份，拔出或换设备时安全失败；不改固件绑定、Wi-Fi、pet 或素材状态。只读路径既无网络配置也无升级对象。串口错误按阶段脱敏记录。

先用宿主夹具核对并发启动、拒绝停止与写入、停服和权限。实际 Desktop 只调整既有 Hub 的 runtimeDirectory，保留插件和 profile 其余字段。真机仅在固件侧交接后通过设置页显式查一次，确认 STATUS2 回执、停止及 USB 释放。
