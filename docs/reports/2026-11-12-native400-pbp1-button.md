# PBP1 人工 BOOT 确认入口

2026-11-12。macOS 人工 CLI 新增显式 `--pair --button`。模式仅信任操作者选定的直连独占 USB，并要求预先核对目标 device ID。原配对编排仍验证 boot、proposal、Pending 及本地计算的 HMAC 指纹。CLI 在核验后允许同一提议发送一次 CONFIRM。操作者等设备显示提示，再在设备的 15 秒窗口内短按一次实体 BOOT。只有收到同作用域的 Active 且 USB 已退出，才发布同 boot RAM 租用。[Spec](../context/plans/tcp-media-pbp1-button-spec.md) · [Diff](../context/plans/tcp-media-pbp1-button-diff.md) · [PBP1 契约](../protocol/native400-pbp1-draft.md)

固件任务确认支持 BOOT 确认的候选并安排实物窗口后，在仓库根目录使用以下命令。`PBP1_PORT` 和 `PBP1_DEVICE_ID` 分别为已确认的直连端口和 32 位十六进制 ID。PBP1 v1 没有手势能力字段，CLI 无法从线上报文识别手势。Active 后回车只用于退出本进程并撤销 RAM 租用。

```sh
pbp1_helper_dir=$(mktemp -d)
cc -Wall -Wextra -Werror native/native400-pbp1-tty.c -o "$pbp1_helper_dir/pbp1-tty"
node scripts/native400-pbp1-pair.mjs --pair --button \
  --helper "$pbp1_helper_dir/pbp1-tty" \
  --port "$PBP1_PORT" --device "$PBP1_DEVICE_ID"
```

新增两项回归，既有 PBP1 定向共 15 项通过。PTY 用人工入口的同一回调验证配对前零键盘输入、早按无效、HostConfirmed 期间无租用、新按键后获得租用。模拟 USB 验证错误 Pending HMAC 阻断 CONFIRM，设备未按键并报告 TimedOut 时退出且无租用。15 秒和物理按键由设备端控制，宿主验证使用模拟状态，不测实体时序。

`npm run check` 通过。包含既有 C++／NOR 回环的 `npm test` 完成隔离构建，2015 项通过、零跳过。CLI 核对了 `--help` 和单独传 `--button` 时拒绝进入配对。

本轮不碰真实串口、固件、配置、服务和网络。原始 PSK 仍只在配对生命周期内驻留内存。固件任务负责原理图、BOOT 实体键、候选回退和后续真机验证。保留原指纹输入入口供匹配的历史固件使用。[既有串口说明](2026-11-12-native400-pbp1-serial.md)
