# G0-R7 已进gate的本地提交收尾

2026-11-02范围说明：本文是360兼容协议/模型，不随目标切换自动支持400。当前主线见[400规划](../context/plans/native400-manager-alignment-spec.md)和[共同G0](../context/plans/round-pet-g0-handoff.md)，下一实施入口400-01至04；本文验证结果/API保持。

2026-11-02。[Spec](../context/plans/round-pet-g0-r7-spec.md)/[Diff](../context/plans/round-pet-g0-r7-diff.md)、[报告](../reports/2026-11-02-round-pet-g0-r7.md)。仅扩显式新wire模拟executor，旧A6缺省/真实设备/生产通道不变。A1 actor/Flash与R3 JSON合同不修改，字段/固件行为仍需共同签核。

## 授权与所有者

完整payload写入后，仍需原guard有效才能gateSave；其返回一个本地不透明completion token。最多一个任务保存原context/control/target/operation/work ticket和等待诊断deadline。token按对象身份核对，不可克隆/序列化为新能力，不出wire/IPC；没有gate不能事后从旧operation_id/命令重建它。

这份能力只授权**已进gate的一次本地commit**。它不允许追加payload、加载新素材、刷新画面、接受新会话或续租。断线/lease过期/暂停/单调时钟异常会清outbox、旧frame/load/控制/context，保留提交引用；新open/setControl/request/reboot/恢复不得偷占pending任务。gate前取消仍丢staging而不改root。

| 阶段 | 本地行为 | 网络行为 |
| --- | --- | --- |
| pending、有当前有效会话 | 原commitSave同步完成，正常报告独立storage结果 | 与R6一致，不推断playing |
| pending、权威已失效 | finishCommit(token)调用同actor.commit一次 | 只返回本地诊断，不发旧storage/playing |
| running中再失效 | fence协议字段，不重入busy actor.cancel/close；等待实际调用返回 | 迟到终态不进outbox |
| saved/failed终态 | 重复finish只返回结果副本，不再次写root | 新会话用新inventory，不补旧saved |
| outcome_unknown | 禁止再次commit；只准显式recoverCommit重扫完整根 | 新库存对账，unknown历史不改成saved |
| 新gate建立 | 替换唯一终态结果槽，旧token永久失效 | 无历史任务队列增长 |

等待预算commitWaitMs缺省4000、受信范围1..30000，仅供overdue诊断与停止旧权威，不是物理commit硬上界。到期仍保留任务/medium claim；不延lease/ACK/TTL或强清gate。持原token仍可完成此前授权的本地不可取消工作，结果不回送旧会话。

## 方法与错误

- gateSave()：新wire专用，原actor确认完整payload并进入gate后才产生token；deadline先验证，不在gate后抛掉本地引用。
- commitSave()：正常路径保留R6同步结果/错误；若调用栈内发生失联/过期/暂停，则完成结果仅作detached诊断。
- finishCommit(token)：只能完成detached pending；运行中拒绝commit_in_progress，非detached拒绝commit_not_detached，无/伪造/旧token为stale_commit_task；unknown/reconciled拒绝commit_result_unknown，不能盲重试。
- recoverCommit(token)：只在原任务已outcome_unknown且本地协议context已断开时重扫actor；失败保持unknown，可再次读恢复；成功标记reconciled但诊断原status仍unknown。不能据恢复给旧操作补saved。
- suspend()/resume()/expire()：显式新wire模型注入，不是OS事件源。suspend清旧context，resume只恢复可握手状态；expire按本地单调clock检查lease/等待预算，需可信调用方主动驱动，无后台timer或自动重连。
- commitState()/resources()：只读副本/计数，无完成token/素材字节。最多1 pending、1终态结果及原outbox16；不暴露到共享UI。
- close()：新wire返回幂等Promise。未运行pending gate由同owner完成一次本地收尾再释放；若正在同步actor.commit调用栈内重入close，Promise直到该调用实际退出才完成，不能提前释放medium。旧默认executor同步close保持。

这些新增方法和错误只属于离线模型，不是新增HTTP端点或设备错误码。close完成仅表示实际退出与资源释放，不表示saved；保存结果仍须检查诊断并通过新会话库存对账。

## 实际退出、故障与恢复

测试以Memory medium的同步故障钩子，在before_root_marker等真实模型commit调用栈内注入失联、暂停、过期、close及新会话竞争。过程中Flash busy/claim仍属于旧owner；commit返回后才可cancel旧播放/close。没有用timer、AbortSignal、假的busy=false或新actor重建冒充实际退出。

failed仅来自原模型确证的提交前失败；marker/读回不确定沿用outcome_unknown。完成本地收尾不降低A8 floor，重连新hello/完整库存/acquire/新意图；旧saved/playing即使通过新TLS转发也受ledger/A3关联拒绝。宿主owner重建/低root拒绝继续沿R6/A8；不恢复老lease、不修改source context来伪装新事实。

R6 lab清理新增可信beforeClose依赖，先等executor本地commit退出，再关闭adapter/真实HTTP、A2 reader/pin、私有根；避免测试自身先删资源。此钩子仅fixture，不是公共配置/设备事件。

## 验证与未覆盖

30专项见报告，包含真实loopback断线/新hello竞争、双虚拟时钟、原A1事务、真实actor旧回执回放、同期/迟到关闭、unknown恢复与A8 floor。R7不修改session/guard、宿主读取预算、A1模型内核、R3修订2或80正62反字节。

这只是**同步内存Flash模型**的一次本地完成策略；不证明ESP异步Flash/RTOS可在规定时间收尾、物理掉电/断网/休眠、系统凭据/可信时间或TLS内存准入。没有将模型token变成固件字段或生产完成接口；固件仍须共同评审gate语义、凭据撤销与不可取消写入边界、G1/G2。

```sh
node scripts/verify-round-pet-g0-r7.mjs --output .cache/round-pet-g0-r7/results.json
npm run check
npm test
```

[共同G0/许可/G1-G2核定](../reports/2026-11-02-round-pet-g0-closure-review.md)已完成本轮只读范围，下一按400身份/窗口能力/完整性与新协议分片推进；单方宿主通过不放行真机。若继续扩异步设备模型，须另Spec/Diff证明实际任务退出和有界等待，不能沿同步样本推导硬时限。回退仅撤回新wire提交任务/fixture，关闭自有资源并等待已授权工作退出；无格式/namespace/TTL/外部配置迁移。
