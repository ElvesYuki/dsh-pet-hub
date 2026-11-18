# A5 默认关闭装配候选与恢复 Spec（实现前）

2026-10-30。范围为用户授权的独立临时离线整合，不接设备、不启用生产listener、不读写固件/pet/bridge/现有DSH，不安装插件、提交推送。已读AGENTS/开发和上下文规范、当前摘要、A2/A3/A4及service/managed/session/worker。保留修改、不使用子智能体、零依赖/原创MIT。

## 装配与默认关闭

service新增仅内部显式roundPetAssembly(profile=offline-review)，与simulation/source/managed/旧observationReview/materialImport互斥；配置身份进入UDS选主匹配。默认无该选项，无新增CLI、插件Config或页面控制方法；只有赢家创建A2 worker/元数据/会话/电源观察源。初始化异步返回validating，准备完成仍disabled，不自动listen、acquire或发base。

同owner组合A2严格导入/独立批准/CAS/provenance、既有managed session/scoped及电源源、A3投影、A4 pull/handler。handler只可由受信测试owner显式enableReview后用于loopback，并逐请求核socket本地/远端literal127.0.0.1；本模块不创建TCP服务器。UDS/status和宿主白名单/共享UI只读展示状态，现有仓库list/明确cleanup复用同lifecycle。页面不能启用、hello、控制或保存。

## 磁盘素材与保护

A2 worker在**同一个已全验SHA/CRC的fd**上记录前后稳定的inode/dev/size/uid/mode/mtimeNs/ctimeNs指纹，并作为内部临时结果返回，不能进入IPC/Git/provenance。strict reader只接该已验证版本/manifest/F及proof，按固定CAS blobs/hash读取≤4KiB；每次open拒绝目录/叶symlink、坏权限、非普通文件、替换/改写，read前后fstat匹配worker证据，不每块重验全库或将mtime当认证快路。无完整库驻留、无永久fd缓存。caller-owned私有目录不是OS对恶意同uid/root的沙箱。

A2 import pin持续到HTTP/read退出、会话/源和reader关闭后才释放；清理不能删正在校验、装配、读取或关闭中的版本。不新增设备选择磁盘格式；固定审核版本由独立输入I/approval重新提供，A2来源/素材持久，manual意图与控制/租约不持久、不自动重放。provenance不是永久设备选择；真实设备偏好/初始身份与生产配置留后续准入。

## 初始库存与写入门禁

每个新hello/open均先登记新的inventory查询；不沿用上会话known，也不因N相同就批准对象。初始unknown阻止base/保存；query不需要控制权，lease可显式申请但不能替代库存。EMPTY仅允许idle0建立默认；IDLE_READY只允许0/4，先补4；OFFLINE_READY才放开固定角色动作。新root或保存unknown使当前性unknown，必须新认证完整库存恢复，旧查询/部分列表不解锁。

save必须当前target已经verified/playing、当前库存known、guard有效且非uncertain；相同N/id/F映射已有时不重复强制保存。缓存满且目标不在根，需显式victim_action_id；0/4不得作其他动作victim，当前引用外/当前目标不允许，不默认挑1/11。入队与实际派发再次检查，排队后的root/目标变化不能绕过门禁；新增victim字段仅A4候选payload显式可选，不宽放旧生产wire。真实Flash磨损/本地触摸read lease策略仍由固件Store执行，本轮不伪造。

## 停止、休眠与恢复

enableReview需ready可信时间/电源源状态并等旧HTTP实际退出。disable/suspend/source失效先关闭准入、失效A4/session、清租约/查询/队列，等待handler真正结束；不在退出前释放素材pin或开新承载。resume只恢复managed readiness，review仍disabled，须显式重新启用、新TLS/hello/acquire/库存；旧manual/save不重放。

close可重复：先禁准入/使I/O失效→等待实际handler/read退出→关闭managed/power、reader→终止A2 worker/释放pin→等lifecycle idle。close发生在校验/初始化期间要取消并等待初始化真实结束，旧ready不能复活。失败逐项清理且保留错误、坏CAS/provenance不修复/覆盖；失败/未知不自动重试。暂不实现自动联网退避，评审记录独立重连仅可在退出完成后进行。

## 验证、交付与回退

原创46描述/241帧包、临时PKI/UDS/真实loopbackTLS、虚拟时钟/电源事件，验证A2磁盘Range→A4→peer最终F/CRC→A3/UDS/代理只读投影；初始unknown/EMPTY/默认集合、verified门禁、满缓存显式victim/保护0/4、root变更及保存unknown、坏文件/路径/权限、配额/清理pin、赢家/attach配置、取消初始化/迟到I/O/休眠/重开无源不重放。保持563回归，运行check/test及隔离CLI/取消清理。

输出活动API/报告，更新当前摘要/差异/交接/待办，按主题归档旧A5未实现。设备资源准入、真实包许可/共同wire、G1/G2、生产listener、A1实体actor/真机Flash/掉电均未关闭。回退关闭自有review服务/loopback/PKI并撤回专用入口；默认旧配置与A2仓库格式不迁移，现有外部服务及前瞻/a7/V2 N不动。

实施状态（2026-10-30）：本Spec/Diff先于代码建立；范围内41项离线专项及604全套通过，正常/中断清理已验，详见[报告](../../reports/2026-10-30-round-pet-a5.md)和[活动API](../../protocol/round-pet-a5.md)。保留上述生产/设备/共同G0与G1/G2限制。
