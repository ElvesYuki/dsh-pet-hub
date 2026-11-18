# VP8 BOOT 持久回执联合宿主对拍

2026-11-17。[Spec](../context/plans/vp8-boot-proof-spec.md) · [Diff](../context/plans/vp8-boot-proof-diff.md) · [当前字节布局](../protocol/vp8-boot-usb-proposal.md)。

管理端复用 PBP1 帧头、CRC 和 VP8 Base64 封装。仅 VP8 扩展启用 type 10／133。发出请求时钉住当前探测和登记事务。poll 要求来自同设备、同 boot 的独立等待应答及其 reference。fence 用于新会话或重启后的对账。完整回执核对 nonce、mode、boot、device、reference，当设备已持久提交才增加完整公钥 SHA-256、controller、binding、epoch 的匹配。相符回复消耗本轮 nonce。故障、Busy、旧状态或仅证明等待按键时，保持待处理记录。

## 对拍证据

- 固件目录只读编译 `vp8_pairing.h` 的真实 Session 与 `test_boot_pairing.cpp --vectors`。实际生成输出与固件交接的 `.cache/vp8-boot-proof/vectors.txt` 完全一致，SHA-256 为 `beaad532957e1f285e97dfd49a1fd5e9bd478690213bdab1fea760ee4c58984a`。
- 等待、持久 Bound、重启后 fence 恢复、fence Unbound 和存储故障共 5 条与 Node 逐字节一致。第二套夹具把 Node 生成的请求送入实际 C++ 分发，覆盖 BOOT 后持久读回、旧 boot 拒绝、忙时 fence 保持、成功 fence 取消、提交失败及原 STATUS2。清理编译临时目录。
- Node 负例覆盖旧 129／132、错模式、boot、nonce、reference、设备或绑定元组、完整公钥指纹后半不匹配和回执复用。仅匹配 Bound 和成功 fence Unbound 形成事务证据。测试签名和 NVS 读写使用合成夹具，没有执行实际设备签名或物理按键。
- `npm run check` 通过。协议与事务专项 19 项通过，带固件交接文件的回执对拍 3 项通过，构建及全量 2,048 项通过，无跳过。

离线联合对拍已通过。下一片接入管理端持久私有索引、密钥引用、结果未知恢复和设置页候选，并通过隔离宿主验证。当前固件、现有设备免输入查询及部署配置保持原样。
