# A8 同一绑定权威中的根持久化候选

2026-10-30。[实现前Spec](../context/plans/round-pet-a8-spec.md)/[Diff](../context/plans/round-pet-a8-diff.md)、[报告](../reports/2026-10-30-round-pet-a8.md)。仅独立临时宿主验证，不启用生产listener或修改现有绑定/服务。新profile显式隔离，不能用它自动升级旧目录。

## 同文件权威与版本

`openBindingStore({directory,rootState:true,create})`选择hub-binding-roots/1封套、content.schemaVersion=2。绑定记录保留原身份/凭据/state/mapping，增加必须存在的root_checkpoint（新注册只能null）；原v1默认路径仍hub-bindings/1/schemaVersion=1，双方拒绝互开/静默迁移。文件上限131072B、64绑定不扩大，容量不足明确失败。

rootCheckpoint(device)和commitRoot(expectedRevision,checkpoint)是受信内部接口；checkpoint字段沿用A7的binding/N/floor/最后完整根/floor_commit，不存图片、私钥、端口、网络配置或原始响应。root/绑定/凭据共用一个revision、摘要和写锁，避免双文件一致性问题。普通mapping commit不允许改root；rotate/revoke保留root，撤销准入后不能新写根。

commitRoot检查binding/epoch与准入、单调floor/完整根和同floor提交对象，锁内再核CAS。内容不变时仍锁内验证revision，但不写、不递增revision。高根可合法逐出旧对象；低根/同根冲突不通过“恢复”重置。root记录不等于素材批准，A2独立approval继续必需。

## 准备、持久提交、投影发布

A3新增prepareIngest、commitPrepared、discardPrepared：prepare校验原认证proof/四流规则，在私有候选上计算后恢复旧状态，返回一次性opaque ticket和checkpoint；至多一个候选。候选期间公开状态读取拒绝root_commit_pending，不能提前看见known/saved。close丢弃未提交候选，不发确认。

A4仅在显式rootAuthority路径分阶段处理inventory/storage记录：

1. 现有同步readView中认证/关联/准备候选并记权威revision；保持控制pending及unknown写门禁，不派发下一控制。
2. 离开readView，再用同一store的revision执行durable CAS。拒绝异步authority，不能把Promise当提交完成；并发修改导致revision_conflict并失败关闭，不盲重试。
3. 再开同步view核session/队列截止，成功后才commitPrepared、ack控制和更新storage门禁，随后计算下一控制/permit。若提交返回时控制已超期，磁盘新floor可保留，但候选投影丢弃并关闭会话，不继续下发。

默认无rootAuthority的A4路径保持原行为/计量口径。新profile多出写锁、元数据CAS、fsync及投影提交复验，未作新负载/物理延迟上界测量。同步文件系统停顿不能由JS timer硬中断，不因此延长lease/HTTP TTL；A9成本样本见后续报告，不能转作物理上界。

## 磁盘提交与故障

持wx写锁→读当前revision做CAS→临时文件写入/fsync→rename→目录fsync→成功返回。rename前错误storage_failed，旧文件和投影保持；rename后错误storage_commit_unknown，整个store准入冻结，不自动重试/解冻。新floor未持久成功不发布给UI，已落盘但未发布的floor在新owner重新恢复。

缺失只在显式create的新目录初始化；服务只open，不自动create。坏JSON/schema/摘要、权限、symlink、错误版本、遗留锁均拒绝，不自动修复、删锁或回退备份。SIGKILL可能留下临时文件和锁；测试父进程证明自有子进程已退出后，才在其临时目录清锁检查切点，**这不是产品自动恢复功能**。物理断电/磁盘缓存/OS耐久语义尚待验证。

rootState实例记已见revision/digest，拒绝其生命周期内旧revision或同revision不同内容。这不等于跨进程防回滚：新进程面对完整合法旧文件/整盘快照没有外部可信锚就无法辨别。SHA用于损坏检测，私有权限不隔离同uid/root；测试明确演示该局限。跨重启可信锚、秘密存储、备份恢复和恢复批准另审，仍NO_GO生产。

## 默认关闭装配与恢复

A5内部显式rootPersistence={profile:binding-roots-review/1,device_id}选择现成v2目录，与手工rootCheckpoint互斥。规范化副本进入选主匹配；同一赢家拥有store/session/根authority，attach不创建第二worker或power源。TLS open限定所选device；新owner从同一文件读取根，但ready仍disabled，库存unknown，需显式enable/new TLS/hello/acquire/查询。

无新CLI/插件Config/公开恢复或清floor路由。默认不传则继续原v1/手工模式，不能称默认服务已提供自动耐久根恢复。真实saved经A6模型→A4 TLS→v2文件提交后，新owner不依赖A7手工检查点文件也可恢复floor/提交对象；旧命令/lease/saved历史不重造，当前可用仍由新完整库存确认。

## 验证、限制与回退

```sh
npm run check
npm test
node scripts/verify-round-pet-a8.mjs --output .cache/round-pet-a8/results.json
```

34专项，原658回归保持；临时PKI/UDS/loopback、原创241帧PET4和内存Flash、4个SIGKILL切点、写前/rename后异常、并发/异步/超期拒绝。不是完整46真实库或物理设备负载。回退关闭自有peer/server/owner、等实际HTTP/worker/pin退出，删除自有临时新profile；旧v1/A7文件无迁移，不将v2改名冒充v1。固件/pet/bridge/DSH、V2 N和前瞻/a7不动。

剩余：持久profile负载/最坏延迟、跨进程防整盘回滚/可信恢复和物理掉电、生产迁移及绑定生命周期、共同wire/真实包、G1/G2/设备窗口。不得据宿主CAS/fsync样本关闭这些门槛。

## A9后续计量

[A9报告](../reports/2026-10-30-round-pet-a9.md)已量锁/CAS/编码/同步/重复摘要及相同负载：v2完整load225→308，7次同步/1次noop；容量64登记/63最大字段根。未优化本协议顺序/TTL，后续[A10](round-pet-a10.md)已完成局部减量及完整坏档/动态校验/冲突/unknown回归，文件/投影顺序/TTL保持。
