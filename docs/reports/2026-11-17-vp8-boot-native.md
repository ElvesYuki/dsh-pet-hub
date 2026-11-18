# VP8 BOOT 原生适配与真机交接

2026-11-17。[Spec](../context/plans/vp8-boot-native-spec.md) · [Diff](../context/plans/vp8-boot-native-diff.md) · [字节契约](../protocol/vp8-boot-usb-proposal.md)。

## 已验证范围

| 层 | 结果 |
| --- | --- |
| macOS Keychain | 实际 Security.framework 创建独立文件 Keychain，P-256 私钥在 helper 进程重开后仍能签名，并由 Node 验签。测试前后用户的默认搜索列表一致。普通沙盒内创建返回 OSStatus -25294，经受审的系统上下文通过。一轮完整验证未弹授权框。使用显式 Keychain 和搜索列表的接口依据见 [Apple TN3137](https://developer.apple.com/documentation/technotes/tn3137-on-mac-keychains)。 |
| USB 替身 | 走真实 macOS PTY、raw/nonblocking、`flock`／`TIOCEXCL`、短帧拼接和关闭重开。端口换节点及 USB identity 前后失配由夹具注入。C++ 使用固件实际 Session，隔离夹具模拟 NVS 和 BOOT 短按。 |
| 原生端到端 | Keychain 签出首绑 P-256 提议，夹具记录首绑请求 `6 → 7 → 8 → 10`。重开管理端后本地为 `bound`，本次设备核对为 false。显式 `verify` 重新拿到 TTY，且只发 `6 → 10`，核对 type 133 的整组持久身份与原 Keychain 公钥摘要后才标记已核对。`health` 单独读取时仍报告未核对设备。 |
| rc.3 | 实际签名 rc.3 在独立 `DSH_HOME`／`userData` 初始化，并由同版本 CLI 安装单独的候选包。源码确认 Electron 转发以及 Connection 构造 `http://dsh.internal` Request 的边界，候选路由夹具验证未授权 401、实例修订及卸载。按用户随后指示已关闭临时实例，只检查已打开的日常 DSH，看到原有 Hub。候选设置页的实际 renderer 点击和实际 rc.3 cookie 端到端仍待验。 |
| 真板 | 本轮未打开真板串口，也未烧录。USB 真机 IOKit 身份、按键、NVS 以及重插后复验由设备任务负责。板上 0.1.4 和回退由固件任务保留。 |

`npm run check`、构建及全量 `npm test` 通过，2,055 项通过，无跳过。另用同一实际 macOS 原生环境独立复跑 `enroll`、`health`、`verify`，得到相同的 `6,7,8,10` 与 `6,10`。隔离宿主留下的共享临时 pnpm 存储探测已改成显式 `--store-dir` 独立目录，既有 pnpm 存储未迁移。

## 离线复跑

从仓库根运行。下面只使用新目录、独立 P-256 测试密钥和 PTY，不需要另开 DSH。

```sh
npm run build
review="$(node scripts/vp8-boot-review.mjs prepare)"
node scripts/vp8-boot-review.mjs init-keychain "$review"
node scripts/vp8-boot-review.mjs keychain-smoke "$review"
node scripts/vp8-boot-review.mjs exercise "$review" /path/to/ai-embedded-studio
node scripts/vp8-boot-review.mjs health "$review"
```

每次 `exercise` 使用新目录。它以独立进程运行固件 C++ 夹具，覆盖请求鉴权、首绑、轮询、重开、验证及退出。预期打印 `enroll:[6,7,8,10]`、`verify:[6,10]`、`routesReleased:true`。结束后 PTY 配置应已移除。目录包含 `package/`、`tty-helper`、`keychain-helper`、`enrollment.keychain-db` 和 `vp8-boot.json`。钥匙串或签名助手报不可用时，在同一 macOS 用户的正常登录终端重跑独立命令。若仍提示或拒绝，记录阶段和 OSStatus，核对候选助手路径、独立 Keychain 文件及权限，保持现有配置。正式凭据及权限策略另行评审。

需要逐步观察时，另一个终端可运行 `node scripts/vp8-boot-review.mjs fixture "$review" /path/to/ai-embedded-studio`。看到 `fixture ready` 后，再执行下方的 `enroll`、`health`、`verify`。Ctrl-C 停止夹具即可释放自有 PTY。复验时保持同一夹具进程，便于保留其模拟设备端存储。

## 设备任务命令

保持当前 DSH 窗口。只有设备任务已取得候选固件、确认板与预期 USB 身份、保证既有查询与其他串口消费者空闲，且批准设备访问时，才用新的独立 `review` 目录执行：

```sh
node scripts/vp8-boot-review.mjs health "$review"
node scripts/vp8-boot-review.mjs select-usb "$review" "$approved_callout" "$approved_usb_identity"
node scripts/vp8-boot-review.mjs enroll "$review"
node scripts/vp8-boot-review.mjs health "$review"
node scripts/vp8-boot-review.mjs verify "$review"
```

`select-usb` 只核对 IORegistry 并记录明确选定的 callout 和 USB 身份，不打开设备。看到 `awaiting_boot` 和设备端的确认提示后只执行一次短按并松开。重插或重开前后的本地 `bound` 只表示已有记录。应以 `verify` 的 `deviceChecked:true` 为本次设备读回结果。错误、断线或 Ctrl-C 后先确认串口释放。若 `health` 为 `pending`，用 `recover` 只对账，不重发首绑。只有同一设备的成功 fence Unbound 才能清除 pending。保留独立索引、原 Keychain 与其解锁文件供恢复。

rc.3 独立候选包由 `prepare` 生成于 `$review/package`。独立 Desktop 已初始化后，`node scripts/vp8-boot-review.mjs install "$review"` 和 `node scripts/vp8-boot-review.mjs launch "$review"` 为隔离宿主命令。在当前已打开 DSH 的使用约定下，优先使用上述 CLI 验证，日常设置页继续保留免输入查询。隔离实例若已启动，以 Ctrl-C 或应用正常退出结束，候选的设置路由应注销。

回退先停本轮自有进程，确认 TTY 已释放。只删除确认全为模拟的临时目录。有待确认或已保存的实板记录时保留索引和原密钥。设备侧恢复 0.1.4 由固件任务按其单独方案执行。
