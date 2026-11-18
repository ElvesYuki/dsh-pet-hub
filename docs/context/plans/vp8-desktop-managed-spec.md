# Desktop 插件托管只读 Hub Spec

2026-11-17。只在显式开启的 macOS Electron Desktop profile 内由 Hub 插件创建日常只读 owner。复用已安装的 `ipc`、0600 授权与 USB 登记、Unix socket 选主和既有 Desktop Connection。正常启动只读取管理端私有配置，不接触 USB。只有设置页的本机授权查询才能打开登记设备并发 STATUS2。

同配置的外部 owner 已存在时附着。插件卸载仅撤销自身会话，自己选主时则等待 USB 作业退出、描述文件和 socket 回收。卸载撞上启动或快速重新启用时，先完成上一代清理。异配置和残留 socket 沿用拒绝接管。正常 DSH 退出走同一 Cordis disposer，本机不强制关闭当前桌面会话。

日常无终端启动步骤、系统登录启动项、后台辅助进程或新网络监听。启用时保留授权码、pet、旧 Web、原手动入口。需要测试挥手时，用人工 `stop → start-wave → stop`，再切换 Hub 插件启停恢复只读托管。

宿主验证关闭所有权、异配置拒绝和竞态。当前 Desktop 用插件启用、授权后单次 STATUS2、停用释放、再启用恢复验收并保持自动托管可用。真机由已授权交接限定。
