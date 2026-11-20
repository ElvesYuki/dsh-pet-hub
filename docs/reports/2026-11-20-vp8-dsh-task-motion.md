# DSH 工作状态驱动圆屏候选

2026-11-20。候选复用 `0.1.33` 的 VPL1 mode 3 认证连接和 type 17 VPC1 Play。每个请求保留原有会话、请求序号和角色／动作票据。Accepted 表示设备已接收，Presented 表示首帧完成显示提交。固件继续负责触摸、专注等本地优先级。[Spec 与 Diff](../context/plans/vp8-dsh-task-motion.md)

- 只读已安装 pet 0.4.9 的 `GET /dsh-pet-7340/state`。其宿主 Cordis 服务没有 `getState`，页面服务有同名只读方法，候选在后台运行。pet 自带的宿主监听生成状态，Hub 未订阅 DSH 会话事件。
- 已固定角色 0。思考发动作 1，工作和工具结果合并为动作 2，符合资格的完成发动作 3 一次。等待不发动作，空闲和失败回本地策略。每次 Play 为 1500 ms 消费窗。重连、首次读取、来源故障或轮询期间更换连接均重新取基线。连接专用 Play 无离线排队及自动重放。
- 公开状态只提供 pet 聚合选中的会话，当前候选要求显式钉住一条会话作联调。其他会话遮蔽目标时放弃该段链路的完成资格。窗口焦点与更细的 turn ID 仍缺公开来源。短于轮询周期的阶段可能未被观察到。

## 证据与入口

- 原样加载已安装的 pet 0.4.9 编译宿主，在独立 DSH 数据目录以合成的 `turn/start`、`tool/call`、`approval/asked` 和 `turn/end` 触发上游原监听。通过它真实注册的公开 GET 验证归属、过滤背景会话、等待及 1／2／3 边沿。隔离夹具使用事件总线，未执行真实模型任务。
- `tests/vp8-task-motion.test.mjs` 核对外部槽、同态、来源故障、计数回退、完成和晚回执。`tests/vp8-vpl1.test.mjs` 接临时公开状态 HTTP 与固件 C++ mode 3 真实 TCP，收到 1／2／3 的首帧回执。重连时完成不重播，C++ 统计为两个会话、三次显示提交。旧 VPC1 TTL 重连语义继续通过原回归。
- 分别配置隔离 `desktop` 的 `vp8TaskMotion.enabled`、`source` 和 `sessionId`。`source` 为试验宿主已有 pet 的 loopback URL，使用 `/dsh-pet-7340` 基路径。`sessionId` 只填本次验收指定的 DSH 会话。候选还需现有 USB 登记、Status v2、USB 主动上报及 LAN mode 3 均有效。联调时先确认同一板只有一个具备 USB／TCP 控制权的宿主。通过有较清楚间隔的实际任务检查思考、工作、完成三档并捕获对应票据，然后核对本地触摸、过期和断线。关闭 `vp8TaskMotion.enabled` 或退出隔离宿主即停止联动。

`npm run check`、全量 `npm test`、rc.5 单包构建和 `git diff --check` 通过。2132 项通过，1 项独立 Keychain 测试跳过。会话投影独立于老客户端构建，历史完整性门禁仍通过。

候选包保存在本机忽略的 `.cache/vp8-dsh-task-motion.4KipZI/dsh-pet-hub-0.0.8-task-motion-candidate.tgz`，SHA-256 为 `08346699734cd37246fdd6e53f2e54406c50e5e0f56f33446a1c5c39dd0e2855`。同目录的 `installed-pet.mjs` 及日志记录已安装编译模块的隔离测试。

日常已部署的 `0.1.33` 状态包、运行配置和圆屏固件保持原状。本切片待隔离真机任务与显示回执验收。
