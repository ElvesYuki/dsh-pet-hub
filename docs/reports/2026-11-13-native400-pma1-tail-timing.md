# PMA1 动作 1 收尾计时

固件任务的 `2ad12eb5` 实板报告确认一次 BOOT 首绑、同 boot 管理端重开与软件复位后免按键续接。异密钥在管理端身份比对时被拒绝。NVS 绑定记录已读回，原有 19 条有效记录一致。实板使用隔离测试签名器，Keychain、冷断电和实体解绑待验。

动作 1 的 3,568,101 B 全部获得 ACK（876 块），原 sender 在 30.003 秒返回 `Unknown/media_deadline`。设备首个错误 `record_not_live`，USB 连续性异常为 0。固件任务独立 ROM 核对确认备用槽载荷摘要匹配，备用槽和非活动根均未达到完整提交的预期镜像，原活动根与对象通过校验。既有记录仍无法定位 END 验收时刻。固件证据为 `apps/round-pet/reports/2026-11-13-pbp1-persistent-binding-device.md`。

固件任务已恢复备用槽、非活动根与 `2cc7060d`，通过保护区及应用读回，待机 241 帧约 23.946 FPS。新 NVS 绑定记录保留。

管理端候选仅在 `--tail-timing`（API `tailTiming: true`）启用时输出 `timing.tail`。记录最后 ACK、文件复核完成、END 写入尝试、END 本地写回调、RESULT 验证及关闭前终止点。各阶段记录从接管 TCP 起的单调时钟偏移与本机有效截止的差值。未到阶段为 `null`。原输出、30 秒上限、认证和 ARM 规则保持。测试使用真实临时 loopback 和设备替身，验证默认输出、成功、最后 ACK 后文件身份变化、END 后缺失 RESULT 及部分 ACK 截止。真机下一轮需用同一动作和固定 sender 设置，与设备的 END 验收、全包校验、根提交／读回和 RESULT 写出配对测量。继续保持原截止，采到分段后再决定余量。[Spec](../context/plans/tcp-media-pma1-tail-timing-spec.md) · [Diff](../context/plans/tcp-media-pma1-tail-timing-diff.md)

原五文件已在 Git 忽略的本地目录保存，SHA-256 与上轮对照一致。它们是源码对照副本，运行原对照时应在独立副本中还原原路径及依赖。关闭诊断开关恢复原输出。认证、socket 和 LAN 装配三个文件字节保持原样，sender 和 CLI 两文件因采样变动。未启动实板或生产服务。[原指纹](2026-11-12-native400-pma1-lan.md#启用-tcp_nodelay-后的实板对照)

专项 8 项、`npm run check`、候选构建和全量宿主测试 2027 项通过，零跳过。源文件负例将原 inode 保留到独立文件名，确保覆盖末尾身份复核。直接覆盖原路径会先触发原文件链接数检查。
