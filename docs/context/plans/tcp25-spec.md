# TCP25 Spec：已确认方案A endpoint-arbitrated（先写后实施，已完成本片）

2026-11-06。用户明确选择端侧触摸优先、EOF回最新仍有效DSH目标，替代TCP23的触摸触发永久停止政策。默认event及原observed-local/B分支保持，不改终端仓库/运行服务，不接ESP/USB，不重做DSH/空闲取证。

新增显式hold参数arbitration='endpoint-arbitrated'；默认仍observed-local、需priority证据。A表示端侧承担仲裁，不表示host观察到clear；禁止同时传priority回调，以免伪装。入口仅可信本地构造，仍需genuine来源/用途/window/shared授权，不新增HELLO/type/USB/profile字段。A下host依新鲜来源继续有限续租/更新最新0/1/11，触摸不触发B sticky stop；freshness/三期限/耗时扣除/2秒低水位/新5秒/CAS/unknown原body及目标过期不复活全部保留。

检查旧core/owner：BASE ACK的2000ms截止与Presented分离，Deferred code3 token0清pending但不代表首帧；未设置等待Presented的额外超时。新BASE清旧accepted，迟到旧request/source不能更新新首帧。用持续端侧actor与真实TCP验证跨多个租期/触摸EOF后最新request的Presented。若暴露缺陷先最小修复，不预设通过。

共享取消必须在链路down/paused时也能清本桥意图（仍核授权/实例/组/seq/CAS）；否则停止桥后可能被旧autoRecover恢复。仅shared CANCEL清理门禁最小修复，BASE仍要求ready且未paused，legacy不改。取消不撤端侧touch；来源/权限过期及断链时设备自主回本地，host不能宣称未送达的取消已执行。

A允许现有显式autoRecover策略：true只在新会话恢复旧目标的原剩余寿命，不改变group revision/原截止；false则不恢复。A不强制B的false。桥若已经观察到失联并停止/撤目标，不自动重启；若恢复先于下一poll，未过期旧目标可按原期限恢复，下一续租仍需新鲜源和全部门禁。长断线/过期绝不复活。unknown不发新源命令，取消只能明确自己的已确认目标。

验证：原端侧模型固定同一实例跨断链，真实HTTP/UDS/TCP/ACK/PING/Presented；touch跨多次5秒、thinking→working、cancel/来源/权限/失联/暂停、人工race、首帧晚回执、unknown原body、autoRecover true/false及过期。默认event/B回归，check/test及两候选build。资源只报单在途/最新目标/有限读体和宿主清理，不外推ESP/RSS/时延上界。

回退A参数省略回observed-local，mode省略回event；close本桥/source并清自己fixture。B草案保留历史可选不装配，真实pet迁移/加载身份保持待验，不重复空闲采样，不扩旧包依赖/账号/运行配置/媒体缓存或固件。

实施中只读补证（同日）：端侧renewal_probe.cpp/log明确同动作新BASE更新request并使playing stamp失效/needs_start=true；本仓库Node oracle的key也包含seq，行为相同。不能宣称有限续租带来连续播放。A在本片仅显式离线策略；真实自动hold准入增加“同动作保位续租”端侧待确认门槛，不新增消息、不扩大TTL。拟最小合同：同一连接/session、未失效且完整action+SHA相同的BASE只更新截止和最新request，保持token/source/帧位；ACK code2可返回原token，不合成Presented。若后续真实frame0提交可按最新request报告，首次待播也归最新request；host仍拒旧seq，未知显示不靠ACK转真。touch期仍Deferred/token0，EOF从最新有效目标新起播；取消、过期、断线或不同身份必须失效。该合同需端侧独立Spec/Diff和C++实证，当前实现/实屏均未具备。

完成证据：[TCP25报告](../../reports/2026-11-06-tcp25.md)；20专项/1885全量、check和两构建通过。保位续租只完成反例与交接，不算已实现。
