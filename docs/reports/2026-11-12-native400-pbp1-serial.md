# PBP1 独占串口适配与人工入口

本文保留指纹输入及触摸长按阶段的操作。后续 BOOT 候选使用显式按键入口。[BOOT 操作](2026-11-12-native400-pbp1-button.md)

2026-11-12。管理端已实现 `openNative400Pbp1Serial({enabled, port, helper, timeoutMs})`，返回可直接注入 `createNative400UsbPairing` 的独占 `exchange`／`close`。本轮验证仅使用自建 PTY 和模拟 I/O。终端 `afa4897f` 是离线构建候选，设备最近确认的应用仍为 `2cc7060d`。[Spec](../context/plans/tcp-media-pbp1-serial-spec.md) · [Diff](../context/plans/tcp-media-pbp1-serial-diff.md) · [PBP1 契约](../protocol/native400-pbp1-draft.md)

## 行为与边界

- 显式打开指定 `/dev` 字符设备，使用 `O_NOCTTY`、`O_NOFOLLOW` 和非阻塞 I/O。短命 C helper 在同一描述符取得 `flock` 与 `TIOCEXCL`，设置 raw 并关闭硬件流控和 `HUPCL`，保留串口速度。Helper 在发送任何配对数据前退出。关闭前等待实际读写完成。
- 软件无复位或 DTR／RTS 控制调用。串口打开本身的控制线瞬态仍取决于驱动和硬件，PTY 无法验证。人工入口限定 macOS `/dev/cu.usbmodem…`，使用目标板直连 USB Serial/JTAG，先退出其他已持有句柄的工具。内核独占阻止后续普通打开，`flock` 串行化本适配器的并行实例。
- 每次事务先丢弃已排队的输入，再发送完整请求。从混合输出按 magic、类型、固定长度、CRC 和 STATE 字段提取合法帧。每次读最多 512 B，候选帧缓冲 64 B，单事务最多处理 256 KiB。流超时清除部分帧，完整请求无回执时返回 `null`。写入中断则关闭，禁止后续请求拼接残帧。
- PBP1 无逐事务 ID，整条迟到回复如果在下一次请求之后到达，仍由配对编排器校验 boot、设备、提议、指纹和相位。允许 INFO 重新观察相同作用域的 Active。OFFER 和 CONFIRM 不自动重发。串口关闭也不证明物理 USB 已断开，设备待确认状态以 CANCEL 或本端超时收敛。
- 适配器和人工入口不输出串口原始字节、OFFER 或 PSK。应用缓冲按所有权清理，操作系统及 USB 驱动缓冲无清零保证。

## 宿主命令

在管理端仓库根目录编译 helper，产物留在临时目录。查看帮助和运行 PTY 回归均不接触实物。

```sh
pbp1_helper_dir=$(mktemp -d)
cc -Wall -Wextra -Werror native/native400-pbp1-tty.c -o "$pbp1_helper_dir/pbp1-tty"
node scripts/native400-pbp1-pair.mjs --help
node --test tests/native400-pbp1-serial.test.mjs tests/native400-usb-pairing.test.mjs
```

仅在固件任务明确安排的实物窗口使用下列命令。`PBP1_PORT` 填操作员预选的直连串口，`PBP1_DEVICE_ID` 填独立确认的 32 位十六进制设备 ID。候选按 `SHA256(ASCII("PBP1/device/v1") || eFuse 默认 MAC 原始 6 B)` 的前 16 B 派生该 ID。入口发送 OFFER 前先用 INFO 核对预期设备。

```sh
node scripts/native400-pbp1-pair.mjs --pair \
  --helper "$pbp1_helper_dir/pbp1-tty" \
  --port "$PBP1_PORT" --device "$PBP1_DEVICE_ID"
```

从设备屏幕输入完整指纹。设备进入确认画面后，先松手，再长按至少 1.2 秒。看到 `Active` 时串口已退出。按回车或 Ctrl-C 撤销本进程租用。此 CLI 只做配对验证，其他进程不会继承租用。固件每 boot 只允许一次激活，重复配对由固件任务安排重启。需要同进程继续使用租用时，直接使用 runtime API。测试完成后可删除临时 helper。

## 验证

macOS 自建 PTY 通过独占、噪声及坏 CRC 中的分片、超时后丢弃半帧、INFO 重查、取消和完整 RAM 配对。模拟 I/O 覆盖短写及中断后等待实际退出。初测发现 Node 传递描述符给子进程时清除了非阻塞标志，现由配置 helper 在退出前恢复，PTY 空读及取消已复验。人工入口只执行了 `--help`。

新增测试组共 5 项（含 PTY 父组）通过。`npm run check` 通过。启用既有 C++／NOR 回环的 `npm test` 完成隔离构建，2013 项通过、零跳过，约 111 秒。自建 PTY 与临时诊断产物已清理。

本轮未打开真实串口、烧录、启服务、启用 LAN 或修改运行配置。下一步由固件任务验证 `afa4897f` 的真实屏幕、实体长按、USB 断链、重启和播放，再评审 STA。管理端回退为关闭 owner、撤销 RAM 租用并删除临时 helper。[当前待办](../context/current-todos.md)
