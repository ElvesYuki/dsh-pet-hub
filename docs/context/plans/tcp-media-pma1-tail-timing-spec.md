# PMA1 收尾分段计时 Spec

2026-11-13。动作 1 实板确认全部 876 块（3,568,101 B），原 sender 在约 30.003 秒返回 `Unknown/media_deadline`。设备首个错误 `record_not_live`。独立 ROM 核对确认备用槽载荷完整，备用槽及非活动根均未达到完整提交的预期镜像，END 是否验收仍待确认。`2ad12eb5` 已验证一次 BOOT 首绑、同 boot 管理端重开、软件复位后免按键续接及错公钥拒绝。固件证据为 `apps/round-pet/reports/2026-11-13-pbp1-persistent-binding-device.md`。

## 管理端观测

专用 LAN 入口显式使用 `--tail-timing`，runtime 选项 `tailTiming: true`。既有默认输出及调用路径保留。启用后新增 `timing.tail`，每个点为 `{atMs, remainingMs}`。`atMs` 从接管 socket 的单调时钟起点计时，`remainingMs` 为当前有效截止减采样时间，负值表示采样已晚于截止。尚未到达的阶段为 `null`。

| 字段 | 记录时机 |
| --- | --- |
| `lastAck` | 校验精确累计 ACK 并确认最后一块 |
| `sourceVerified` | 第二遍全文件 SHA 与末尾文件身份复核通过 |
| `endAttempted` | 认证记录编码后进入原写入尝试回调 |
| `endWritten` | END 的本地 socket 写回调成功 |
| `resultValidated` | 常规 END 收尾路径中，RESULT 通过认证及现有作业／提交身份检查 |
| `finished` | sender 记录结果或失败，关闭资源前 |

END 写回调仅是本地 I/O 证据。设备验收 END、全包校验、提交、读回与 RESULT 写出须由设备自身计时。`resultValidated` 也可对应合法的非 Saved 结果，持久提交确认仍用既有 `status` 和 `saved`。两个时钟只比较各自的分段耗时与剩余期限。30 秒上限、原 GRANT 和 ARM、单块在途、HMAC 认证及素材完整性检查继续沿用。采样不做额外 I/O。

收尾余量待同一实板作业获得两端数据后评审。使用 `30 s ≥ 前置 + DATA/ACK + END 与设备校验/提交/回执 + 时钟与调度余量`。对齐最后 ACK 剩余期限与设备后续阶段耗时，样本不足时保留未知。当前切片不调整期限或重试规则。
