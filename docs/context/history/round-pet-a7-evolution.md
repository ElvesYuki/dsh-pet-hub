# A7会话与回滚维护演进

2026-10-30。替代A6“必须显式model reboot／会话revision和低root维护尚未实现”的当前结论。A7已验证受信会话切换、显式根检查点与只读维护评审；固件共同定版/生产权威持久化/G1/G2仍未关闭。[报告](../../reports/2026-10-30-round-pet-a7.md)、[API](../../protocol/round-pet-a7.md)。以下保持原阶段语境，相对链接沿用原文件位置。

## 原当前摘要

```text
2026-10-30 A6模型执行端到端：check（仅.mjs语法）和test（含候选构建）全套634项通过，新增30项；独立CLI30项及素材环境创建后的SIGTERM均清自有临时环境，见[报告](../reports/2026-10-30-round-pet-a6.md)。A1单RAM/Flash actor驱动离线peer，经A2磁盘CAS→A4临时mTLS→A5/A3/status；初始库存来自事务预置后恢复，verified/首帧/保存分别由字节校验、submitFrame和root commit产生，淘汰后新查询反映可用状态。[API](../protocol/round-pet-a6.md)、[替代记录](history/round-pet-a6-evolution.md)。

新增≤16回执的simulator适配器，不进生产候选；单UDS赢家/默认OFF装配、只读UI、deviceTransport=false及无生产listener保持。保存暂存/未写满不发布，deferred后可拉取取消；payload/header错误保旧root，marker/读回错误未知，显式模型恢复后完整库存收敛，不盲重试或补造saved。模型可回退旧有效根，但hub拒绝已确认高水位后的低root；双坏根不格式化，I/O不伪装坏根。

原A5磁盘reader/同fd证据、pin等实际HTTP退出、休眠resume保持OFF仍有效。模型首帧只是注入完成事件，内存medium不是物理V2/掉电；46描述共享原创241帧PET4，非真实46库负载。重连保留历史actual但is_current=false，不自动重播。两个VirtualClock偏移700000ms，本地期限失效清旧票据，新控制不复活过期帧；宿主休眠不推导设备瞬时获知断线。

下一须共同确认hub重启/设备不停机时的revision命名空间、低root回滚维护、deferred/取消及C01–C12、真实包P/源SHA/ID/许可和Node/C++字节对照。本轮恢复使用显式model reboot，不能据此称无重启重连完成。ESP TLS峰值/可信时间/凭据、G1/G2维护/让出/有界退出均未验，15s及1000/500/100/10仍非设备最坏上界。自动重试=0，无生产通道/自动联网重连/CLI或页面启用入口。

```

## 原下一入口

```text
2. **会话与回滚恢复契约切片**：先补Spec/Diff，明确hub重启而设备actor不停机时的revision命名空间、上下文重置与旧步骤失效；A6当前恢复显式model reboot，不代表无重启恢复。设计低root回滚维护、deferred后取消/提交竞态的双方确认和离线向量，不自动降低hub高水位或重试save；复用已接好的A1/A2/A3/A4/A5链。Node/C++共享字节由双方分别实现。
```

634项/30专项为A6当时证据，A7新增24项后当前658项。默认A5仍不自动保存/导入检查点；临时caller重开不能当生产持久化或磁盘防回滚。原A6的reboot向量继续保留，不改写为真机不重启证据。
