# TCP25：A替代B前置的演进归档

2026-11-06。用户已选择端侧touch优先／EOF回最新有效remote；仅替代“必须先实现priority查询才能推进A”的路线与B强制autoRecover:false前置。TCP23的新鲜收据、三期限、有限租期和停止保障继续有效。TCP24草案保留历史可选，不装配新消息。原真机与pet证据的范围不改变。

## README.md

2026-11-06 TCP24：已比较端侧仲裁A与host停止策略B；为保持TCP23停止语义，提交最小priority轮询草案并实现离线payload codec/连接绑定sticky provider及竞态验证。17专项/全量1865通过；旧wire/owner/hold默认未改，新profile要求既有autoRecover:false。尚未接正式网络或终端，不写死clear/不开设备hold。有效10秒真实pet只读20次空闲无迁移；运行加载身份仍待。见[报告](../../reports/2026-11-06-tcp24.md)/[对端字段与预算](../../protocol/native400-priority-poll-draft.md)。

## docs/context/index.md

2026-11-06 TCP24：已比较端侧仲裁A与host停止策略B；为保持TCP23停止语义，提交最小priority轮询草案并实现离线payload codec/连接绑定sticky provider及竞态验证。17专项/全量1865通过；旧wire/owner/hold默认未改，新profile要求既有autoRecover:false。尚未接正式网络或终端，不写死clear/不开设备hold。有效10秒真实pet只读20次空闲无迁移；运行加载身份仍待。见[报告](../../reports/2026-11-06-tcp24.md)/[对端字段与预算](../../protocol/native400-priority-poll-draft.md)。

## docs/context/current-system.md

2026-11-06 TCP24：已比较端侧仲裁A与host停止策略B；为保持TCP23停止语义，提交最小priority轮询草案并实现离线payload codec/连接绑定sticky provider及竞态验证。17专项/全量1865通过；旧wire/owner/hold默认未改，新profile要求既有autoRecover:false。尚未接正式网络或终端，不写死clear/不开设备hold。有效10秒真实pet只读20次空闲无迁移；运行加载身份仍待。见[报告](../../reports/2026-11-06-tcp24.md)/[对端字段与预算](../../protocol/native400-priority-poll-draft.md)。

## docs/context/current-todos.md

2026-11-06 TCP24：已比较端侧仲裁A与host停止策略B；为保持TCP23停止语义，提交最小priority轮询草案并实现离线payload codec/连接绑定sticky provider及竞态验证。17专项/全量1865通过；旧wire/owner/hold默认未改，新profile要求既有autoRecover:false。尚未接正式网络或终端，不写死clear/不开设备hold。有效10秒真实pet只读20次空闲无迁移；运行加载身份仍待。见[报告](../../reports/2026-11-06-tcp24.md)/[对端字段与预算](../../protocol/native400-priority-poll-draft.md)。

## 替代的下一入口

下一入口：由终端审阅TCP24最小priority轮询合同、选择配置/能力版本并核资源/字节，再由管理端接显式新profile parser/owner/单在途与断链hook，强制autoRecover:false；本轮离线provider不能直接启用设备hold。若产品改选触摸结束自动回最新remote的方案A，须明确变更当前停止政策，不能靠写死clear。pet运行加载身份由实际运行方提供加载常量/loader记录，真实自然迁移可用有界工具继续观察；本轮只有空闲，未人为造任务或诱发失联。旧event/manual及真实DSH/空闲来源验收保持，不重做。Desktop scheme、长测、媒体流/保存/V3后置。

## docs/context/native400-baseline.md

2026-11-06 TCP24：已比较端侧仲裁A与host停止策略B；为保持TCP23停止语义，提交最小priority轮询草案并实现离线payload codec/连接绑定sticky provider及竞态验证。17专项/全量1865通过；旧wire/owner/hold默认未改，新profile要求既有autoRecover:false。尚未接正式网络或终端，不写死clear/不开设备hold。有效10秒真实pet只读20次空闲无迁移；运行加载身份仍待。见[报告](../../reports/2026-11-06-tcp24.md)/[对端字段与预算](../../protocol/native400-priority-poll-draft.md)。

## docs/context/plans/round-pet-g0-handoff.md

2026-11-06 TCP24：已比较端侧仲裁A与host停止策略B；为保持TCP23停止语义，提交最小priority轮询草案并实现离线payload codec/连接绑定sticky provider及竞态验证。17专项/全量1865通过；旧wire/owner/hold默认未改，新profile要求既有autoRecover:false。尚未接正式网络或终端，不写死clear/不开设备hold。有效10秒真实pet只读20次空闲无迁移；运行加载身份仍待。见[报告](../../reports/2026-11-06-tcp24.md)/[对端字段与预算](../../protocol/native400-priority-poll-draft.md)。

## 替代的G0入口

TCP22已按授权完成新隔离profile准入并回退，下一读真实pet迁移/冻结安装运行映射并评审hold合同；设备由终端任务独立操作。本轮未访问ESP/USB/固件工具或修改现有配置。

TCP23交付：shared私有limits=shared-limits/1给真实lane余量，hold另核页面权限/观察代/HTTP采样活性，2500ms预算后只在自身目标仍有效且<=2000ms时发新5000ms BASE。不能用controls.remaining_ms代lane窗口，不能用裸page缓存保活。priority缺省unknown，真实ESP触摸来源尚缺，禁止据本轮代码/宿主测试自动启用设备hold。

TCP24具体交付：HELLO能力尾部8B、QUERY暂type5、32B SNAPSHOT暂type131、boot/session/connection/query与local_epoch/revision、初始/断链unknown及sticky stop；详见对端合同。数字/配置位置待共同冻结，默认七消息不接新type；应用流量2Hz约192B/s，端侧实际RAM/栈/队列仍待。终端实现/Node-C++对拍后管理端再接正式transport；本轮旧parser/owner保持SHA，模型不外推设备已具备。


## 旧决策

## 2026-11-06：触摸优先态最小合同

A端侧仲裁可保护画面但续租后会自动回remote，与现行停止政策不同；本轮保留停止政策，选择B有界查询快照草案，epoch/revision检测漏过的完整周期，sticky unknown/stop不自动清。离线provider不接默认wire；新网络profile必须autoRecover:false，旧模式保持。终端/配置/资源及联合向量尚待，不将候选payload或调试串口当生产状态。[对端合同](../../protocol/native400-priority-poll-draft.md)。
