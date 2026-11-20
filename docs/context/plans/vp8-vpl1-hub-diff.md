# VP8 VPL1 管理端候选 Diff

2026-11-19。

| 位置 | 改动 |
| --- | --- |
| VPL1 runtime | 分帧及状态投影、绑定范围、单次散列签名、P-256 ECDH、方向密钥及认证 socket owner。 |
| USB BOOT owner | 独占已验证连接中的候选 ARM 和同一绑定私有 pin，经已有 Keychain 和索引持续核对，不增加 DSH 写入口。 |
| VPC1 owner | 添加外部 Ping 和经认证启动切换。原直接控制夹具保持独立默认心跳。 |
| 设置宿主 | 候选连接提供者走既有 connectTelemetry 入口，复用状态和 USB 回退。 |
| 测试与上下文 | 只读使用固件匹配向量和 C++ 夹具。验证实际 TCP 收发、失联和回退，记录真机待验及退出。 |
