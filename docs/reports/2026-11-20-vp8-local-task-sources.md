# 本机任务状态来源候选

2026-11-20。设备页新增「动画联动」，可保存关闭、DSH 本机或 Codex 本机来源，以及明确的跟随会话。同一时刻只有一个来源读取与驱动设备，圆屏断开时仍可读取本机状态。选择记录保存在当前单设备私有运行目录，切换后等待旧 reader 释放再开始，并丢弃上一来源的迟到状态。[Spec 与 Diff](../context/plans/vp8-local-task-sources.md)

| 来源 | 入口与边界 |
| --- | --- |
| DSH 本机 | rc.5 的 `sessionController.state({sessionId}, signal)`，只归一化 `cursor`、运行和等待字段。无需装 pet，无会话订阅。原 pet 只读来源仅在已经配置地址的旧候选中保留为兼容选项。 |
| Codex 本机 | 连接已运行 App Server 的同用户 Unix socket。匹配的同用户 socket 别名可以使用。仅建立本机 WebSocket、初始化及 `thread/read` 元数据请求。Hub 不开启既有 Codex 的端点或读取会话存档。 |
| 播放 | 独立快照可确认工作、等待、空闲和来源不可用，工作对应现有动作 2，其他状态由设备本地策略接续。需要可靠的成功终态才能新增庆祝。原 pet 兼容路径沿用已验证的 1／2／3 映射。 |

## 验证和启用

- 已读回本机 DSH rc.5 随包服务定义。隔离 rc.5 通过真实 Cordis 和 Connection 加载，合成 `sessionController` 返回运行状态。验证默认关闭、未授权拒绝、超范围字段拒绝、来源保存和旧 revision 拒绝。宿主没有装配 pet，圆屏连接未就绪时仍读出状态。
- 已用 Codex CLI `0.167.0` 在空临时环境启动 App Server。通过真实 Unix WebSocket 与 `thread/read` 读到合成线程的空闲元数据。工具、等待、分片、ping 与取消关闭另由本机 Unix 夹具验证。现有 Codex Desktop 会话能否从明确提供的同一端点观测仍待核对。[官方 App Server 协议](https://learn.chatgpt.com/docs/app-server)
- 隔离 Chrome 验证来源初始关闭、选择 DSH、填会话并保存后的回显，以及未配置 Codex 时禁选。`npm run check`、rc.5 构建和 `npm test` 通过，2135 项通过，1 项独立 Keychain 专项未运行。
- 现场由隔离 rc.5 profile 开启 `vp8TaskMotion.enabled`，Codex 另需 `vp8TaskMotion.codexSocket` 明确指定本机端点。设备页只接受来源和会话，端点仍由宿主管理。关闭联动可以从页面保存「关闭」。禁用候选开关或恢复原包即可撤掉新增入口。日常 DSH、pet、Codex 与固件未调整。

候选在本机忽略的 `.cache/vp8-local-task-sources.BHDtk6/dsh-pet-hub-0.0.8-local-task-sources-candidate.tgz`。SHA-256 为 `f766c5559234d9db9f3a92c0845e6a5f2230eb954c703a1b478de5910ec189f5`。
