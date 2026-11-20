# DSH 与 Codex App 本机状态验收

2026-11-20。设备页「动画联动」沿用已验证的来源选择和保存，DSH 和 Codex 统一回显六档，另有空闲与来源不可用。DSH 独立读宿主 `sessionController.state` 与有界 `events`，无需安装 pet。Codex 读取显式指定的同用户 Unix 端点。核心、来源适配和界面继续独立，已配置的 pet 来源仍可选。[Spec 与 Diff](../context/plans/vp8-local-task-phases.md)

| 界面状态 | DSH 的判定 | Codex 的判定 | 验收证据 |
| --- | --- | --- | --- |
| 思考 | 回合已开始，尚无工具活动 | 回合进行中，尚无工具活动 | 两个应用随包引擎 |
| 工作中 | 工具调用尚未完成 | 工具正在执行 | DSH 随包控制器与 Codex 回环夹具 |
| 整理 | 工具全部返回，回合仍在进行 | 工具已返回，回合仍在进行 | DSH 随包控制器与 Codex 回环夹具 |
| 等待输入 | 存在当前会话输入请求 | 当前会话等待审批或输入 | DSH 随包控制器与 Codex 回环夹具 |
| 已完成 | 已观察的回合正常完成，排除自动续跑的中间轮 | 已观察的回合返回 `completed` | 两个应用随包引擎 |
| 出错 | 已观察的回合报错、超时或达到 token 上限 | 已观察的回合返回 `failed` | 两个应用随包引擎 |

完成与出错停留 5 秒。取消回空闲。只对当前会话、已观察的回合和当前设备连接上的新边沿触发庆祝。沿用思考 1、工作与整理 2、完成 3，等待与出错在管理页区分，其余由设备本地策略接续。设备实际首帧仍待验。

## 本机证据

- DSH `0.2.2-rc.5` 的随包状态与历史控制器在隔离环境接收合成事件，通过六档与空闲。真实 Cordis 候选的权限校验、来源保存及未经授权请求拒绝纳入回归。未订阅第二份会话流。
- 当前安装的 ChatGPT 桌面 App `26.1111.71704` 随包 Codex `0.169.1` 在空临时目录启动隔离 App Server。真实 Unix WebSocket + 本地合成模型服务读到空闲、思考、成功和失败。本机 Unix 回环夹具另跑完整六档、重连及旧回合隔离。没有调用线上模型或访问原会话内容。[App Server 协议](https://learn.chatgpt.com/docs/app-server)
- `npm run check`、rc.5 候选构建和 `npm test` 通过。2137 项通过、0 项失败，1 项独立 macOS Keychain 测试未运行。候选包已核对包含状态投影和来源设置模块。

## Codex App 边界与下一步

Hub 运行时直接连接已配置的 Unix 端点，无需安装独立 CLI。当前打开的 Codex App 未发现供 Hub 接入的公开控制 socket，已有会话尚未实读。先在隔离桌面项目核对 Local／Worktree 的公开入口，若仍不暴露 Unix 端点，验证经过 App 审阅授权的生命周期 Hooks 能否只转发状态元数据。单个 `Stop` 事件不足以证实成功，审批等待和失败终态也需各自验证；本轮未启用 Hooks。云端会话及跨设备同步未纳入。[Codex 运行模式](https://learn.chatgpt.com/docs/environments/modes) · [官方 Hooks 机制](https://learn.chatgpt.com/docs/hooks)

## 候选与回退

候选位于忽略目录 `.cache/vp8-task-phases.ODNevz/dsh-pet-hub-0.0.8-task-phases-candidate.tgz`，SHA-256 为 `3522033347c99f8fdce0d57d77d4be15ec74b890c6e00fa2546853a36a050010`。

隔离 profile 可在页面保存「关闭」，或禁用 `vp8TaskMotion.enabled`。需撤回候选时恢复上一份包和 profile 备份。日常 DSH 继续使用 `0.0.8` 主动状态包。本轮未调整日常 DSH、Codex、pet、桥接、固件或设备。[原日常包与回退方案](2026-11-20-vp8-0133-live.md#日常换装与回退)
