# A9 持久化负载与延迟复评

2026-10-30。[实现前Spec](../context/plans/round-pet-a9-spec.md)/[Diff](../context/plans/round-pet-a9-diff.md)、[实测报告](../reports/2026-10-30-round-pet-a9.md)。只测独立临时Node/本机文件系统/loopback，不是生产准入、设备Flash或最坏延迟证明。

## 可选计量

沿用createLoadMetrics固定直方桶、count/failed/total/max与数值计数；新增ROOT_METRICS和ROOT_COUNTERS，不接日志/原始状态，不保存逐条无界样本。默认无metrics时不采样；原v1默认输出及计量口径保持，A8格式/CAS/投影顺序/队列/TTL保持；成本减量后续见[A10](round-pet-a10.md)，本页full口径作参考。

| scope | 口径 |
| --- | --- |
| root_prepare / root_publish | A3私有候选准备；发布包含新readView的session/截止复验与commitPrepared |
| root_exchange | 持久profile整个同步exchange（含非根记录），不包含socket发送或客户端网络等待 |
| root_commit / root_transaction | commitRoot整体；persist整体（含编码/锁/CAS/写/同步/清理），嵌套不可相加 |
| root_checkpoint_validate / root_encode | 单个输入检查点验证；全content校验+规范摘要+JSON编码，发生在CAS锁前；full不变根也做，A10 reduced锁内完整校验/CAS后省略noop编码 |
| root_lock / root_cas / root_lock_release | wx获取；锁内完整加载/revision及noop一致性；关闭/删自有锁。已有可见锁可能在更早readData就拒绝，无自动等待/重试 |
| root_file_write / root_file_sync / root_rename / root_directory_sync | 对应现有系统调用；成功次数与逻辑写字节另计，不能当物理盘流量/断电耐久 |
| root_remember | v2当前实例revision/摘要检查；full含额外规范摘要；A10 reduced复用同次已验digest，发生在metadata_load之外 |

metadata_load本来已含文件权限/类型/JSON/完整摘要/schema；root_remember不是省略此检查的缓存。TLS动态日期/撤销及每新scope/4KiB块的完整权威校验保持。新增全文件根元数据/重校验可能增加成本，当前没有跨请求mtime/TTL快路。

计数包括root提交/noop、锁尝试/获取、CAS、编码与实际写字节、文件/目录同步和rename。asset_write按真实res.write提交次数/字节计，不等于设备收到/安装。初始PKI/绑定/预置根/握手不混入warm窗口；握手及cold静态次数另存。1000空measure的整批开销另计，不从业务样本扣除。

## 四档同负载

v1/显式v2 × 1/64绑定，每档只有D一个活动TLS peer，64指登记记录而非64连接。每档3轮，同15个控制kind轨迹、51个exchange、18个素材段和541689B（3×180563B原创241帧PET4）/135个4KiB写调用。v2其余绑定持同形状根，v1本来无root字段，文件大小差是格式固有成本。每轮先实际下载核F/241帧CRC，再发送verified及合成saved/完整根；saved仍是Node peer声明，非本轮真实Flash提交。

使用A4内存media provider隔离元数据成本；A2磁盘reader/A1执行闭环沿用已有A6/A8证据，本测量不扩张为磁盘素材吞吐或真实完整46库。临时端点每档关闭并等实际socket/HTTP/read退出。根/非根业务顺序不因metrics启用改变。

最大字段容量另测长ID、uint64上限、4活跃及floor_commit，保留131072B/64门禁。注册和首次root是两个明确操作：首次root超限可能保留已显式登记、root=null的绑定；不得把它称完整离线库存或自动删绑定回滚。失败前后实际文件核对，不自动扩容/逐出。

## 预算与截止

rootPersistenceBudget只收root_service_ms整数假设，绝不取样本max。B=旧假设1900+R，RTT=ceil(2B×1.0005)，现有leaseSendBudget按15000ms/双端500ppm/margin10计算发送跨度；分别检查server服务2000、fixture client1500、ack/guard RTT4000和lease跨度。服务条件只检查R本身，完整请求还需网络/处理等上界，复用旧双向B的收紧模型，可能保守重复收取host服务；所有条件fit也不等于物理准入。

R=100ms时RTT4002超过4秒，即使lease仍有余量；不能延15秒TTL掩盖较短deadline。R=5000ms时请求/回执/租约条件均不满足。B组成仍是旧保守假设（segment1000/poll500/network200/process100/dispatch100），并非本次测得的网络/调度上界。

虚拟时钟负例保留pending至durable完成：恰4000返回不发布/下发，已持久floor保留；3999时server可在自身ack截止前发布，但共享测试时钟的client已过1500而拒收，不能用“server200”替代client期限。撤销、写前/rename后错误、准备状态不可见仍失败关闭。同步fsync不能由JS timer硬抢占；冷盘、OS挂起、重传、设备让出/取消和物理漂移未知，NO_GO_UNTIL_MEASURED不变。

## 运行、证据与回退

```sh
npm run check
npm test
node scripts/verify-round-pet-a9.mjs --output .cache/round-pet-a9/results.json
```

14专项。CLI只在全部通过后读私有临时root-load-observations.json，严格校验固定字段、数值/桶、四档参数/轨迹/字节一致与预算函数结果，再输出去敏摘要。非法字段/部分失败/取消不导出观察。证据校验和测量helper位于scripts/tests，预算位于simulator，不进插件候选；仅可选计量包裹既有runtime。

回退关闭自有TLS/Agent/actual HTTP、会话/store与临时目录/PKI，撤回metrics/测量入口；不迁移v1/v2、变更TTL或运行配置。生产listener、真实包/共同wire、可信恢复/防整盘回滚、G1/G2和设备窗口未关闭。[A10](round-pet-a10.md)已按独立Spec/Diff完成局部减量及同负载/负例，保持完整验证，full测量参考仍保留。
