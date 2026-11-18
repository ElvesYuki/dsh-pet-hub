# G0-R6 A1 actor／新wire 离线执行对照

2026-11-02范围说明：本文是360兼容协议/模型，不随目标切换自动支持400。当前主线见[400规划](../context/plans/native400-manager-alignment-spec.md)和[共同G0](../context/plans/round-pet-g0-handoff.md)，下一实施入口400-01至04；本文验证结果/API保持。

2026-11-02。[Spec](../context/plans/round-pet-g0-r6-spec.md)/[Diff](../context/plans/round-pet-g0-r6-diff.md)、[报告](../reports/2026-11-02-round-pet-g0-r6.md)。这是模型设备端验证，不是实体设备驱动或生产入口。

## 复用与装配

[既有模拟executor](../../packages/simulator/round-pet-executor.mjs)增加显式wireProfile=round-pet-native360-wire/1；缺省旧A6模式不变。Native360DeviceModel、Native360FlashModel及MemoryNative360Flash直接复用，未修改模型内核、V2 namespace或根权威。actor/simulator继续排除在插件候选dist之外。

[新lab](../../tests/fixtures/round-pet-wire-execution-lab.mjs)复用R4/R5 checked client与真实临时mTLS/A2/A8；autoApply=false禁用静态peer库存/播放/保存，只有原lease授予编码保留。初始化缓存也由actor逐个request/load/supply/verify/save事务形成，再关闭/reopen actor验证恢复，不能直接造库存JSON。

host/device使用独立VirtualClock（初始偏移700000ms）；grant相对时长按原leaseSendBudget保守换算，实际控制仍由原session/guard。每次actor记录通过新exchange，经真实TLS/新ledger/A3显式schema2入口；网络文件逐段由新GET、If-Range/许可/关联/逐块授权取得，完整收到后才交actor。

## 执行与证据边界

| 动作 | 得出的事实 | 不能替代 |
| --- | --- | --- |
| executor.receive(playback.set) | actor.request已接纳，schema2 admission=ready | 下载/完整校验/首帧 |
| load未命中／supply | source=network、downloading；supply复制完整字节但未验证 | verified/playing |
| verify | 原verifyRoundPetAsset完成F、PET4头、241帧CRC/index核验 | 刷新提交 |
| prepareFrame | 本地不透明frame token | 首帧或面板完成 |
| submitFrame | actor注入刷新提交，独立playback playing及display | 真实LCD面板扫描/ESP刷新证据 |
| beginSave/writeSave | 完整staging仍不属于可用库存 | 持久提交 |
| gateSave/commitSave | 模型逻辑门禁/有效根提交，storage saved/root_commit | 当前完整inventory/恢复动画 |
| cache hit | already_available/inventory_reference，引用已知对象/根 | 新saved/新root |
| inventory query | 完整同根当前离线可用与淘汰，经A8 durable后发布 | 历史saved补发/控制权 |

新控制校验完整target/control/package/mode/descriptor后才变更actor；旧裸command_id取消不能混用。新模式outbox最多16，流序列uint64，inventory按action_id规范化；manifest/P/M及R3修订2/80正62反JSON字节不变。

## 维护、取消与未知

display snapshot由actor查询产生，保留最后已提交画面及原source_context；新会话或新目标不能改写旧画面来源。维护冻结最后有效帧，不承诺旧动画继续。新adapter仅在full-review、当前目标已ready且playback=downloading时允许maintenance=loading继续GET；saving/verifying/recovering/blocked/触摸/旧目标仍拒绝。未查询的维护变化不自动假装已有完整推送/UI接线。

EMPTY只准0，IDLE_READY只准0/4，再OFFLINE_READY扩其他动作；规则与A5一致，入队/派发及actor各自检查。R2缺省首窗口仍cached0/11、remote4/保存禁用；本片full-offline-review不是实体操作准入。

deferSave先以同dispatch发deferred/pre_gate释放控制槽；后续保存终态同operation_id、dispatch=null且更高seq。gate前取消actor真正取消staging，发cancelled_pre_gate及独立cancel.report；gate后保留非可取消commit，只fence播放，允许saved/unknown，旧frame无法激活。只有显式新wire模式提供gateSave；旧A6默认语义保持。

marker或读回不确定仍outcome_unknown，阻新写，不能因bool失败称未保存。恢复复用actor recoverStorage/reboot；I/O失败继续unknown，完整inventory查询确认可用，不给历史操作补saved。低root/同seq冲突不得下降A8 floor；模型中旧有效根回退也会被hub拒绝，不自动降级/格式化。

## 重连与资源

正常断线先清outbox/volatile/control，actor.beginSession接受新完整context，保留逻辑Flash及最后画面；新hello/库存后必须重新acquire，不续旧会话租约或重放manual。旧context/load/frame token拒绝。丢saved回执靠新库存收敛，不补历史saved。

lab支持显式重建宿主owner：关闭旧adapter/session/store，按同CAS的cachedOnly A2重开、同绑定A8 floor及新service instance继续，actor/medium不重启。它是同进程内新owner对照，不称真实管理进程崩溃或全盘防回滚。显式actor reboot则重扫模型根、清像素/旧token，已保存动作可从Flash RAM加载而不再GET。

R7现为gate期间失联增加[单个本地完成任务](round-pet-gated-recovery.md)：失效清旧权威但保留一次收尾能力，beginSession仍拒绝pending，实际同步commit退出后才新hello/库存/acquire；完成结果不回旧会话。unknown只能完整根恢复读，不强清gate或伪造saved。该结论仅同步模型，不推导异步RTOS/硬时限。

关闭等真实HTTP/read退出后释放A2 reader/pin，executor释放medium claim；均只处理自有临时资源。无真实设备/固件/素材、生产listener、插件/外部配置变化或提交推送。

## 复验与后续

```sh
node scripts/verify-round-pet-g0-r6.mjs --output .cache/round-pet-g0-r6/results.json
npm run check
npm test
```

30专项及通过/未覆盖见报告；新增闭环不代固件协议互操作或物理资源准入。R7同步gate失联/暂停已另验，[只读核定](../reports/2026-11-02-round-pet-g0-closure-review.md)已完成本轮范围，下一按400身份/窗口能力/完整性与新协议分片推进，保留原有门禁而不扩TTL；共同G0/GET合同、真实许可、固件G1/G2与设备窗口并行待验。回退关闭自有lab并等实际I/O退出，撤回executor显式模式/fixture及loading/EMPTY窄修正，无格式或期限迁移。
