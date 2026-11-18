# A9持久化成本复评演进

2026-10-30。A9补齐A8新增路径的宿主同负载/容量/条件预算证据，替代“待专项量化”的当前状态；物理最坏上界/冷盘/OS停顿仍未知，未做优化或延TTL。[报告](../../reports/2026-10-30-round-pet-a9.md)、[API](../../protocol/round-pet-a9.md)。以下原文相对链接沿用原文件位置。

## 原当前摘要

```text
2026-10-30 A8根权威持久化候选：显式hub-binding-roots/1/schema2把绑定/凭据与root_checkpoint放在同一文件、同一revision CAS；旧v1不自动迁移。新profileA5从权威自动恢复，无需A7手工文件，仍默认OFF/新库存/新控制。check（仅.mjs语法）与含构建test全套692/692通过，新增34项，独立CLI34项及素材环境创建后的SIGTERM均清自有临时环境，见[报告](../reports/2026-10-30-round-pet-a8.md)，[API](../protocol/round-pet-a8.md)、[替代记录](history/round-pet-a8-evolution.md)。

A3先准备私有候选，A4离开readonly view后durable CAS，返回后复核session/队列截止，再发布/ack/派发。写前错误保旧文件与投影，rename后unknown冻结store；超期即使已落盘也不发布/继续下发。相同根锁内验证CAS但不写/不增revision，mapping不能改根，rotate/revoke保留根。显式rootPersistence与手工checkpoint互斥、进入选主身份，无公开清floor/rebind路由。

实例内检测旧revision/同revision改写；4个SIGKILL切点与写前/rename后异常、真实TLS/模型saved重开已验证。遗留锁只阻塞，测试确认自有child退出后才清其临时锁，产品不自动清锁。缺失/坏档/权限/版本错误不重建；新profile仅服务open现成私有目录，不自动初始化已有绑定。A5持pin实际退出/A6首帧与故障/A7会话命名空间和低root维护继续有效。

**新进程不能仅凭同盘合法旧文件识别整盘回滚**；SHA不是批准，fsync/进程崩溃不是物理掉电证据。同步写入停顿不能由JS timer硬中断，新增锁/CAS/fsync/投影复验的负载/最坏延迟待专项，不能延TTL准入。生产初始化/迁移/可信锚/恢复批准、共同G0/真实包/Node-C++、ESP G1/G2和设备窗口均未关闭。默认服务无新持久profile或生产listener，deviceTransport=false，自动重试0。

```

## 原下一入口

```text
2. **持久化负载与延迟复评**：先补Spec/Diff，量化显式v2 profile的锁/CAS、文件/目录fsync、候选复验和元数据容量对控制/lease/素材段的成本及最坏等待；做同负载/故障对照，不将loopback max当上界或延TTL。跨进程可信锚/整盘回放、生产初始化/迁移/撤销恢复及物理掉电另审，不自动启用通道或升级v1。
```

A8的692项/34专项是当时证据，A9新增14项后706项。新增计量不关闭生产可信锚/物理耐久/固件资源门槛，历史A8失败关闭与进程崩溃结果继续有效。
