# VP8 VPL1 管理端候选 Spec

2026-11-19。线协议以固件的 round-pet-vp8-lan-status.md、实际 C++ 和 round-pet-vp8-vpl1.json 为准。留驻 0.1.30，0.1.31 是固件构建候选。

- 管理端在受信宿主接入已建立的 TCP socket。完成 DeviceHello、HubAuth、DeviceFinish、HubFinish 和经 MAC 验证的 Ready 前不提供状态或控制。绑定范围逐字节匹配原 USB 持久记录，包括完整控制者 SEC1 SHA。Keychain 只查原 keyRef 和签署原文。板端公钥仅来自同一个经过 Fence 的独占 USB ARM 回执，当前候选在进程内固定，显式撤销或退出释放。禁止从 TCP 学习或替换公钥。
- 严格检查长度、类型、方向、点、签名、双向 MAC 和计数。最多一条认证候选与一条当前连接，握手限 9 秒。仅通过 Ready 的新会话可替换旧连接。同 boot 会话号递增，认证过的旧 boot 禁止回退。待签名或待 Ready 的旧 socket 不得影响当前状态。关闭清除临时密钥、定时器及未确认控制。
- Status v1 模式用现有状态 owner 唯一调度 3 秒 Ping，与 Play 共用 VPC1 序号。仅当前探针对应的 Status 刷新快照。Pong 不延长状态新鲜度。6 秒回退到已接 USB，9 秒关闭该 TCP 会话，EOF 立即回退，重连新状态取消自动 USB 采样。协商 0 时只启用原 VPC1 控制心跳，继续 USB 状态。保持既有 Play 期限和真实首帧回执，换 boot 重置会话与显示序号。
- 验收包括固件共享字节向量、真实 Node/C++ 回环和虚拟时间。覆盖固定公钥不匹配、错绑定、缺省状态、序号竞争、撤销、断线、6/9 秒和恢复停 USB。复用现有设置页投影和私有 Keychain 作用域。默认宿主不装配 TCP listener，不改日常 DSH、固件、USB 设置及配置。离线回退关闭候选适配，保留现有已绑定 USB 路径。
