# A7 会话边界与根维护候选

2026-10-30。[实现前Spec](../context/plans/round-pet-a7-spec.md)/[Diff](../context/plans/round-pet-a7-diff.md)、[报告](../reports/2026-10-30-round-pet-a7.md)。仅独立临时宿主/模型/TLS验证。协议决定仍待固件共同确认；无生产listener、真实设备或自动持久检查点装配。

## context与revision

目标的唯一作用域为七字段context（device、binding/epoch、boot、session、controller、service instance）加command_id/revision。同一作用域revision必须递增；重连/新hub owner只能在新的已认证context中重新从1开始，不能按命令ID或revision数值跨会话去重。

A1新增受信`beginSession(context)`：同context幂等；新context失效work/frame、未提交stage、read lease和RAM，重置命令revision，保留Flash root/对象/未知状态与最后有效画面held_last_valid。它不reboot、不重扫Flash、不清缓存、不自动播放；未知介质不会变healthy。旧无session调用方式保留给原纯资源专项，不作为生产接纳接口。

simulator open在TLS fixture完成hello后调用beginSession。setControl/receive支持显式expectedContext；fixture跨await捕获peer/context，不读取可被换掉的全局peer作为旧结果身份。迟到失败的disconnect也只作用于原context。load和frame继续使用opaque票据，不能把旧会话结果交给新target。beginSession不是认证器：谁有权提供新context仍由现有mTLS/session/socket权威决定，生产固件必须独立执行该边界，不能接受设备wire自封“新会话”。

## 根检查点候选

`validateRootCheckpoint`闭合schema_version=1、profile=round-pet-root-checkpoint/1：

| 字段 | 含义 |
| --- | --- |
| binding | device_id、binding_id、binding_epoch；不绑定临时boot/session/service实例 |
| namespace | 固定现有V2 N，不迁移分区或素材身份 |
| floor_seq | 已确认root高水位，uint64十进制字符串 |
| root | 最后完整认证根或null，含N/root_seq/root_state/≤4 active；恢复后仍非live库存 |
| floor_commit | 对floor对应saved的对象证据或null：root_seq、action_id/F/bytes、object_generation |

若floor高于最后完整根，必须有对应floor_commit；检查点不能只记序号而丢失已确认对象。恢复后同序号完整根须匹配该对象，不能借新owner绕过saved与inventory一致性。完整根达到新高水位后，旧提交证据可被更高根取代，不能让退休对象永远阻止合法淘汰。空检查点floor=0/root=null合法，但不等于已查到EMPTY。

A3构造可选rootCheckpoint，`rootCheckpoint()`导出内部副本。第一次open必须匹配binding；新scope/换service不会清低floor。known库存仍需新认证查询；低root和同序号根/提交对象冲突拒绝并失效会话。checkpoint不恢复旧命令、控制、首帧或saved历史。

A4/A5内部可选rootCheckpoint传入/导出，规范化检查点进入UDS选主配置匹配，service在异步选主前固定该副本，后续调用方修改不能改变初始化。缺省不启用；无CLI、插件Config、页面导入/清floor/rebind路由。错误保留stale_root/root_conflict/root_checkpoint_binding_mismatch，A5只读状态显示blocked及原因；错误hello仍撤销其managed session。

**检查点是受信caller的管理状态，不是签名批准。** 本轮仅caller写自有临时JSON并交给新owner，本A7仅手工交接；A8已另补显式新profile自动持久/CAS。生产可信恢复来源与磁盘防回滚仍未实现。有效旧检查点回放不能由schema识别；不能据本轮结果称默认服务可在任意崩溃后安全恢复floor。独立approval仍由A2提供，与此状态分离。

## 低root维护评审

`assessRootRecovery(checkpoint,observedCheckpoint)`为纯评审：只比较相同binding，返回maintenance_required或fresh_authenticated_inventory_required、原因/原floor/观察序号，can_write始终false。它不改变检查点、不授权新绑定或设备写入；真实新库存由既有认证链验证。

低root/同根冲突后的具体顺序：

1. 关闭准入和当前session，保留原floor、完整根/提交对象及历史确认；当前库存unknown，禁止播放/保存新目标。
2. 在独立维护窗口只读核对设备身份、N、根与对象损坏原因；保全证据，不自动格式化、刷写或降低floor。
3. 固件任务提供恢复原已批准的相同/更高root方案及验证证据；若无法恢复，另行评审撤销旧binding、凭据和重新建立信任，禁止仅换boot/service/清文件作为绕过。
4. 只有显式review重新启用、新TLS/hello/完整库存达到原floor且一致后恢复候选库存；仍不重放旧意图，不补造历史saved。设备操作/绑定变更需独立授权，本轮只在内存medium移除注入损坏后验证此路径。

## deferred、取消与提交

deferred表示尚未确认提交，可结束该storage控制的关联等待，但不是saved。模型切点：cancel先发生则清暂存、晚commit拒绝；commit先发生则root/saved事实保留，后cancel只停止当前播放工作。queued saved与cancel ack经各自流正常交付，不撤销根。

marker结果未知时，cancel不能断言“未保存”或伪造成功ack；仍需显式介质恢复和新库存。旧会话saved不可在新owner中确认没有登记的操作，库存可恢复当前可用但不会补造回执。模型同步切点不证明ESP线程/Flash互斥、维护让出、写尝试/磨损规则或最坏耗时；须C04/C08/C09共同定版。

## 验证与回退

```sh
npm run check
npm test
node scripts/verify-round-pet-a7.mjs --output .cache/round-pet-a7/results.json
```

24专项覆盖纯core和临时真实mTLS/UDS新owner，既有634回归保持。媒体仍为原创241帧PET4/46描述共享F，模型同一medium/actor/boot，独立VirtualClock。检查/CLI监督不是设备硬预算。

回退关闭自有peer/server/owner/actor，等待实际HTTP、worker/pin/介质claim回收，删除自有临时检查点/PKI；撤回内部显式checkpoint参数，不迁移现有配置或V2缓存。生产权威检查点持久化、磁盘/系统回滚恢复、双方wire/Node-C++、真实包与G1/G2/设备窗口仍未完成。
