# 承载负载与延迟演进

2026-10-30。当前证据见[报告](../../reports/2026-10-30-transport-load.md)与[契约](../../protocol/transport-load.md)。仅替代“逐块证书/同步盘成本尚无宿主样本、队列成本尚待评审”；新增4档真实loopback TLS固定负载及离线lane和条件预算，未优化策略或建立生产队列。

物理最坏延迟/漂移、OS真实睡眠时序、16设备并发/多日、发行签名/秘密、ESP/Flash/v5门槛没有被替代。376属于此前服务装配阶段，当前全套385；历史报告仍有效。

## 原当前系统片段

内部旧链接按原current-system.md解释，通过上方报告导航。

```text
2026-10-30服务装配/电源/容量：check（仅.mjs语法）及test（含构建）全套376项通过，本切片新增17项；原P1/会话/TLS组合51项回归通过。startOrAttach仅UDS赢家创建managed review元数据/会话owner/电源源，真实两进程只启动一个观察源；不同配置拒绝attach、半初始化503、挂起已有UDS在统一期限失败而不回收。默认/CLI/插件不启用，deviceTransport=false，无设备listener或旧数据迁移。见[报告](../reports/2026-10-30-service-power-capacity.md)、[契约](../protocol/service-power-capacity.md)、[替代历史](history/service-power-capacity-evolution.md)。

managed会话改为同socket/context/generation的一次性不可序列化admission，不累计全部历史ID；320次真实串行TLS重连，每次session/pending/task及历史集合回落0，旧proof/旧context/伪造票据拒绝。旧直接context入口仍限256；16设备并发、多日/RSS及逐块证书/磁盘查询负载未验。正常与SIGTERM取消临时环境均已清理；签名/密钥、物理电源周期、ESP/Flash/v5与时延资源门槛仍NO_GO_UNTIL_MEASURED。既有[绑定/会话CAS与故障恢复](../protocol/session-consistency.md)能力保持，最后actual与历史观测仍区分。
```

## 原下一实施入口

```text
1. **电源时序与承载负载准入**：服务选主后装配、真实macOS观察源注册/退出与managed历史回收已完成，见[报告](../reports/2026-10-30-service-power-capacity.md)，不重复原型。下一先补Spec/Diff审查每4KiB证书/同步元数据复验、队列/分段/重传的负载及最坏延迟证据，明确helper发布签名/秘密引用与旧数据迁移；物理主机睡眠/唤醒需先具体窗口/观测/回退方案，不自动让电脑睡眠或开启生产listener。
```

## 原活动协议成本描述

service-power-capacity原段：

```text
这是固定单设备串行回收验证，不是16设备并发/多日/RSS硬预算。逐4KiB授权复验仍会检查证书与同步元数据，实际吞吐/磁盘成本和最坏时延未测；不以短样本耗时替代1900ms/500ppm假设的准入依据。
```

lease-budget原“后续”段中服务装配/宿主验证状态一并收敛；数学guard与回退未变：

```text
scripts/verify-lease-budget.mjs运行精确有理数速率矩阵并复用11条验收生成摘要（非额外独立测试）；没有socket/设备/TLS。矩阵还刻意验证超预算延迟、host停顿的反例，不能跨假设套用。离线认证proof及候选v5 TTL表示已有后续实现；实测时钟/误差、生产TLS owner装配、休眠恢复及固件v5互操作仍待实现/准入。
```
