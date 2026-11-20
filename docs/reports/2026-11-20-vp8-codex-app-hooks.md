# Codex App 项目级 Hooks 候选

2026-11-20。管理端「动画联动」增加 Codex App 项目级状态入口。指定的项目 Hook 通过私有 Unix socket 发送会话 ID、回合 ID、事件、时间，以及配对工具事件所需的调用 ID。Hub 只接收当前选择的一条会话。聊天正文、工具参数、结果、错误文本和路径不进入 Hub。Hook 永远返回空决定，审批继续在 App 内处理。[Spec 与 Diff](../context/plans/vp8-codex-app-hooks.md) · [官方 Hooks](https://learn.chatgpt.com/docs/hooks)

| 状态 | 随包引擎的实际证据 |
| --- | --- |
| 思考 | 隔离项目提交请求后，模型尚未返回时进入思考 |
| 工作、整理 | 一次实际的无副作用终端调用开始与返回，Hub 分别收到两档 |
| 等待审批 | 实际 `PermissionRequest` 和应用服务的审批请求一致，拒绝后回空闲 |
| 空闲 | 正常结束、模型请求失败以及主动中断均回空闲 |
| 任务完成与出错 | Hook 模式保留空闲。`Stop`、单次工具结果和模型尝试结果都缺少明确回合终态。已有 App Server 模式可读 `completed`／`failed` |

已有 App Server 路径和 DSH 的完整六档结果仍可复核。[此前的状态投影验收](2026-11-20-vp8-local-task-phases.md)

### 验证范围

- 使用当前 App 所带的 Codex `0.169.1`，为临时项目发现 8 个 Hook，并在独立 `CODEX_HOME` 按实际定义的哈希完成信任，未跳过检查。模型请求由本机模拟提供，工具与审批事件由随包引擎真实执行。另验证模型请求失败可及时结束活动，同时避免判为任务失败。结束后关闭监听和进程，清理临时目录。
- Node 专项覆盖脱敏、并行工具、审批等待、旧会话／旧回合、部分输入、占用端点、后台状态过期、模型重试和断开。隔离 DSH rc.5 候选在真实 Cordis 和 Connection 里核对来源保存、DSH → Codex → DSH、状态回显以及 Unix 端点释放。
- `npm run check`、`npm test` 和 rc.5 候选构建通过。2130 项通过，0 项失败，9 项依赖外置向量、VPL1 对端或 macOS Keychain 的测试未运行。已核对候选包含 Hook 运行模块。
- 桌面自动化工具禁止访问当前 Codex App 窗口，故 App 界面里的 Hook 审阅、App 重启、Worktree 和日常会话仍待验。圆屏首帧也留在设备阶段。

### 隔离桌面验收与回退

1. 选用独立的私有临时目录，在其中用 `git init` 准备空的 Local 项目，另留单独的私有 socket 目录。运行 `node scripts/prepare-vp8-codex-hooks.mjs prepare <项目绝对路径> <socket绝对路径>` 会生成项目级 Hook 文件，已有文件会保留。准备命令使用当前 Node 路径，App 运行时无需安装额外 Codex CLI。
2. 在当前 Codex App 打开该临时项目，在「Review hooks」或「Settings → Hooks」审阅并信任该项目的 Hook。隔离 DSH rc.5 profile 开启 `vp8TaskMotion.enabled`，设置该 `codexHookSocket`。`codexSocket` 与它互斥。打开设备页「动画联动」，选择 Codex 及该测试会话，提交第一条测试任务后即开始显示状态。DSH 可在同页切回。未装配真实设备时也可读取状态。
3. 用一次普通工具、一次需要人工确认的命令及一次主动停止核对回显。操作另一个会话时，原选择不应跟随。重开 App 需由新回合重新建立观测。先验证桌面状态，再接圆屏查首帧回执。
4. 退出时保存「关闭」，停掉隔离宿主并移除临时项目 Hook。需要回退候选时恢复上一份包。上面的隔离验证阶段保持日常 DSH、pet、Codex、桥接、固件和设备现状。

本机构建产物为忽略目录下的 `.cache/vp8-app-hooks.fUJDvY/dsh-pet-hub-0.0.8-codex-app-hooks-candidate.tgz`，SHA-256 为 `2433a128aee539960b8bb42bf8e252fef48ad0f73e0b3d3c20ac7c68dbea0b39`。

### 日常 DSH 换装

用户授权在原日常 DSH `0.2.2-rc.5` 的 `desktop` profile 安装上述包。通过同一 CLI 在复制的 profile 预演换包和回退，然后在日常 profile 离线替换。实际 Electron loader 和 Hub schema 核对候选、原主动上报配置及「关闭」初始来源。原 `dsh-pet` 清单与备份一致。

准备期间原窗口的 Hub 开关由启用变为关闭，安装采用最新快照保留关闭。刷新后，插件详情显示 `0.0.8` 与 `dsh-pet-hub-0.0.8-codex-app-hooks-candidate.tgz`。用户随后选择启用 Hub。原窗口确认组件「运行中」。设备页显示「TCP 实时状态」、已核对的持久绑定和「联动已关闭」，读回 `0.1.38-l-battery-usb-pair-test`／`ota_1`。本次对该固件只观察状态。Codex 端点无配置，固件及其他插件未改。[换包 Spec 与 Diff](../context/plans/vp8-codex-app-hooks-desktop-deploy.md)

上一份 `dsh-pet-hub-0.0.8-active-status-candidate.tgz`、安装前 profile 及已安装 Hub 的私有快照保存在忽略目录下的 `.cache/vp8-codex-app-hooks-daily.KoonI2/rollback/`。需要回退时用 DSH 自带 CLI 离线重装原包并恢复原 `cordis.patch.yml`，再刷新原窗口核对包来源和当时选定的开关。

换包后 `npm run check` 与全量回归通过，2130 项通过、9 项外部夹具跳过。首轮回归继承私有备份的文件权限掩码，导致依赖公开测试文件的负例失效。恢复常规掩码后重跑全套。
