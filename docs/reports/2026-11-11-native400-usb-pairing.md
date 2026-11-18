# 管理端 PBP1 编排和 RAM 租用验证

2026-11-11。新增 PBP1 定长编解码、HMAC 指纹、一次性 USB 事务编排和可直接提供给正式 PMA1 sender 的 RAM 租用。入口 `createNative400UsbPairing({enabled, transport, identity, confirmFingerprint, ...})` 仅在 `enabled: true` 时接收调用者交付的独占适配器。代码不打开设备、不写配置或保存密钥。[协议](../protocol/native400-pbp1-draft.md) · [Spec](../context/plans/tcp-media-usb-pairing-spec.md) · [Diff](../context/plans/tcp-media-usb-pairing-diff.md)

- `identity` 为 PMA1 `{device, hub, binding, epoch}`，其中 `hub` 在线路对应 controller。`transport.exchange` 接受一帧二进制请求及 AbortSignal，返回一帧或 `null`。`transport.close` 负责中断并等待底层实际退出。适配器处理 USB 字节分片、回收缓冲，必须使用明确选定的设备与独占会话。本轮只注入模拟适配器。
- `confirmFingerprint(view, {signal})` 只收到冻结的 boot、device、proposal、fingerprint，由本地用户返回终端屏幕上的完整十六进制指纹。`start()` 仅在确认、匹配 Active、USB 退出都成立后返回配对提供者。`close()` 可重复调用，撤销租用并放弃密钥引用。PMA1 使用 `pairing.boot` 时同时要求批准与实际 HELLO 在原 boot。
- `INFO` 恢复丢失的 OFFER、CONFIRM 或 Active 回执。用户拒绝或本地确认失败前的 CANCEL 固定原已校验提议。确认后失败不尝试撤销设备端可能已成立的 Active，宿主不会授予租用。已有 Active 必须由终端生命周期处理后再配对。

## 宿主证据

- 八个 PBP1 专项通过。覆盖十条字节向量，CRC、错长、错版本和保留位负例，屏幕确认和新长按模型，回执丢失、错设备、错 boot、错提议、指纹不符、过期、资源等待和拒绝后 CANCEL。另有一项从模拟 USB Active 到正式 PMA1 sender 的真实 TCP 回环，验证同 boot 成功、错 boot 拒绝和关闭后撤销。
- 临时 C++ 探针直接只读 include 终端 `media_pairing.h`，实际解码 4 条分片请求，并生成 6 条逐字节一致的 STATE。此探针覆盖字节和 CRC，指纹另由 Node 内置 HMAC 与固定向量复核。读取的头文件 SHA-256 `7b959b2bc88d791975a8a296d187b54517324a2860382233cc46ccd4ad382bec`。
- Node 24.14.1/npm 11.11.0。`npm run check` 通过，包含既有 C++/NOR 回环的 `npm test` 完成隔离构建，全量 2008 项通过，零跳过，耗时约 110 秒。共享向量 SHA-256 `0146d5f7727efb0f7077274329d50103c4d9d9ef79fbab76e95188e6ea569539`。[向量](../protocol/vectors/native400-pbp1-draft-v1.json)

```sh
node --test tests/native400-usb-pairing.test.mjs tests/native400-media-auth-sender.test.mjs
```

固件侧已报告正式 PMA1 sender 与终端认证收据的隔离 TCP/NOR 联调。下一步接受信 USB 适配器和固件实体确认，验证连接退出与已激活 RAM 绑定，再评审端侧熵源、STA 和限时真机。LAN 写入保持关闭，既有配置和服务未操作。回退为关闭 owner 并撤去显式入口，无配置或密钥迁移。[当前待办](../context/current-todos.md)
