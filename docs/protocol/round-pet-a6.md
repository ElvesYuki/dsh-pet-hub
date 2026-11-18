# A6 模型执行与端到端对照

2026-10-30。[实现前Spec](../context/plans/round-pet-a6-spec.md)/[Diff](../context/plans/round-pet-a6-diff.md)、[报告](../reports/2026-10-30-round-pet-a6.md)。本轮只实现隔离模拟执行链，不是固件、物理Flash、DMA/面板或生产wire。A5默认OFF及deviceTransport=false保持。

## 事实来源与所有者

`packages/simulator/round-pet-executor.mjs`的createRoundPetExecutor接收调用方独占的A1 actor、批准manifest/packageRef和本地clock。actor仍负责单encoded RAM、4活跃+1暂存、保护0/4、root/对象generation、不可伪造work/frame/read票据及恢复；adapter不重写Flash事务，不依赖Node、DOM或DSH。close释放actor/介质claim，不擦除调用方逻辑medium。simulator目录被现有构建过滤，不进入插件候选。

仅tests fixture将它接入A5临时UDS赢家与loopback mTLS：A2独立批准/CAS→A4设备主动exchange/许可分段→A1真实字节验证/显式刷新/保存→下一HTTP回执→A3/GET status。复用既有TLS客户端/codec/lease子报文，不以直接调用A3 reducer注入事实替代网络。初始缓存也经A1 request/supply/verify/write/commit构建，随后关闭旧actor并恢复，未手填inventory。

测试validator调用既有verifyRoundPetAsset，从字节核F、241帧CRC和index SHA，并适配A1严格媒体证明。所有46描述仍共享一个原创恒定索引360²/24fps/241帧PET4，非真实角色库；每次恢复/校验完整检查，没有为了加速跳过CRC。执行与宿主两个VirtualClock初始相差700000ms，绝对时钟不互传。

## 分步API与候选四流

| 调用 | 事实边界 |
| --- | --- |
| open(context)、setControl(control,localDeadline) | 受信模拟会话输入，非密码学入口；本地截止由fixture既有leaseSendBudget收紧，相对TTL不转宿主绝对clock。新上下文须先disconnect；换控制权清旧工作 |
| receive(control) | 仅处理已解码的playback.set、storage.save、query.inventory/display、playback.cancel；校验package/control/target关联，接受后才生成accepted。lease由既有fixture适配，不重写认证 |
| load / supply(loadTicket,bytes) / verify | 区分flash_ram、flash_stream、network；load返回私有opaque票据，迟到网络结果必须匹配原票据；换目标/断线/重启后拒绝。网络完成只得到未验证工作集。verify调用A1/严格字节validator，通过才生成verified，失败生成failed并丢候选 |
| prepareFrame / submitFrame | 准备不报告playing；A1 submit成功后才生成playing与display。至多1帧票据；换目标/save/cancel/断线/过期/重启拒绝旧票据 |
| writeSave / commitSave | ≤4096B写模型暂存；未写满不提交/不出saved。成功root写入并读回才映射root_commit、root_seq和object_generation。marker尝试失败映射outcome_unknown，库存unknown |
| deferSave | 仅当前A1 storage=saving时，显式报告非终态deferred以完成该控制的关联接纳；后续结果dispatch_id=null。可让cancel在保存未提交时被拉取，不伪称saved |
| take | 私有outbox上限16、四流uint64序列；每次至多交给传输一条。没有重试、自动循环或持久回执日志 |
| disconnect / reboot / close | 断线清outbox/控制/帧并取消未提交stage；reboot显式恢复Flash并清RAM/意图。close幂等释放资源；数据只在调用方内存medium中保留 |

inventory只从actor.snapshot().inventory完整映射；unknown不暴露旧active。saved改变当前根后A3使库存暂时失效，必须关联的新query.inventory确认，淘汰立即反映在新根。历史saved不随淘汰被抹掉，丢失的saved回执也不由inventory补造。根和对象uint64继续使用字符串。

display与playback分开：保存/加载保持最后有效画面，不推进其elapsed；旧目标维护由关联display快照表达。成功保存不重新确认playing；新submit后display提高refresh generation，playback仍保留该目标第一次提交的first_frame。重连后hub可保留历史actual但is_current=false，不能把它当已恢复播放。

执行步骤核本地控制期限。观察到期限/时钟失效，或接到新控制时发现旧期限已过，均取消旧工作/票据；重新提供控制不能复活旧帧；网络失败由fixture显式disconnect。宿主休眠只保证下一HTTP拒绝，并不证明远端瞬时获知休眠；未获知断线前的物理设备仍需本地租约约束，这是固件待验证项。

## 故障与恢复决定

payload或对象头失败保留旧根；暂存/仅对象头残留不可用。root marker尝试前后的失败都按未知处理，不能据异常推断未保存。显式恢复后，新根可能存在也可能不存在；只通过新认证完整库存收敛，不重放save、不把历史unknown改成saved。

模型恢复会校验根引用并可回退到完整旧根，但管理端已确认更高root_seq时仍拒绝低root，保留历史已确认信息并将当前库存失效。两个根坏时不格式化，介质I/O错误不伪装成坏根回退。真实设备发生回滚后的维护/重新绑定流程须共同定版，不能静默降低管理端高水位。

本轮恢复对照使用显式模型reboot/重新恢复；A1 revision是actor生命周期单调值，A5 manual revision是owner生命周期内存值。[A7](round-pet-a7.md)已补受信会话切换与临时检查点，使隔离同actor不reboot重连可验；实际固件接受的revision命名空间/重置契约仍待C07/C12冻结；不得从本轮模拟重启推导无重启重连已全面完成。物理触摸优先、read lease竞争和磨损窗口沿用既有A1局部证据，未新增完整物理仲裁。

## 验证、退出与回退

```sh
npm run check
npm test
node scripts/verify-round-pet-a6.mjs --output .cache/round-pet-a6/results.json
```

30专项，默认604项基线继续回归。A6逐次全CRC/根恢复较慢，监督CLI显式总上限120秒，单用例仍30秒；现有其他CLI默认总30秒不变。监督超时只中止自有进程组并删除临时环境，不改变任何协议期限/租约。SIGTERM结果明确interrupted，不能当通过。

退出按自有peer/socket→临时TLS server→A5实际HTTP/managed/reader/worker/pin→模型claim→临时目录/PKI；不清其他服务。回退撤回simulator/fixture/专项入口，A5生产默认仍无listener，无新持久格式或设备配置。真实46包批准/Node-C++、共同G0、G1/G2资源/时间/凭据/退出上界与独立设备窗口均未关闭。
