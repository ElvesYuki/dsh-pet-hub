# 重复复验减量 Spec（实现前）

状态：已按实现前记录完成宿主切片，见[报告](../../reports/2026-10-30-verification-reduction.md)和[活动契约](../../protocol/verification-reduction.md)。生产承载/跨进程事务和物理准入不在完成范围。

2026-10-30。先读AGENTS/README/当前系统、待办、开发和上下文规范，以及证书、绑定存储、mTLS、会话和固定负载代码。用户授权独立临时环境中的实现/同负载对照，不使用子智能体；不接设备、不改固件/pet/bridge/DSH配置，不安装/启用、不提交推送。零新依赖，新代码MIT，保留并行角色成果。

## 根因与选择

上一切片确认session检查一次完整叶证书复验、三次元数据加载；模型renew共6次叶验证/19次加载。重复的静态证书密码学工作和一次同步调用内的相同文件读取是本轮目标。保留逐4KiB的检查点、真实TLS参数/peer、每消息日期、绑定/撤销/代数、锁/坏档/commit_unknown失效及旧回执拒绝；不提高块大小来替代优化，不改租约预算或设备准入。

## 静态证书缓存

profile的缓存默认关闭，mTLS owner的scoped策略显式使用64条静态批准缓存；full策略保留逐次完整验证供对照/回退。键含用途及SHA256，命中还比较完整DER，信任根和验证代码策略由profile实例隔离。不接受调用方提供“已验证”标记，不跨根/用途复用、不落盘。每个DER≤4096B、最多64条FIFO；失败不入缓存，淘汰只增加复验成本，不影响凭据权威。

缓存只保存内部解析对象和静态批准结果（曲线、签名、扩展、用途）。每次调用检查受信wall有效、根/叶日期；TLS socket授权、版本、套件、未复用/未销毁条件及当前绑定仍逐消息检查。缓存中不存“bound”或撤销结果。内部X509对象不得暴露，既有返回X509的API返回独立对象；mTLS使用只返回指纹的验证入口。close清缓存、后续调用失败，缓存条数可去敏观察。根轮换必须新建profile/会话owner，不能沿用旧根实例。

## 同步一致revision视图

绑定store增加受信内部withReadView(syncWork)，只在该同步栈内让read/lookup/isAdmitted复用一次完整验证的数据，返回值仍clone。采用惰性首次加载，让认证边界中的读失败照常触发socket/guard/Registry失效。允许同步嵌套复用，finally必清；Promise/异步工作拒绝，不跨await、不将视图传至IPC/UI。读失败在作用域内保持失败，不回退旧缓存。视图内禁止持久或freeze/unfreeze变更，已有CAS写路径不使用视图；close不能因视图存在而跳过安全关闭。

外层每个session同步业务入口（hello begin/confirm、assertCurrent、beginLease、accept、expect、track/complete、snapshot）可共享一个视图；accept中的auth/guard/Registry不再各读相同文件。full策略不建视图。直接Registry/旧auth读取仍按自身入口检查，不拿私有scope当通用事务。

每次新的scope首次读仍校验锁、目录权限、O_NOFOLLOW、文件属性/长度、JSON/schema/摘要和本地frozen/uncertain。下一写块/新请求一定新scope；没有mtime/大小/TTL/watch缓存，坏文件即使同尺寸、保留mtime仍要被发现。同句柄/其他句柄提交、替换、删除、写锁、权限或损坏在下一scope被发现。scope中同步读取均对应首次读的revision；scope内外部进程改写只能在下一scope发现，**不是跨进程读写事务或即时撤销保证**。单一服务owner仍是生产前提，SHA只检测损坏，不能防同uid恶意重写有效封套。当前既有路径也不能原子覆盖外部写入与最终写socket；本轮不宣称消除该TOCTOU或物理撤销时延。

## 装配、对照与负例

session runtime默认scoped，显式full仅供受信对照/回退，不暴露UI配置或迁移存储格式。mTLS直接入口默认使用有界静态缓存，但不缓存调用方返回的绑定。现有负载探针默认显式full保持历史可重复；新增对照在同进程、同临时PKI、相同4档/4轮70001B/控制顺序/4KiB默认、相同真实TLS参数下先full再scoped。只比较固定计数和观察时间，包含首轮缓存填充说明；不以时间比值作硬门禁，不据短测更新延迟上界。新增静态/动态计量，与原leaf包含关系说明，不重复相加；证据保持数值去敏。

负例包括：缓存命中后有效期过期/未生效/时间未知、root日期、错误用途/根/扩展/尾随字节、返回对象变异隔离、FIFO容量/close；视图clone/嵌套/异常释放/禁止异步和变更、不同revision在下一scope可见、同尺寸保mtime损坏；真实TLS块间撤销/轮换、坏JSON/摘要/schema、删除/symlink/权限/写锁、冻结/commit_unknown，以及休眠/旧proof恢复。失败仍失效权威，不能因为减少磁盘读取而接受旧回执或发布完整素材候选。

## 验证、执行与回退

先专项，再npm run check和npm test（含构建），已有TLS/会话/服务容量回归应走新默认scoped路径。独立CLI复用既有POSIX自有进程组监督器、30秒上限、私有临时PKI/元数据与literal loopback；固定schema通过后才将数值结果写Git忽略.cache。验证正常/取消清理和无遗留自有根；终止拒绝明确失败，不伪造资源回收。

回退关闭本轮lane/会话、Agent/请求/socket及临时listener，await自有工作/子进程，删临时PKI。受信代码可显式verification=full撤回优化，或撤回本轮实现；无现有运行配置、文件格式、素材或DSH恢复步骤。完成后更新当前摘要/待办/索引/决策和活动协议，归档被替代“尚无缓存/三次加载”摘要。ESP/冷盘/多设备/物理电源/漂移与最坏网络门槛保持NO_GO。
