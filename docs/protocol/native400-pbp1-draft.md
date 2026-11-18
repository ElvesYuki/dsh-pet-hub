# PBP1 独立 USB 配对

2026-11-12。PBP1 通过可信物理 USB 通道，为独立 PTM1 维护链建立同 boot 的 PMA1 RAM 配对。管理端接受显式注入的事务适配器，已有独占串口实现及 PTY 证据。OFFER 在 USB 通道上携带原始 PSK，适配器必须独占、禁止日志和旁路复制。CRC 用于帧检错，屏幕指纹及双方确认用于关联物理目标和本次提议。实物与 LAN 准入仍待验。[编排 Spec](../context/plans/tcp-media-usb-pairing-spec.md) · [字节向量](vectors/native400-pbp1-draft-v1.json) · [串口命令与验证](../reports/2026-11-12-native400-pbp1-serial.md)

## 字节格式

固定 16 B 头。偏移 0 为 ASCII `PBP1`，4 为版本 `1`，5 为类型，6–7 为零，8–11 为 body 长度 u32 LE，12–15 为 IEEE CRC32 u32 LE，覆盖头前 12 B 与完整 body。最大帧 112 B。多字节数字均为小端，16 B ID 和指纹为原始字节。宿主 `pbp1Header` 可先校验固定头和声明长度，再收余下字节。编解码每次处理一帧。

| 类型 | 方向 | body 长度 | body 字段及偏移 |
| --- | --- | ---: | --- |
| `1` INFO | hub → 终端 | 0 | 无 |
| `2` OFFER | hub → 终端 | 96 | boot u64 @0，device/controller/binding 各 16 B @8/24/40，epoch u64 @56，PSK 32 B @64 |
| `3` CONFIRM | hub → 终端 | 28 | boot u64 @0，proposal u32 @8，fingerprint 16 B @12 |
| `4` CANCEL | hub → 终端 | 28 | 同 CONFIRM |
| `128` STATE | 终端 → hub | 48 | boot u64 @0，device 16 B @8，proposal u32 @24，fingerprint 16 B @28，phase @44，event @45，46–47 为零 |

phase 为 `0 Empty`、`1 Pending`、`2 HostConfirmed`、`3 Active`。event 为 `0 OK`、`1 Rejected`、`2 TimedOut`。Empty 的 proposal 和 fingerprint 为零。Node 以规范十进制字符串处理 u64，以小写十六进制处理 ID 和指纹。

```text
fingerprint = HMAC-SHA256(PSK,
  ASCII("PBP1/fingerprint/v1") || LE64(boot) || LE32(proposal) ||
  device16 || controller16 || binding16 || LE64(epoch))[0..16)
```

域字符串无 NUL，取摘要前 16 B。提供的十条向量均为确定性合成数据。[PBP1 向量](vectors/native400-pbp1-draft-v1.json)

专用 PMA1 LAN 联调启用 type `5`，请求为固定 180 B body，最大帧 196 B。普通配对仍以 112 B 为其最大请求。扩展仅在显式开启的 ARM 事务使用，绑定原 RAM 配对和确切 BEGIN 摘要。[ARM 交接与命令](../reports/2026-11-12-native400-pma1-lan.md)

## 宿主顺序和回收

1. 宿主已选定预期物理设备 ID，显式运行 INFO 并固定返回的 boot。只有该设备的 `Empty + OK` 能进入 OFFER。已有 Pending 或 Active 时退出，保护旧提议和绑定。
2. 宿主为单笔操作生成独立 32 B 随机 PSK，只发一次 OFFER。校验 `Pending + OK` 的 boot、device、非零 proposal 和本地重算 HMAC。宿主显示指纹，操作员从设备屏幕输入完整 32 位十六进制指纹，匹配后只发一次 CONFIRM。比较支持大小写。
3. 终端在 HostConfirmed 后须有新的物理屏幕长按。宿主接受本轮相同 boot、device、proposal、fingerprint 的 `Active + OK`。丢失回复用 INFO 补查，OFFER 和 CONFIRM 均不重发。确认后 INFO 仍为 Pending、终端拒绝、过期或发生作用域漂移，均不发布租用。匹配 Active 后等待独占 USB 事务退出，才发布 `{identity, boot, acquire}`。
4. 用户拒绝、指纹输入不符或回调失败时，宿主在原期限内尝试取消已验证 Pending，CANCEL 携带原作用域。确认已经尝试后，宿主保守保留终端可能已进入 Active 的事实，不在失败路径发 CANCEL。断链或超时由终端清理尚未激活的提议。宿主关闭撤销 RAM 租用并放弃本地 `KeyObject` 引用，设备 Active 由设备生命周期管理。

人工 CLI 可显式选择 `--pair --button`，用于信任直连独占 USB 且已确认支持 BOOT 短按的固件。该模式在原 Pending HMAC 和身份校验通过后自动发送一次 CONFIRM，省去手工输入。设备提示后的 15 秒窗口和实体确认由固件负责。Active 的作用域校验与 USB 退出条件继续适用，线上字段不变。[按键命令与验证](../reports/2026-11-12-native400-pbp1-button.md)

事务接口 `exchange(packet, {signal})` 返回一个完整响应或 `null` 表示本次响应丢失，接收/分片及传输退出由适配器负责。`close()` 必须停止并等待实际 I/O。宿主编排默认总截止 60 s、单事务 1 s、INFO 轮询 200 ms，未结束的提示可以中断，迟到输入无效。USB 适配器须从所有事务及退出路径回收数据副本。管理端只对自己的原始 PSK 和 OFFER 缓冲做尽力清除，Node 或其他持有者的内部副本无清零保证。[宿主验证与接口](../reports/2026-11-11-native400-usb-pairing.md)
