# temporary-wire-review/1 临时宿主 adapter

2026-11-02，G0-R4主体／G0-R5扩展。[Spec](../context/plans/round-pet-g0-r4-spec.md)/[Diff](../context/plans/round-pet-g0-r4-diff.md)、[实施报告](../reports/2026-11-02-round-pet-g0-r4.md)。这是内部显式离线验证入口，没有服务CLI、IPC/UI或插件开关，不自行创建网络listener；生产deviceTransport=false保持。

## 所有者与入口

createRoundPetWireReview(directory,{material,sessions,readView,rootAuthority,clock,caps,executionProfile,ackMs,readBudget})：directory为独立私有CAS，material走既有A2独立approval及worker全包验证/来源发布；借用现有session-runtime、同步readView和A8 bindingRootAuthority；自行拥有catalog/reader/A3/ledger/队列。ready成功只代表素材已离线验证，仍disabled。失败不安装/启用任何东西。

- enableReview显式等待ready及空HTTP槽，启用review；不创建socket。缺省executionProfile=first-window-review/1，复用R2入队/派发cached0/11门禁，remote4与保存拒绝。仅原创fixture可显式固定full-offline-review/1覆盖保存/命中/未知恢复，无运行中profile切换。
- hello/exchange输入完整canonical wire字节及真实服务端TLSSocket；handler仅由测试调用方显式挂载于私有127.0.0.1动态mTLS server（maxHeaderSize8192、maxConnections1、禁TLS恢复），双端地址限制；handler单HTTP/4KiB body/头计量/期限，禁编码和chunked，等待response实际close后释放槽。
- lease/manual/save/cancel/query是受信宿主内部操作，不接受网络调用。manual仅请求desired，verified/playing/saved/actual只能来自有来源的独立报告；cancel仅取消当前已派发target并先栅栏其晚回执，不伪造设备cancelled phase。新意图仍由单latest队列处理。
- snapshot返回review观察与wire扩展，未接公开UI白名单；resources供诊断。disable先fence，再等真实HTTP退出；close还释放A2 worker/pin/reader并关闭A3，不关闭借用store/session owner。R5读任务即使已abort也须等实际handler退出，不提前清ticket/pin。调用方负责退出server、所有socket及临时根；资源不确定时不得重连抢槽。

R5现已接[临时metadata/Range GET](round-pet-wire-get.md)，与A4共享读许可/逐块授权/实际退出。readBudget缺省null，首窗口始终不发permit；仅显式full-offline-review加预算可验证。GET关联授予permit的exchange，无独立请求序列；R3修订2JSON合同/固定向量不变。它不构成设备或生产承载准入。

## Hello 与严格版本

[R3合同修订2](round-pet-wire-v1.md)只扩challenge/ready的execution_profile候选（首窗口/显式离线full-review），不改已有字段或原78正例字节；新增2正例，当前80正/62反经原独立Node/C++宿主对照。旧R3[合同](vectors/round-pet-wire-r3-contract.json)/[向量](vectors/round-pet-wire-r3-vectors.json)按原SHA保留，新的SHA须固件重新审阅，单方提案不代表双方已同意。

新adapter完整校验schema2/包/版本后，显式构造旧session begin/confirm输入，包/版本/挑战/单调request_seq绑定同socket和context。session增加discard(socket)仅清该socket未完成挑战/当前会话，不写元数据。旧hello闭合字段不变；新信封不能直接调旧入口。confirm后ledger以该hello request_seq设高水位，exchange不能回放到握手前。断线/坏选择/重放清挑战/ledger/队列，重连须新hello/库存/lease，不回放旧manual。

lease命令派发才由原beginLease登记发送时刻，回执子记录经原canonical lease parser、TLS attest、guard accept；不造proof、不以UI入队计时、不延TTL。动态日期/撤销/元数据仍逐scope验证，A10已有减量不重做。失败会话直接被现有auth销毁socket，**不保证总能收到HTTP error体**；未建立权威的格式错误可固定错误码响应，未暴露raw cause，无自动重试。

## A3 schema2 与 A8 顺序

A3新增显式openWire/ingestWire/prepareIngestWire，旧ingest依旧schema1。新入口先验证R3原记录及原始context/proof，再集中规范化旧reducer已有语义；schema2 admission、maintenance generation/reason、历史source_context及touch/cancel保存在有界只读扩展中，不静默丢字段或扩公共UI schema。

缓存命中already_available只接受**当前已确认同root、同F/bytes/action/generation**库存，历史记录保留inventory_reference，不生成saved或提升floor。saved仍root_commit；cancelled_pre_gate仅取消保存结果，不代播放取消。cancel先标本地intent fence，晚playing会失败关闭，保存可继续saved/unknown；cancel.outcome_unknown同样使库存unknown/阻新写，不能借playback_only推导Flash回退。触摸有独立event_seq/token/phase顺序，仅观察、不回发remote4；实际本地优先/首帧寿命仍需设备执行钩子，不能用PC事件替代。

storage/inventory由A3prepare得到私有候选及checkpoint→退出readView→A8 durable CAS→新同步scope核同session→commitPrepared，之后才能ACK/发下一control。失败discard并fence；before_write不发布，after_rename结果未知也不发布，只有明确关闭旧owner/重开临时store才读取持久结果。完整库存确认前写门禁关闭；unknown不降floor、不补历史saved、不盲重试，完整同绑定新库存查询才能解除。淘汰以新完整root更新offline_available，saved历史保持。

request_seq/dispatch/operation/target/包/lease epoch先经R3 ledger关联，实际操作/根语义再经A3/A8；后一步失败会整体fence会话，不能继续用已推进ledger的半接受状态。最大1 HTTP/1待ACK control/1 latest/1 ordinary及有界紧急旗标，ACK及入队deadline保持，close不自动重放。

## 验证与回退

30专项见报告：实际临时TLS/绑定映射、原创A2素材与虚拟时钟，含命中、维护/历史画面、本地触摸、取消迟到、marker未知与低root、before_write/after_rename不发布、撤销/坏档、重连及真实退出。不是ESP资源、固件RTOS/刷新/持久事务、物理掉电或最坏延迟证明。

```sh
node scripts/verify-round-pet-g0-r4.mjs --output .cache/round-pet-g0-r4/results.json
npm run check
npm test
```

回退disable/close自有adapter后由fixture关闭自有TLS/目录，撤回新模块和A3显式wire入口即可；无旧数据/配置/namespace/期限迁移。共同G0签核、真实许可用途批准、G1/G2与独立设备窗口仍未关闭，不恢复外部A/B现场或修改固件/pet/bridge/DSH配置。


R6已增加[既有A1 actor新wire执行对照](round-pet-wire-execution.md)：只窄修loading+当前downloading读许可与A5已有EMPTY/IDLE_READY门禁；首窗口/保存/saving/blocked限制不放宽，R7同步gate收尾已另验，真实RTOS/Flash/面板及异步硬上界仍未验。
