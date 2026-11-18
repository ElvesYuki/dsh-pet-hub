# VP8 直连 USB 一键绑定候选验收

2026-11-17。[Spec](../context/plans/vp8-usb-enroll-spec.md) · [Diff](../context/plans/vp8-usb-enroll-diff.md) · [字节契约](../protocol/vp8-boot-usb-proposal.md)。

## 验收

- 固件实际 `vp8_pairing.h` 的 C++ Session 与管理端对拍。新会话声明 mask 15 后，一次命令发送 Type 6、Type 7 op3、Type 8 和 Type 10 fence。Type 130 回显 op3，P-256 验签继续采用历史 enroll transcript。Type 132 到达时本地仍是 pending，Type 133 完整匹配后原子置为 bound。
- 固件交接的 Type 129／132／133 固定向量已从实际 C++ 重新生成，与对方文件及 Node 独立编码三者逐字节一致。文件 SHA-256 为 `7862373c5fd3629c42bd841e1cf2c0d160e75faf55f770a2833cf3115b0a12fb`。固件任务另行报告 ASan／UBSan、ESP-IDF 构建和候选验签通过，分区沿用原方案。
- 固件 C++ 已持久化但 Host 丢失 Type 132 后，模拟设备重启和 Host 重开。只发送新 Type 6／10，恢复匹配绑定，私钥引用不轮换，也无挑战、Type 8 或 BOOT 重放。宿主负例覆盖能力缺失、错 op／reference、Waiting 代替 Bound、完整摘要后半不符、fence Unbound 和断线。
- 用**真实 macOS Keychain、真实 PTY、模拟设备存储**复跑独立候选的设置路由。结果为 `challengeOperation:3`、`bootTicks:0`、`enroll:[6,7,8,10]`、`verify:[6,10]`、`routesReleased:true`。钥匙串用户搜索列表一致，临时 PTY 配置已清理。这个验证未进入当前 DSH 的实际 renderer，也未打开真板串口。
- `npm run check`、构建及全量 `npm test` 通过，2,068 项通过，无跳过。新增 CLI 命令使用独立候选宿主与同一索引，常规客户端摘要和 PREP 回归均通过。

## 协议候选阶段的 DSH 入口评估

现有签名 Desktop rc.3 的查询插件曾在已打开的同一进程热加载，Connection 在 owner cookie 门禁之后调度精确路由。本轮继续保留当前运行实例、日常免码查询和独立的历史 BOOT 入口。常规客户端的已审核字节摘要保持原样。

该阶段候选通过独立 `DSH_HOME`、私有目录和进程显式配置 `DSH_PET_HUB_BOOT_MODE=usb` 加载。后续改用独立候选包的原生宿主配置，并在当时已经运行的 rc.3 中热加载及读回已绑定真板。当前设置入口、现场 Keychain 回退和剩余验收项见[同进程实装验收](2026-11-17-vp8-usb-desktop-hotload.md)。

## 联合复跑

从仓库根运行，保持已打开的 DSH 原样。

```sh
npm run build
review="$(node scripts/vp8-boot-review.mjs prepare)"
node scripts/vp8-boot-review.mjs init-keychain "$review"
node scripts/vp8-boot-review.mjs exercise-usb "$review" /path/to/ai-embedded-studio
node scripts/vp8-boot-review.mjs health "$review"
```

独立包位于 `$review/package`，候选客户端入口为 `dist/client.boot-review.js`。仅在设备任务确认固件候选已验签、设备已明确授权且释放串口后，可用独立目录与原 [端口选择／健康检查](2026-11-17-vp8-boot-native.md#设备任务命令)，将一次写入命令换成 `node scripts/vp8-boot-review.mjs enroll-usb "$review"`。现有 `recover` 与 `verify` 不变。回退停用候选并保留 pending 索引和原签名引用，正式 0.1.4 由设备任务保留。

真机目录与模拟目录分开。真机阶段只 `prepare` 和 `init-keychain` 一次，保存输出的 `$review` 原路径。设备或管理端重启、重插和恢复后继续用同一目录运行 `health`、`verify` 或 `recover`。位于该目录的 `vp8-boot.json`、`enrollment.keychain-db` 和 `keychain-unlock` 属于同一个密钥作用域，需要一起保留。重开不另建 Keychain，也不更换引用。如果重插后 callout 改名，先确认所有 owner 已释放，备份旧 `review-peer.json`，在同一目录用经确认的旧 USB 身份和新 callout 执行 `select-usb`，再运行 `verify`。
