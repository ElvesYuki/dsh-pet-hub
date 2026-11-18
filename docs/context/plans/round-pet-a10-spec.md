# A10 不变根编码与已验摘要复用 Spec（实现前）

2026-10-30。已读AGENTS/规范/当前摘要、A9测量与binding-store实际代码。保留已有修改、不用子智能体。只独立临时存储/PKI/loopback/虚拟时钟/原创媒体，不访问固件/设备/pet/bridge/DSH，不启生产listener/插件，不提交推送。

## 根因及局部变化

A9同负载v2有8次根提交、7次实际写；noop虽不fsync仍先校验/摘要/编码整个候选文件。loadWork已算content SHA核封套，rootState remember又对同一已验对象算一次；64绑定多315次重复摘要（308次load＋7次成功写），并未提供额外跨进程信任。

1. 显式rootState的内部rootStrategy支持full（原路径）与默认reduced；v1原行为/输出不变，不新增CLI/插件配置，不写策略字段或迁移数据。full保留为同负载对照/代码回退。
2. reduced noop仍校验输入checkpoint、单调规则、读取当前绑定准入，并取得wx锁；锁内再次完整读盘/权限/封套SHA/schema/revision与全部候选内容一致后，直接返回验证过的当前数据，不做整文件新编码/写/增revision。不让未验证候选走no-op返回。
3. loader私有返回data＋本次完整验证得到的digest，成功编码写入后复用同次编码digest。remember仍每次比较实例内revision/digest，但不二次hash。私有digest不向read()/record()/scope回调/IPC公开，不作为下次文件读取缓存，不信未经本次重算的封套sha。
4. 文件/目录fsync顺序、CAS、root/floor_commit规则、unknown冻结、动态证书日期/撤销、新scope/每4KiB完整权威读取、发布前session/截止、队列/lease均保持。不能引入mtime/TTL跨请求快路或自动降低floor。

## 验证与证据

新增固定数值计数：本次文件hash、额外摘要、已验digest复用、noop编码跳过。一次新scope仍必须完整读取/hash/schema，metadata load/逻辑字节、动态检查与控制/媒体字节应同负载对等，只有重复构造/摘要减少。

复用A9同一fixture，full/reduced各四档v1/v2×1/64绑定，每档3轮，同控制轨迹/字节/文件形状/容量/7次同步。A9成本断言/测量helper显式full保持历史参考；正式对照在独立CLI同次重跑两策略，不用旧JSON时间作对照，不断言减量必更快。

负例：同长/保mtime坏内容、坏schema/封套SHA、同revision合法重哈希变化、旧合法文件、删除/symlink/权限/锁；clone/scope对象修改不能污染私有digest；noop锁内并发rev/内容变化拒绝；读view中写/旧CAS/写前和rename后未知；TLS块间撤销/坏档及发布截止继续关闭。保留A8 SIGKILL/692及A9 706基线，最终check/test、独立CLI正常/SIGTERM及严格去敏证据，不重做物理/30分钟测量。

## 回退与未覆盖

关闭自有临时peer/server/store/worker并等实际I/O退出，删自有目录/PKI。代码内切回full或撤回局部减量即可，文件格式/摘要/版本相同，无数据迁移和外部服务回退操作。full不是弱验证旁路。跨进程整盘回放/可信锚、冷盘/OS停顿/真实网络/漂移/物理掉电及共同G0/真实包/Node-C++/G1/G2/设备窗口仍未完成，不以样本缩短期限或放行设备。

实施状态（2026-10-30）：按本Spec/Diff实现，24专项/730全套、独立CLI同次新鲜full/reduced对照与SIGTERM清理通过。见[报告](../../reports/2026-10-30-round-pet-a10.md)和[API](../../protocol/round-pet-a10.md)，原A9摘要/减量待办已[归档](../history/round-pet-a10-evolution.md)。局部切片闭合；共同G0/真实包批准、可信恢复/实体资源与窗口仍待完成。
