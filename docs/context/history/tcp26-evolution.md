# TCP26：保位续租采纳演进

2026-11-06。终端候选已完成保位续租，管理端同步oracle并通过宿主对拍后替代TCP25的代码未实现阻塞；真机连续性/动态资源/真实来源仍待，原f553/af5b驻留结论不变。以下是被替代摘要，不是当前状态。

## README.md

2026-11-06 TCP25：已按确认的方案A增加显式endpoint-arbitrated离线hold策略，端侧触摸优先、EOF回最新有效remote；保留event/observed-local默认与三期限/CAS/有限租期。共享取消可在down/paused清自身逻辑目标，20专项／全量1885通过，check及两候选构建通过。无新增wire/profile或priority查询前置，A允许原true/false剩余TTL恢复。当前同动作BASE会换播放token，Node与只读端侧探针均复现；保位续租仍是实际自动hold阻塞项，不宣称连续播放已解决。未读真实pet/接ESP/改服务。见[合同](../../protocol/native400-endpoint-arbitrated-hold.md)/[报告](../../reports/2026-11-06-tcp25.md)。

## docs/context/index.md

2026-11-06 TCP25：已按确认的方案A增加显式endpoint-arbitrated离线hold策略，端侧触摸优先、EOF回最新有效remote；保留event/observed-local默认与三期限/CAS/有限租期。共享取消可在down/paused清自身逻辑目标，20专项／全量1885通过，check及两候选构建通过。无新增wire/profile或priority查询前置，A允许原true/false剩余TTL恢复。当前同动作BASE会换播放token，Node与只读端侧探针均复现；保位续租仍是实际自动hold阻塞项，不宣称连续播放已解决。未读真实pet/接ESP/改服务。见[合同](../../protocol/native400-endpoint-arbitrated-hold.md)/[报告](../../reports/2026-11-06-tcp25.md)。

## docs/context/current-system.md

2026-11-06 TCP25：已按确认的方案A增加显式endpoint-arbitrated离线hold策略，端侧触摸优先、EOF回最新有效remote；保留event/observed-local默认与三期限/CAS/有限租期。共享取消可在down/paused清自身逻辑目标，20专项／全量1885通过，check及两候选构建通过。无新增wire/profile或priority查询前置，A允许原true/false剩余TTL恢复。当前同动作BASE会换播放token，Node与只读端侧探针均复现；保位续租仍是实际自动hold阻塞项，不宣称连续播放已解决。未读真实pet/接ESP/改服务。见[合同](../../protocol/native400-endpoint-arbitrated-hold.md)/[报告](../../reports/2026-11-06-tcp25.md)。

## docs/context/current-todos.md

2026-11-06 TCP25：已按确认的方案A增加显式endpoint-arbitrated离线hold策略，端侧触摸优先、EOF回最新有效remote；保留event/observed-local默认与三期限/CAS/有限租期。共享取消可在down/paused清自身逻辑目标，20专项／全量1885通过，check及两候选构建通过。无新增wire/profile或priority查询前置，A允许原true/false剩余TTL恢复。当前同动作BASE会换播放token，Node与只读端侧探针均复现；保位续租仍是实际自动hold阻塞项，不宣称连续播放已解决。未读真实pet/接ESP/改服务。见[合同](../../protocol/native400-endpoint-arbitrated-hold.md)/[报告](../../reports/2026-11-06-tcp25.md)。

## 旧下一入口

下一入口：先由终端按TCP25最小合同补同身份BASE保位续租，明确request与播放实例分离、ACK原token和真实frame0的最新request关联，并做C++/Node联合向量；未确认前不启真实自动hold。无需先完成TCP24 priority查询或强制A autoRecover:false。管理端随后按确认合同同步oracle并回归续租/触摸/过期/重连，再准备固定版本、来源/用途与有限窗口的真实集成/回退。pet运行加载身份与自然状态迁移仍待实际运行方证据，不重复空闲探测；默认event/manual、TCP22隔离宿主证据保留。Desktop scheme、长期会话/长测、媒体流/保存/V3后置。

## docs/context/native400-baseline.md

2026-11-06 TCP25：已按确认的方案A增加显式endpoint-arbitrated离线hold策略，端侧触摸优先、EOF回最新有效remote；保留event/observed-local默认与三期限/CAS/有限租期。共享取消可在down/paused清自身逻辑目标，20专项／全量1885通过，check及两候选构建通过。无新增wire/profile或priority查询前置，A允许原true/false剩余TTL恢复。当前同动作BASE会换播放token，Node与只读端侧探针均复现；保位续租仍是实际自动hold阻塞项，不宣称连续播放已解决。未读真实pet/接ESP/改服务。见[合同](../../protocol/native400-endpoint-arbitrated-hold.md)/[报告](../../reports/2026-11-06-tcp25.md)。

## docs/context/plans/round-pet-g0-handoff.md

2026-11-06 TCP25：已按确认的方案A增加显式endpoint-arbitrated离线hold策略，端侧触摸优先、EOF回最新有效remote；保留event/observed-local默认与三期限/CAS/有限租期。共享取消可在down/paused清自身逻辑目标，20专项／全量1885通过，check及两候选构建通过。无新增wire/profile或priority查询前置，A允许原true/false剩余TTL恢复。当前同动作BASE会换播放token，Node与只读端侧探针均复现；保位续租仍是实际自动hold阻塞项，不宣称连续播放已解决。未读真实pet/接ESP/改服务。见[合同](../../protocol/native400-endpoint-arbitrated-hold.md)/[报告](../../reports/2026-11-06-tcp25.md)。

## 旧G0阻塞

本次管理端交接与未决：[A合同及最小保位续租方案](../../protocol/native400-endpoint-arbitrated-hold.md)。当前端侧Control request变化重建token，Bridge needs_start=true；管理端不能靠ACK/延TTL掩盖反复起播。终端需独立确认同身份续租保留token/source/cycle/帧位、更新期限和request关联、真实frame0才能Presented；变化/失效仍撤旧实例。未共同定版、不新增wire、不改终端或刷新设备。

## TCP25旧保位阻塞及提案

## 阻塞真机自动hold：同目标续租与重新起播

**当前未解决**：真实端侧Control每次BASE令request=r.seq，refresh比较request变化后生成新token；Bridge因此needs_start=true。Node oracle也把seq纳入key，END16真实loopback重现同动作续租换token。3秒低水位续租可能反复从头起播；这里只确认控制逻辑，未测实屏卡顿。不能靠增大TTL、永久租期、重放旧seq或假Presented规避。

建议最小端侧配合合同（待固件独立Spec/Diff、实现和联合向量确认；**当前wire语义尚未共同冻结**）：

1. 同连接/session、当前remote仍有效、完整action+asset SHA相同，且新BASE通过原seq/TTL/身份检查时，只更新期限和最新request关联；保留播放token/source/cycle/mail/帧位及已有校验。新request的ACK code2返回原token，不能冒充新首帧。不借跨连接、过期后或已取消的同action复活。
2. request是命令相关性，播放实例身份与其分离。旧播放stamp在同目标续租后仍current；首次尚未显示或下一真实frame0提交时，可按最新request发真实Presented；若没有新frame0提交，不为让UI变绿合成回执。host既有token约束兼容原token，仍拒旧request回执；暂失观察按unknown处理，不据ACK恢复旧历史。
3. touch期所有新BASE仍Deferred/token0；touch stamp不因续租改变，EOF按最新有效request新建remote实例。不同action/SHA、取消、到期、session失效、断链必须使旧remote失效；旧触摸结束与旧source晚回执不能影响新实例。
4. 若将来需“同动作显式重播”，另行明确CANCEL→BASE顺序或新显式业务操作；本片自动BASE仅保持最新目标，不增加新消息。重放同seq同body仍只回原ACK，不能续TTL；同seq不同body仍拒绝。
5. Node oracle暂不提前改成拟议行为，保留反例以避免掩盖端侧现状。端侧修复后须对拍：新seq同身份ACK/token保持、帧位/cycle不变、真实frame0时序；变化/过期/断线必须更换、旧回执/重复不续期及touch跨租期。

既有HELLO无“保位续租”能力位，不能从版本号或相同消息长度推定支持。真实自动hold准入前需明确双方固定实现指纹/有限窗口批准，或另审最小能力协商；本片不擅自扩profile。管理端单改无法安全解决端侧重播行为。


## 替代的A代码阻塞描述

TCP25按用户确认改为显式endpoint-arbitrated，touch不停止新鲜受权自身目标的有限续租，EOF回最新有效remote；默认event/observed-local保持，不伪造clear，不要求B查询/强制autoRecover:false。独立三期限/CAS/unknown/失效不复活保持，shared取消支持down/paused逻辑清理。实际自动hold仍受“同身份续租保位”端侧未决阻塞，不能将当前BASE重建token称为连续播放。[合同](../../protocol/native400-endpoint-arbitrated-hold.md)/[旧B决策归档](tcp25-evolution.md)。
