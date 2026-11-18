# A8 根检查点权威持久化与崩溃恢复 Spec（实现前）

2026-10-30。按当前下一项先分析后实施。已读AGENTS/开发/维护规范、摘要与A7、binding-store/managed/pull/A3/assembly实际代码。保留修改、不用子智能体；只独立临时文件/PKI/UDS/loopback与模型，不碰固件/设备/pet/bridge/DSH，不开生产listener/装插件/提交推送。

## 分析与选择

A7仅caller交接检查点；绑定文件与单独root文件若分别写，可能凭据/epoch与floor不一致。采用**同一权威文件、同一CAS revision**的显式新profile：hub-binding-roots/1、content schemaVersion=2，在每个绑定记录内放root_checkpoint（新注册为null）。旧hub-bindings/1/schema1默认路径保持严格，不自动升级/迁移、补字段、重建坏档或从A7临时文件自封信任。

新profile需在自有临时目录显式创建；服务只open现成文件。managed owner唯一持有store，TLS/Registry/根状态共用权威。rootPersistence={profile:binding-roots-review/1,device_id}仅内部显式装配，与手工rootCheckpoint互斥，进入选主配置；默认OFF、没有新CLI/页面导入/清floor/rebind。绑定rotate/revoke保留根；mapping普通commit不得改根。绑定epoch/身份不匹配拒绝，不自动承接旧root。

## 提交与可见顺序

1. 在现有同步只读revision scope内认证/校验完整record，A3准备私有一次性候选，并立即恢复旧投影；候选未提交时不能显示saved/known或发下一控制。
2. 离开readView后按同一权威revision持wx锁、CAS复核绑定/凭据/root，写临时文件→file fsync→rename→directory fsync。禁止在readView中写；并发rotation/revoke/revision冲突失败关闭，不盲重试。
3. 成功后才提交A3候选/ack关联/返回下一控制。写前失败保旧投影/文件；rename后异常=storage_commit_unknown、全store准入冻结。候选取消、旧session和写失败不报已确认。
4. root变化单调合并：floor不降、同seq完整根与floor_commit一致、已有提交对象不能被同floor遗漏；更高完整根可淘汰旧对象证据。无变化仍锁内核CAS，但不写/不推进revision。

## 恢复与安全边界

文件权限、类型、O_NOFOLLOW、大小/schema/摘要与遗留写锁继续验证；缺失/坏档/版本错误拒绝，不自动create或回退备份。SIGKILL遗留锁不自动删，测试父进程仅在证明自己的子进程退出后清其临时锁以核对提交切点。已有有效权威记录恢复为unknown库存，仍默认OFF、新TLS/hello/查询；不恢复命令、lease或旧saved历史。

显式rootState实例可记录已见revision/digest，拒绝当前生命周期内的旧revision/同revision不同内容。**新进程无法仅靠同盘旧合法文件判断整盘回滚或删除后重建**；不将SHA/rename/fsync当防回滚签名或物理断电证明。跨重启可信锚/OS秘密/备份恢复/签名另审，当前仍非生产准入。保持现有131072B/64绑定上限，满额元数据容量与持久写延迟另测。

## 实现、验收和回退

局部扩展binding-store新profile/根CAS、managed受信authority、A3准备/提交/取消候选、A4根记录分阶段与A5内部装配，旧默认fast path/scoped减量不重做。新增临时profile fixture、存储/真实TLS/进程崩溃向量和监督CLI。

验证：版本互斥/无迁移、缺失/坏档/锁/symlink/权限、单CAS/无变化、单调与提交对象、mapping/rotate/revoke、并发revision冲突、rename/fsync前后异常、SIGKILL切点、当前实例回放检测/新实例局限、候选未提交不可见、实际saved/库存持久重启/无手工检查点、失败保旧投影/不发下一控制、默认OFF/选主/清理。最终check/test保持658基线，独立CLI和SIGTERM清理。复用原创241帧PET4/模拟Flash，非真实角色/设备预算。

回退关自有peer/server/owner、等实际I/O与worker/pin释放后删除自有临时新profile；旧v1与A7手工profile无迁移，不将v2改名冒充v1。生产rollout/真实源批准/Node-C++/固件共同G0、G1/G2/设备窗口仍未关闭。

实施状态（2026-10-30）：本Spec/Diff先于代码建立；34专项、692全套和独立CLI正常/中断清理通过，见[报告](../../reports/2026-10-30-round-pet-a8.md)、[API](../../protocol/round-pet-a8.md)。原A7摘要已[归档](../history/round-pet-a8-evolution.md)。新增成本/最坏延迟、跨进程可信锚/整盘回滚/物理耐久、生产迁移及共同G0/G1/G2/设备准入保持待验。
