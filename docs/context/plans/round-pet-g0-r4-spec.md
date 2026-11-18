# G0-R4 临时宿主 wire adapter Spec（实现前）

2026-11-02。按AGENTS/开发/上下文规则先核对R3合同及session-runtime、lease guard、A2 import/reader、A3 reducer、R2首窗口、PullControlQueue和A8同绑定根权威。不使用子智能体，不访问固件/真实素材/设备或运行服务，保留并行修改。

## 实施边界与依赖

新增内部temporary-wire-review/1 owner，借用既有session、同步readView与A8 rootAuthority；自行持有A2导入/reader和A3观察，复用PullControlQueue，不新写认证、租约、队列或持久协议。默认disabled，无CLI/插件/服务配置入口，不自行创建listener；显式enable后可由测试装配在私有127.0.0.1动态mTLS endpoint。关闭只销毁自有资源和本次会话，不关闭借用store/session owner。

R3合同修订2仅给challenge/ready增加显式full-offline-review/1选择，默认首窗口不变，原78正/62反字节不变，新增2条选择向量；旧R3合同按原SHA归档，双方须复审新SHA。该选择仅测试owner显式固定，不增加生产入口。session另补按socket丢弃未完成挑战的清理方法，不改旧hello校验。

本切片只做新hello、exchange控制/观察和恢复；不新增manifest/asset GET handler（格式已由R3定义，原A4分段保持），不做正式UI/设备资源或固件适配。素材仅原创46动作小PET4，经A2独立approval/全包校验/CAS进入，真实360素材批准缺口不变。

## 不变量与失败路径

1. 新hello严格decode R3闭合封套，将完整capabilities交现有session.begin；新版本/包/挑战/请求新鲜度绑定同TLS socket及生成context，confirm须原样选择。旧session hello/旧A4闭合入口不放宽。未ready不能exchange，错误选择/重放/跨socket失败关闭，重新认证握手；失败不猜能力、不自动回放。
2. 采用同socket session.assertCurrent与同步readView；lease派发调用beginLease，回执直接子记录经原lease canonical/accept/guard，不造proof。所有控制派发重新核guard/context/deadline；上游动态日期/撤销及每scope完整元数据保持，不延TTL。
3. 用R3有界ledger核请求/echo/dispatch/target/operation/包/序列；用现有PullControlQueue核1 pending/1 latest/有界旗标及ACK deadline。新控制必须待前次准确回执；deferred可释放dispatch但operation仍由A3有界生命周期跟踪。未知/无效回执关闭本会话，不把无效pending当已确认；ledger推进后业务拒绝亦须整体fence，不继续使用半接受会话。
4. A3只增显式openWire/ingestWire/prepareIngestWire入口，旧ingest仍schema1。先验证schema2与原始proof，再集中规范化已有语义；额外admission、maintenance generation/原因、触摸及取消保留在独立只读review扩展。命中只接受已确认同根同对象库存，不映射saved或新root。cancel gate结果不伪造存储/首帧；派发前的本地取消栅栏禁止迟到playing复活目标，不伪造设备cancelled phase。
5. storage/inventory一律A3私有候选→退出readView→A8 durable CAS→新scope复核session→发布；失败discard并fence。saved提升floor但不激活动作，unknown阻新写/使库存unknown，只能新完整库存查询恢复；低root/同seq冲突/I/O失败不清floor，重连不补历史saved。
6. 首窗口缺省FIRST_WINDOW_PROFILE，只准可信cached0/11、physical4只观察且保存禁用；显式full-review仅为原创fixture覆盖保存/未知恢复，不能在会话中切profile。取消携完整target/control；本地触摸事件不回发remote4。维护冻结最后有效画面，UI不得承诺旧动画继续。
7. HTTP只有测试调用方显式挂载，双端loopback、单HTTP、4KiB真实body/8KiB实际头、禁编码/传输变体，request timer结束后等待响应实际close才释放槽。固定错误映射、无raw cause/自动重试；失败关闭会话并清队列/挑战/ledger，disable/close等待实际在途退出。socket/测试server由fixture负责销毁；无后台重连或网络发现。

## 验证与验收

30项宿主向量覆盖：缺省OFF与旧入口隔离；A2身份；正常/变更版本包/重放/跨sockethello；先ready；guard acquire/renew/过期；初始完整库存及首窗口拒绝；schema2 deferred与verified→首帧；维护/历史画面/触摸；命中非saved及错根拒绝；gate前/后取消、迟到playing；未知阻写/查询恢复/低root；saved floor/淘汰；A8提交故障不发布；断连新session无旧重放；动态撤销/坏元数据；关闭清理、HTTP格式/单在途。测试使用真实临时mTLS对端、虚拟时钟、原创A2库及临时根存储；不是ESP协议互操作或物理掉电/时延上界。

新增独立监督CLI，正常/SIGTERM均清自有临时PKI、CAS、TLS和子进程；再npm run check（仅.mjs语法）及npm test（含候选构建）。新增失败修正后才扩大复验。交付报告列实际通过/未覆盖、更新当前摘要/交接/待办并归档被替代adapter缺口。

## 回退

未触及任何生产入口/配置/namespace/格式/TTL；disable清本次会话并等待实际I/O退出，fixture关闭自有TLS/PKI/临时目录。撤回新adapter及A3显式新入口即可，旧A1–A10/R2/R3能力保持。不得清外部锁、恢复设备现场、改变固件/pet/bridge/DSH配置。共同G0签核、真实许可、G1/G2与独立设备窗口继续必需。


## 实施状态（2026-11-02）

本片已实现，见[报告](../../reports/2026-11-02-round-pet-g0-r4.md)：30专项、修订2字节80正/62反、check与含构建844全套通过，正常/SIGTERM自有临时环境清理。旧adapter缺口及R3原合同/向量已[归档](../history/round-pet-g0-r4-evolution.md)。无新GET/生产入口/设备装配；共同签核/真实素材批准/G1/G2继续未完成，Spec/Diff保留实现前边界及回退。
