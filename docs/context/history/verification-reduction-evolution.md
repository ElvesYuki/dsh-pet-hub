# 重复复验减量演进

2026-10-30。替代范围：此前“默认无证书缓存、每session三次加载、下一步尚待设计复验减量”的当前描述。scoped已在本仓库宿主验证，full仍保留参考；4KiB检查点、动态日期/撤销、坏元数据拒绝和物理准入限制有效。当前见[报告](../../reports/2026-10-30-verification-reduction.md)与[契约](../../protocol/verification-reduction.md)。历史385项属负载评审阶段，当前全套399。

以下旧片段中的链接按原文件解释，通过上方当前报告导航。

## 原当前系统摘要

```text
2026-10-30承载负载/延迟：check（仅.mjs语法）和test（含构建）全套385项通过，新增9项专项；独立CLI正常、SIGTERM取消和非法证据拒收均清临时环境；已修复终止报错跳过目录清理，注入EPERM时明确失败仍删自有根。4档真实loopback TLS各4轮原创70001B资产，比较1/64条绑定、4/16KiB写块与8/32KiB Range；默认认证/4KiB写块不变。每次session检查复验1次证书、3次元数据load；64条/4KiB/32KiB档传280004B素材伴随6140160B逻辑元数据读取，说明重复复验成本，非真实磁盘流量。见[报告](../reports/2026-10-30-transport-load.md)、[契约](../protocol/transport-load.md)、[替代历史](history/transport-load-evolution.md)。
```

## 原下一实施入口

```text
1. **承载复验减量与电源发行准入**：[负载报告](../reports/2026-10-30-transport-load.md)已完成4档固定宿主成本/队列评审，不重复测量原型。下一先补Spec/Diff区分证书静态缓存与每消息日期/撤销、单次一致revision视图，明确外部写入/损坏/锁/提交不确定的失效契约后，再做同负载与块间负例对照；默认验证策略未优化，生产lane未装配。同步明确helper发布签名/秘密引用与旧数据迁移；物理睡眠/唤醒仍须具体窗口/观测/回退方案，不自动睡眠或开启生产listener。
```

## 原活动协议口径

transport-load：

```text
当前成功session检查：一次完整叶复验，lookupByFingerprint先read再isAdmitted/read，session owner另isAdmitted/read，合计3次metadata load。成功素材段在入口和每次写前各检查一次，因此段成本为`1 + ceil(段字节/写块字节)`次session检查。模型renew一次包括begin、两次路由检查、accept，另attest及proof复验，共6次叶复验、19次metadata load；Registry仍独立复验。没有缓存、文件一致性策略或密码学优化。
```

session-consistency：

```text
read每次重新读取并验证私有权限、O_NOFOLLOW文件类型/长度、版本/字段/摘要；锁存在则拒绝。缺失只有显式create才初始化，坏档、dangling symlink或遗留锁都fail closed。提交用wx短期写锁、锁内读当前revision做CAS，临时文件fsync→rename→目录fsync；成功后才推进revision。锁只是文件写互斥，不能替代hub服务选主、设备端fencing或物理掉电测试。生产接入仍必须复用已有单实例所有者。
```

## 原决策复审入口

```text
证据：[9专项/385全套、固定计数/样本及清理报告](../reports/2026-10-30-transport-load.md)，旧成本未测描述见[归档](history/transport-load-evolution.md)。仅替代宿主成本未知；生产调度/设备listener、签名/秘密、物理电源和ESP准入未放行。下一Spec先明确静态证书缓存/动态日期撤销与一致revision视图及外部写入/坏盘发现契约，确认失败关闭语义后才优化，不以删除动态复验换吞吐。
```

未替代：生产设备listener/控制队列、物理网络/盘/CPU/漂移/睡眠上界、helper发行/秘密、ESP/Flash/v5，仍不准入。同步scope不能提供跨进程事务或即时撤销；同尺寸保mtime坏档仅在下一scope首次完整读取发现。此前负载报告和预算反例继续作为full参考与设计证据。
