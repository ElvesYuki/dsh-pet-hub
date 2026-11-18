# A5 默认关闭装配与恢复候选

2026-10-30。[实现前Spec](../context/plans/round-pet-a5-spec.md)/[Diff](../context/plans/round-pet-a5-diff.md)、[41专项/604全套报告](../reports/2026-10-30-round-pet-a5.md)。只限隔离宿主候选，未定版设备wire，不创建生产listener。[A6](round-pet-a6.md)已另接A1模拟执行；真实Flash/面板、共同G0/真实包、固件G1/G2仍待验。

## 所有者与入口

`startOrAttach({directory,roundPetAssembly})`是受信内部入口，参数profile必须offline-review；与来源、simulation、managedSessions、旧observationReview及materialImport互斥。纯descriptor检查在选主前进行，批准摘要、I或源路径、能力、controller/CA/policy/power identity/readBudget进入配置匹配；函数和秘密不写descriptor。仅UDS赢家创建A2 worker、managed binding/session/power和A4 pull；attach不创建第二套资源，不取代赢家。默认不传此参数，没有新增CLI/插件Config。

显式owner的`roundPetAssembly`提供ready、enableReview/disableReview、createHandler、acquire/renew/manual/save/query/cancel、snapshot/resources/waitForIdle/close。均为受信内部方法，没有UDS或浏览器控制写路由；不是配置API。ready异步，失败reject并清资源；成功只到disabled。enableReview等待初始化与旧HTTP真正退出，核managed ready/未失效reader；不自动建TLS或hello/acquire。manual返回内存target，其revision生命周期单调，不持久或重放。

createHandler只返回handler；调用者显式启用后才允许literal127.0.0.1双向socket，非loopback或disabled返回503。真实TLS验证、hello与A3 proof沿用A4/managed，不因loopback省略认证。A5不调用listen；仅测试fixture在自有动态端口临时挂载，caller负责TLS服务器、客户端/Agent及实际socket退出。生产LAN入口需独立实施和设备准入。

GET status增加schema_version=1、profile=round-pet-assembly-review/1的assemblyReview，只有phase、review_enabled、production_listener=false、稳定error、inventory_confirmed、write_gate及有限资源计数。A3 observationReview同一owner投影，顶层devices=[]、deviceTransport=false；不把候选peer列成正式设备。宿主代理和共享UI再白名单化，仅展示，无enable/manual/save按钮或路由。

## A2磁盘reader与生命周期

A2 worker在同一安全fd上完整验证SHA和241帧CRC，并前后核对dev/ino/size/uid/mode/mtimeNs/ctimeNs。内部ready增加临时blobProofs，字段均十进制字符串；不写provenance、仓库索引、IPC/UI或Git。相同F可复用已验证媒体元信息但仍对新fd完整核SHA。

reader只认该bundle的固定CAS路径和已验证F/长度，每次≤4096B，返回私有副本，open/read/fstat/close均同步且无fd缓存/完整库缓存。每次拒绝祖先或叶symlink、非普通文件、坏权限，以及与worker证据不符的替换或改写；before/after fstat包围read。不是以mtime跳过SHA认证：完整验证已由worker完成，这些指纹只检测同一私有版本在验证后的变化。不能防恶意同uid/root或证明设备存储。

文件证据失败后reader标记invalidated，A4当前请求失败并fence；旧owner不能再enable，报repository_revalidation_required。须关闭并由A2完整复验重新装配，坏文件保留、不自动修复覆盖。A2原有全文件worker内存峰值保持，本轮不宣称总RSS≤32MiB。

同一store lifecycle的A2 pin贯穿初始化、review、disabled/休眠和实际HTTP退出；显式仓库cleanup仍拒绝protected版本。只在实际读/HTTP退出、managed/power及reader关闭后关闭A2并释放pin。已验证CAS/provenance可持久重开，cachedOnly必须重新提供I与独立approval，不信先前ready；源目录删除后仍可恢复素材。没有新增生产选择、网络或控制意图持久化格式。

## 初始库存及写入门禁

每次新hello/open自动登记新的query.inventory，deadline为宿主本地now+4000；这是候选参数，不是物理上界。只有当前认证、关联query的完整known inventory可解锁。未查询、unknown、新会话或失效控制不能推导缓存可用。A3新增受信inventoryState返回当前私有完整根/active列表；不进IPC，避免从只列批准映射的offline_available推断空槽。

| 当前根 | 手动base准入 | save附加条件 |
| --- | --- | --- |
| unknown/离线 | 拒绝 | 拒绝，先查询 |
| EMPTY | 仅idle0 | 当前target verified/playing、有效控制、库存known |
| IDLE_READY | 仅0/4 | 先补足默认集合；其他条件同上 |
| OFFLINE_READY | 固定批准角色内动作 | 相同N/id/F已可用时拒绝重复强制保存 |

满4活跃槽且新增action，必须显式`save(deadline,{victim_action_id})`；victim必须当前真实root中非0/4、非target的动作。旧/未映射F仍占槽；同ID换F可更新自身而不逐出另一个动作。可选victim字段只在候选storage.save，不迁移当前v5。入队与实际派发两次核库存/target，排队期间新根使操作不安全时失败关闭，不偷偷改victim。

accepted、下载结束、HTTP200均不能解锁save；verified/playing必须来自A3认证记录。playing/actual仍需设备首帧/display记录，saved仍需持久root_commit；本轮仅mock声明，并非真实提交。保存outcome_unknown保留历史未知，清库存当前性并阻止重试，直到新完整known库存。设备写尝试/磨损/稳定窗口、维护冻结及read lease由固件Store执行，本层门禁不取代它。

## 退出与恢复

disable、休眠或源故障首先关闭准入、失效session/lease/队列/查询/permit，等待实际HTTP结束。resume只恢复managed readiness，review仍disabled；旧blocked会话不应误杀新hello.begin，新的有效confirm才建立新pull上下文；恢复中的坏hello仍关闭准入，不因旧blocked标记而放过本次失败。显式enable后重新TLS/hello/acquire/查询，不重放旧manual/save，不自动联网退避或重试副作用。

close幂等：fence→等初始化取消或真实HTTP退出→managed/power/store→reader→A2 worker/pin→lifecycle idle，服务最后移除自己UDS/descriptor。关闭发生在初始化中也必须等旧ready结束，不能迟到复活。任一清理失败继续后续清理并报告AggregateError；不因异常假报所有资源已清。忽略abort的hook在实际退出前继续占位，不能靠Promise.race提前解除pin。

回退先关闭自有临时端点和peer、等待owner close，再删除临时PKI/目录；禁用或撤回内部装配选项即可回到默认无装配。无旧格式迁移、不动前瞻/a7/V2 N、外部固件/pet/bridge/DSH；应用关闭不等于恢复设备凭据/NVS/缓存。

## 验证与未覆盖

```sh
npm run check
npm test
node scripts/verify-round-pet-a5.mjs --output .cache/round-pet-a5/results.json
```

临时PKI/UDS/loopback、原创360²/24fps/241帧PET4及46合成描述、虚拟时钟与受控电源；41项覆盖磁盘→TLS→A3/status/代理、库存/保存门禁、路径和proof、配额/pin、选主、初始化取消、休眠/故障/重开及只读候选VM。本A5阶段未接A1执行actor；后续A6已接隔离模型。没有接真实角色库、C++对端、物理休眠/断电、TLS资源峰值或持久密钥；1000/500/100/10及15秒TTL仍仅宿主参数，不外推最坏设备时延。

## A7内部检查点

roundPetAssembly新增可选rootCheckpoint和受信owner.rootCheckpoint()，规范化副本在选主前固定并进入配置匹配；后续传入对象修改不改变生效floor。新owner仍disabled，检查点不授予库存/控制。只读状态保留stale_root/root_conflict等原因；无公共导入/降floor/rebind接口。默认不传则不自动保存/恢复高水位，生产权威存储未实现，见[A7](round-pet-a7.md)。

## A8显式权威装配

rootPersistence={profile:binding-roots-review/1,device_id}只open已有v2权威，与手工rootCheckpoint互斥，由赢家同store恢复并提交根。ready仍OFF，设备限所选ID，新库存/控制必需；无CLI/页面写入口，旧v1不迁移。自动持久化只在该显式候选开启，默认服务无此功能；可信恢复/整盘防回滚和生产rollout未完成，见[A8](round-pet-a8.md)。
