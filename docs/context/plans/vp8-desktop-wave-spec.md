# Desktop 真机挥手测试 Spec

2026-11-17。保留签名 Desktop rc.3 的既有插件和日常只读 Hub。默认 `hub-query start` 仍只接受查询。显式 `start-wave` 提供同一服务实例内一次手动挥手，装配要求已登记的 USB 身份。两入口争用原 IPC，禁止改变运行中实例的权限。

只接受 Desktop Connection owner、本地授权码和当前 instance/revision。命令体仅允许 `operation=wave` 加原实例／修订字段。原 Web 路径拒绝 wave。读取同一 USB 的新鲜 STATUS2，要求 0.1.4 已运行、空闲及无待启动槽，然后由独占 IO 发一次固定 `WAVE\n`。消费本次动作机会后不重发；断线、取消、无证据或欠帧保留未知。不开放动作号、素材、网络、OTA、重启或写入接口。

清除送出前串口输入。成功按顺序核对本次 USB request、DMA 完成后的 `FIRST 4-400`、`END 4-400 eof=1`、固件实显 `RESULT 4-400 frames=241`、DMA 完成后的 `FIRST 0-400`。开始日志、Ack 和 USB 写入均不足以判定完成。状态变更只发布白名单字段。送出后的观察窗口 20 秒。关联依赖当前独占串口内的命令顺序和回执，现有固件日志无命令 ID。

先用宿主验证正例及不完整、旧／触摸回执、并发、错身份、权限。真实设备等待独立交接，使用当前已打开的 Desktop 实测并停止临时启用的 Hub。
