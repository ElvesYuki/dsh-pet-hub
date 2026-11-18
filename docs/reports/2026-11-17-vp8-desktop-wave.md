# Desktop rc.3 缓存动作 4 挥手测试

2026-11-17。[Spec](../context/plans/vp8-desktop-wave-spec.md) · [Diff](../context/plans/vp8-desktop-wave-diff.md)。

## 真机结果

已安装的签名 DeepSeek Harness Desktop 0.2.2-rc.3 使用同一私有 Hub 入口和登记设备。安装新本地包后，已打开的设置页仍显示旧版。通过 DSH 插件面板停用再启用 Hub 后，新按钮加载，桌面进程与会话保留。

启动 `start-wave` 后，在「设置 → 实体宠物设备」完成本机授权并只点击一次「挥手测试」。同一独占 USB 会话先核对 STATUS2，收到 `0.1.4`／`ota_0`，然后只发一次 `WAVE`。设备按顺序回报 USB 请求、动作 4 的 DMA 完成首帧、完整 EOF、241 帧实际显示、动作 0 的 DMA 完成首帧。设置页显示「挥手已播放 241 帧，已恢复待机」，按钮保持禁用。

只读查询模式保留。没有执行其他动作、OTA、素材写入、配网或复位。桌面 patch 与既有 pet 配置一致，私有设备配置未变。关闭设置授权会话并执行 `stop`，复核 IPC 已消失和 USB 无持有者。脱敏记录在 Git 忽略目录 `.cache/hub-desktop-rc3-wave/proof.json`。

## 日常操作

- `~/.dsh-pet-hub/desktop-query/hub-query start` 只允许查询。使用 `start-wave` 才能手动触发一次挥手。开始另一种模式前先 `stop`。
- 在另一终端运行 `~/.dsh-pet-hub/desktop-query/hub-query copy-code`，到桌面密码栏用 Cmd+A、Cmd+V 替换原内容。终端不会显示授权码。
- 挥手结束后用 `status` 核对结果，再用 `stop` 或运行窗口的 Ctrl+C 停止。缺少设备证据时该次结果为未知，程序不重发。

回退时先停止 Hub。恢复同一私有目录 `before-wave` 中的 `packages` 和 `desktop-query.mjs`，并用 Desktop CLI 重新安装私有 `.cache/hub-desktop-rc3-wave/profile-before/package.json` 中记录的上一版 Hub 本地包。现有 Hub patch 无需恢复。若 UI 缓存旧模块，只切换 Hub 插件启停。

## 回归

`npm run check`、标准构建、rc.1／rc.3 候选通过。全量 `npm test` 共 2,035 项通过，零失败、零跳过。宿主专项覆盖默认只读、错设备、旧版本和维护中拒绝、过期状态与并发禁止、预存回执与触摸回执忽略、帧数不足、缺少待机首帧、有界超时和不重复下发。
