# G0-R3 正式 wire 提案与双语言向量 Spec（实现前）

2026-11-02。已重读AGENTS、README、上下文/规范、R1/C01–C12交接、R2及A3/A4/lease实际闭合字段。保留已有/并行400修改，不用子智能体。只在本仓库/自有临时目录离线验证，不访问设备/运行DSH/pet/bridge、不启生产listener、不改固件/配置或安装插件，不提交推送。

## 范围及边界

管理端冻结一份**待固件共同确认的正式wire提案**，新增独立round-pet-native360-wire/1；media profile仍round-pet-native360/1，旧A4 candidate及/v5均不改名/自动转换。完整字段/错误/最大报文与Node/C++宿主正反向量为交付；不把管理端单方实现写成联合G0关闭或固件已支持。

1. 闭合契约表覆盖hello begin/challenge/confirm/ready、exchange request/response、分页和error；明确protocol/profile/schema、完整context、request_id/request_seq、版本选择、(P,M,N)与媒体descriptor。控制4KiB/头8KiB/Range32KiB/写块4KiB沿设计限额，未测设备预算不准入。选择request_seq兼作当前会话请求/心跳新鲜度，不保留重复heartbeat计数轴。
2. 保留phase基本枚举；playback新版本显式ready/deferred_local接纳，display维护信息版本化；storage新版本分saved/root_commit、already_available/inventory_reference、deferred、failed、cancelled_pre_gate、outcome_unknown。独立cancel结果表述gate前取消/仅取消播放/结果未知，不用saved历史或HTTP200清播放事实。
3. hello显式固定版本集/能力schema2/media扩展与会话包；首窗口执行选择cached-only，动作0/11/本地4仍由R2策略/授权处理，wire格式可表达后续G4且不构成许可批准。租约子记录复用现有语义，剩余时长不转绝对expiry，未经新握手旧端拒绝。
4. 完整错误码到HTTP/恢复动作的固定表，不返回原始cause/URL/凭据；不在编码器实现自动重试。query/read有限重试与新会话/续租/unknown只查询分开，副作用不盲重放；实际资源期限/漂移由既有guard负责，不从向量样本定上界。
5. 纯core有界会话往返账本仅校验context、单HTTP/单control、uint64序列、dispatch/操作/target/包关联；超时/租约/认证/投影仍复用既有owner，R3不加listener/新UI/握手认证器或绕过A8提交顺序。

## 双语言验证

新增原创C++17**宿主**检查器，stdlib/固定有界解析，不使用第三方JSON库或固件代码，产物仅临时目录。与Node独立解析同一契约表和字节：重复键/未知键、UTF8/Unicode、canonical/整数、uint64极值、版本/身份字段、包/descriptor、状态条件、大小及错误映射；正例输出原canonical字节，固定SHA复核。契约表是共同输入，解析/校验实现各自独立，不能把它称ESP双端栈已互操作。

向量必须是无秘密虚构身份/原创descriptor；存固定canonical字节/长度/SHA与正反预期，不含真实素材/运行配置。至少覆盖所有消息/控制/报告种类，缓存命中/取消与marker未知、迟到/重排/错误dispatch、错误profile/数值/过大/缺字段、头路径/GET预算规则与8动作页。固件任务后续独立使用相同向量签核；本轮不修改或编译固件仓库。

运行新增监督CLI（只文件/临时C++子进程，无socket）及正常/SIGTERM清理，再npm run check（仅.mjs语法）和npm test（含候选构建）。向量校验不证明证书/可信时间/物理Flash/RTOS/性能；头/Range规则本轮是合同/离线校验，不新装配HTTP handler。发现实际表达超4KiB须缩小页/字段预算，不能延TTL/扩大原保护限额掩盖。

## 交付、下一步与回退

更新共同提案、C01–C12/当前摘要/待办/来源边界，归档R2被替代的wire未定义记录，保留其执行/身份/许可及并行400结果。列清Node/C++宿主已验与固件未签核、正式runtime适配/实物资源未验。真实库独立许可/用途批准不由本轮虚构向量自动完成；不重新导入或发布素材。

回退删除自有临时C++产物/监督根或撤回独立codec/向量，无数据/配置/格式迁移，旧A1–A10/R2继续有效。真实适配需后续Spec/Diff、固件签核/资源G1/G2和独立设备窗口；不处理外部A/B中断现场，不自动把旧候选转生产。


## 实施状态（2026-11-02）

本轮范围已实施，见[报告](../../reports/2026-11-02-round-pet-g0-r3.md)：24专项、78正/62反Node-C++宿主字节对照、check与含构建811/811回归、正常/SIGTERM临时清理通过。正式runtime adapter/固件签核、真实素材批准、G1/G2及设备窗口未完成；旧wire缺口已[归档](../history/round-pet-g0-r3-evolution.md)。本Spec/Diff保留实现前范围与回退依据，不把管理端单方提案写成联合G0关闭。
