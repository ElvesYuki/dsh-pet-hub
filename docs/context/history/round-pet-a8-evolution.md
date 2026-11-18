# A8根权威持久化演进

2026-10-30。A8显式新profile以同文件绑定/根CAS替代“A7仅手工检查点、权威持久化未实现”的当前状态；旧v1与A7默认保持无迁移。跨进程可信锚/整盘回滚、生产rollout/物理断电仍未完成。[报告](../../reports/2026-10-30-round-pet-a8.md)、[API](../../protocol/round-pet-a8.md)。以下原文相对链接沿用原位置。

## 原当前摘要

```text
2026-10-30 A7会话与根维护候选：check（仅.mjs语法）与test（含构建）全套658项通过，新增24项；独立CLI24项及素材环境创建后的SIGTERM均清自有临时环境，见[报告](../reports/2026-10-30-round-pet-a7.md)。A1受信beginSession按完整context切换revision，清旧票据/RAM/stage/read lease，保留Flash/未知与held画面，不reboot/重扫。A6临时真实TLS链已验证同actor/medium/boot跨新hub owner后manual_1、旧context回调拒绝。[API](../protocol/round-pet-a7.md)、[替代记录](history/round-pet-a7-evolution.md)。

A3/A4/A5内部显式rootCheckpoint保留binding/N、floor、最后完整根及未查询提交的floor_commit对象；新owner仍须新库存/控制。恢复低root/同seq根或提交对象冲突失败关闭，稳定原因保留；错误binding hello回收会话，配置副本在异步选主前固定，无页面导入/清floor/rebind入口。生产默认OFF/deviceTransport=false保持。

只读维护评审不降低floor、不启用写入；内存medium移除模拟损坏后，新认证完整根达到原floor可恢复候选库存。deferred取消/提交/marker未知竞态已对照，取消不能撤销已提交根或把unknown变未保存，历史saved不由库存补造。A5磁盘reader/pin实际退出、A6首帧/淘汰/故障向量保持；模型画面和内存Flash不是物理证据。

**检查点仅caller自有临时文件交接。生产自动持久化、权威CAS/耐久事务、缺失/旧文件/崩溃恢复及磁盘防回滚仍未实现**；默认不传检查点仍无跨owner floor持久保证。A7会话/维护候选须固件接受C04/C07/C08/C12，真实包/Node-C++、G1/G2资源/可信时间/凭据/退出上界及独立设备窗口保持。自动重试0，无生产listener/自动联网重连或插件启用。

```

## 原下一入口

```text
2. **根检查点权威持久化与崩溃恢复**：先补Spec/Diff，设计绑定状态与floor/完整根/未查询commit对象的一致权威、CAS/耐久顺序、缺失/旧文件/坏档/commit_unknown和崩溃切点。A7仅受信临时caller文件交接，默认A5不自动持久化；schema/摘要不提供防回滚或新信任批准。先独立临时环境对照，另审磁盘回滚/系统秘密边界，不清floor、不自动rebind或接设备。
```

658项/24专项为A7当时结果；A8新增34项，最新总692。新profile只独立临时验证，不把SHA/fsync或新格式当防回滚批准，历史报告不改写为生产/真机证据。
