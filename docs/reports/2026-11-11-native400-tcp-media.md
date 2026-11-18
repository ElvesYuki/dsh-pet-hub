# 400 TCP 素材维护发送端验证

2026-11-11。完成管理端 PTM1 v1 提案、二进制编解码、独立发送状态机和真实 loopback TCP 验证。终端侧 `2026-11-11-tcp-media-receiver.md` 报告已解帧数据到 NOR 保存的宿主验证，两侧的线级对拍仍待完成。[Spec](../context/plans/tcp-media-spec.md) · [Diff](../context/plans/tcp-media-diff.md) · [协议](../protocol/native400-tcp-media-draft.md)

| 模块 | 本轮结果 |
| --- | --- |
| 发送入口 | `prepareNative400MediaTransfer` 接受本地显式单笔决定。复用 compact78 来源身份解析，固定 manifest/index 摘要、许可引用、动作、boot、根和对象代数 |
| 原文件 | 只打开 1/11 的常规只读文件。每次用单个 4076 B 块做预验 SHA，发送时再做全 SHA，并在 BEGIN 前与 END 前核对路径和文件指纹 |
| TCP | 接管显式提供的 IPv4 loopback socket。分片重组、单次有界写、单块等待累计 ACK、整体截止、实际 socket 和 fd 退出 |
| 状态 | `sent`、`confirmed` 与 `saved` 分开。合法 Saved 还要求 END 已尝试、job 和 SHA 一致、新根精确推进一位、新对象代数高于起始 HELLO 报告的根及两个对象代数 |
| 恢复 | 提交前取消保留已确认字节，收到有效 Saved 则保留提交事实。可能已提交的断线或超时记 Unknown。调用者可持原内存作业显式同 boot 查询，根变化只作库存事实。管理端不自动重发，跨作业写栅栏仍由固件负责 |

## 验证

- Node 24.14.1／npm 11.11.0。`npm run check` 通过，`npm test` 构建隔离候选后全量 1974 项通过，耗时约 111 秒。
- 18 项专项通过。假设备从真实 TCP 收到原创动作 1 与 11 的 PET4，验证全长、SHA 及各 241 帧，之后回模拟 Saved。原批准的 compact78 动画文件未参与本轮测试。
- 通过分片、粘包、慢端单块背压、累计 ACK 错误、CRC、截断、截止、文件变更、早到 Saved、跳根、旧代数、取消竞争、断线同 boot 查询、错 boot、未知结果保留及实际退出测试。分片初测曾因部分可读的 socket 反复唤醒而卡住。现改为将已到字节逐步消费到定长缓冲区，两次初测进程均已退出。
- 共享字节向量含 10 条合法帧及 4 条非法帧，已做 Node 往返与拒绝验证。C++ codec、发送方与固件接收 owner 的 socket 互操作待联合验证。[字节向量](../protocol/vectors/native400-tcp-media-draft-v1.json)

## 下一项与回退

先对齐 128 位线级 job 与终端内部 u64、能力与版本、READY/ACK 时机、END 封存和迟到 CANCEL，跑动作 1 的 Node/C++ 隔离 loopback。随后复用到 11。真实 LAN 前还需设备与用途授权、会话认证、重放规则、STA 及 Flash 延迟证据。设备版本 2cc7060d 与 HTTPS 候选在 OPEN 资源准入退出的结论来自终端只读报告。[当前 400 基线](../context/native400-baseline.md)

调用者执行 `close()` 可回收作业，移除显式调用即退出该候选。没有配置或缓存迁移。验证使用临时文件和 loopback，固件、ESP、现有 DSH、pet、bridge 和生产 listener 均未参与。
