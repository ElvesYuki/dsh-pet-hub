# A10局部重复工作减量演进

2026-10-30。A10替代A9“noop全文件编码/已验摘要仍重复”的当前状态与减量待办；保留A9四档负载、容量与条件预算口径，文件/CAS/动态检查、durable后发布及物理待验限制保持。旧报告为当时证据，不覆盖重写。[A10报告](../../reports/2026-10-30-round-pet-a10.md)、[API](../../protocol/round-pet-a10.md)。

## 原当前摘要

```text
2026-10-30 A9持久化成本复评：check（仅.mjs语法）与含构建test全套706/706通过，新增14项；独立CLI14项及同负载证据通过，SIGTERM清自有环境且不导出部分观察；容量/条件预算见[报告](../reports/2026-10-30-round-pet-a9.md)、[API](../protocol/round-pet-a9.md)、[替代记录](history/round-pet-a9-evolution.md)。可选数值metrics量锁/CAS/编码/文件及目录fsync/额外摘要/候选准备发布，A8格式、scoped/动态校验、提交顺序、队列/TTL未优化或变更。

四档v1/v2×1/64绑定，各3轮、同15控制/51 exchange、541689B/135个写调用，只有一个活动TLS peer。v2完整metadata load225→308；64绑定逻辑读取3.76MB→24.03MB，root_commit样本max14.323ms；均非物理盘流量/最坏上界。每档8次root提交/7次文件与目录同步/1次noop；noop不写但仍编码一份77934B元数据，64绑定额外root_remember摘要累计77.569ms，可作下一减量候选。

最大字段容量为64登记/63有根、129724B，第64条首次root超131072B并保持文件；不能承诺所有字段极值64根都装入。预算不使用样本max：旧B1900假设加R100ms得RTT4002，虽lease有余仍超过4s回执。server2000、fixture client1500、ack4000与lease15000独立约束；边界/撤销/写失败仍关闭，不延TTL。

A8显式同文件绑定/根CAS、私有候选后durable发布、新owner恢复继续有效；默认v1无迁移，v2仍OFF/新库存/控制，无公开清floor/rebind/生产listener，deviceTransport=false。新进程不能识别同盘合法旧文件回放，SHA/fsync不是批准或物理掉电证据；同步FS停顿不可被JS timer硬中断。下一减noop编码/重复已验摘要须先Spec/Diff、同负载和坏档/冲突/unknown回归，不引入跨请求mtime/TTL快路。冷盘/真实时延/可信锚、共同G0/真实包/Node-C++/G1/G2/设备窗口保持NO_GO。
```

## 已完成的原待办

```text
2. **不变根编码与已验摘要复用减量**：先补Spec/Diff，针对A9已测的noop全文件编码和rootState额外重复摘要做局部减量，保留锁内CAS、完整坏档校验、实例revision防回放、每新scope/4KiB动态日期/撤销及发布前截止。不能引入mtime/TTL跨请求快路、清floor或延lease。完成同负载/容量与写失败/冲突/unknown负例对照；冷盘/物理上界/可信锚另审。
```

706是A9阶段全套数量。A10同次新跑full/reduced，不复用A9旧JSON时间作对照；生产/固件/设备准入不因局部减量自动升级。
