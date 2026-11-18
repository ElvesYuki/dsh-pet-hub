# G0-R2 首窗口策略与提交边界

2026-10-30。[实现前Spec](../context/plans/round-pet-g0-r2-spec.md)/[Diff](../context/plans/round-pet-g0-r2-diff.md)、[报告](../reports/2026-10-30-round-pet-g0-r2.md)。仅宿主离线候选；不新增设备wire、生产listener或真实触摸源。

## 首窗口门禁与选项

core/round-pet-first-window.mjs导出FIRST_WINDOW_PROFILE=first-window-review/1、authorizeFirstWindow(kind,target,inventory,manifest)、firstWindowChoices和FirstWindowModel。

authorizeFirstWindow只接受playback.set(0/11)，要求当前完整可信OFFLINE_READY库存、固定N、目标及受保护0/4的F/长度均匹配批准目录。remote4→touch_only，其余→first_window_action；库存未知→inventory_unconfirmed，缺失/旧F→first_window_not_cached；storage.save等→first_window_read_only。target/schema/身份认证仍由既有边界负责，不把这个纯函数当认证接口。

A5内部显式options.executionProfile=FIRST_WINDOW_PROFILE才采用该门禁；未知值拒绝，选项在owner创建时固定，之后修改caller options也不改变；它进入roundPetAssemblyDescriptor/UDS选主身份，不能attach到不同profile的owner。缺省不增加descriptor字段，通用46候选保持。不新增CLI、IPC、公开snapshot字段或正式管理页面。manualChoices()仅内部投影46个{action_id,enabled,reason}，供后续UI消费；UI接线仍未完成。

manual首先在新managed readView做无副作用预检，再由原统一authorizeOperation在入队/派发时复验。用户选择未开放动作直接拒绝、不推进revision/desired或关闭有效lane；若已入队后库存/身份改变，派发复验失败则沿原pull关闭规则冻结。save在本profile入口拒绝，不能通过installation/victim绕过。默认OFF/新hello先库存、动态认证/逐4KiB读取、队列/截止/unknown及A10减量保持，配置不自动写盘或切换通用profile。

## 有界离线行为模型

FirstWindowModel({clock,manifest,caps})只接受受信调用；不是TLS/租约guard的替代。open(context)、observeInventory(record,context)、setControl(validatedGrant,localDeadline,context)、request(target,context)装配当前源；setControl的身份/epoch/可信期限应由既有认证guard验证后注入，不在这里另造租约认证器。

- 一base、一local事件、一frame token，另保同binding根floor/一个最后画面；无历史队列/自动计时器。已派发I/O不在此模型内合并。
- touch(uint64EventSeq,bootId)是受信本地事件注入，默认bootId为当前boot；重复序列不重启、低序列/旧boot拒绝。新有效touch替换token；只有匹配submitFrame的第一次local ACK才开始241/24秒。整数ms时10041尚未结束、10042到期，首次ACK前不自行超时。
- 本地期间request只替换最新base，不改变local寿命，不产生playback.set(4)。到期选最新有效base；失去control/过期/断线则idle0。同boot认证上下文更换保本地计时，清远端命令/控制/库存；新boot清local/token。新会话revision可从1开始，旧context/frame不得提交。
- prepareFrame/submitFrame只表示模拟刷新提交，selection是待执行决定，actual是最后模拟提交；它们都不是实体画面证明。资源对照另用A1实际load/verify/Flash read lease，固定有效0/4/1/11缓存，断言physical4也不触发网络；缺损本地默认对象的真实设备处置不由本模型推测。
- observeInventory复用A7检查点单调规则；低root/同根冲突清base/当前库存而保floor。clock回退清控制/base/frame/local并抛错，不推旧时间重活。

disconnect只清远端控制/准备，不重启同boot的local寿命；close可重复且拒绝后续调用，无I/O/监听需要释放。它不把local触摸观测重新喂给pet或hub远端调度。

## Flash gate 与恢复

复用Native360FlashModel：gateCommit(transactionTicket)在payload完整后返回冻结的不透明gate，尚未写对象头或root。之后append/cancel/重复gate拒绝；commit(transactionTicket,{gate})要求原token，伪造或漏gate拒绝且不丢原pending。legacy commit(ticket)仍为原同步路径，只在没有显式gate时可用。内部#run继续拒绝重入，gate不是物理RTOS锁或可信时间证明。

Native360DeviceModel.gateSave(workTicket)把该gate保存在唯一save任务。gate前cancel清暂存且无新root；gate后cancel仅将旧播放phase置cancelled、失效frame并保持saving/最后有效画面，保存可继续。新request/新session在gate未结束前拒绝commit_in_progress，后续latest由上层保留。commitSave使用原gate，成功后记原目标saved/新root，但不把cancelled变回playing；取消发生在成功之后也不撤销已存事实。

对象头前失败为failed且旧root有效；root marker尝试或其后读回失败为outcome_unknown，库存unknown、禁止新写/盲重试。逻辑介质的before_marker注入即使测试知道没落盘，也按不确定分支保守处理，必须新读库存。这里没有改固件V2 bytes、bool API或实际持久化机制。

recoverStorage()是actor受信恢复入口：须无save/stream lease，清volatile工作/RAM/frame/时基，在唯一Flash owner上执行原完整根/对象校验。I/O异常继续unknown/blocked，不当作确证坏候选选择旧根；确定损坏可恢复有效旧根，但管理端A7/A8 floor仍拒绝降低。恢复只更新inventory，历史outcome_unknown不补成saved，也不恢复旧command/control。actor资源模型不持有hub binding权威，floor由既有检查点/观察owner处理。

A6模拟executor.recoverStorage()先清自身队列/控制/任务再调用actor；cachedHitInventoryOnly=true可在已缓存命中时返回本地already_available，不排新saved report或增root。这是显式离线结果，**不是新wire cache-hit ACK**；正式storage取消/命中如何关联pending仍由G0-R3定版。旧A6缺省测试行为保留，首窗口A5本来就拒绝save。

## 验证与退出

```sh
npm run check
npm test
node scripts/verify-round-pet-g0-r2.mjs --output .cache/round-pet-g0-r2/results.json
```

35专项，虚拟时钟/原创小逻辑媒体和临时原生360 PET4/PKI/UDS/loopback TLS分层验证。监督CLI只收固定case名/数值/结论，失败/取消不假成功，关闭进程组并清自有临时根；不碰固件A/B现场。CLI会重建未安装dist，不与其他构建并发。

回退关闭自有端点/worker/owner、删除临时环境或撤回显式profile/局部门禁，无格式/许可/配置迁移。逻辑gate分步并不实现真实线程间原子性、不可抢占最坏时长或电源掉电；实际触摸/维护优先级、TLS/秘密/可信时间、正式UI/wire/Node-C++及G1/G2仍待实施/验证，联合G0未关闭。不以通用profile绕过首窗口限制，不延TTL或自动降低floor。
