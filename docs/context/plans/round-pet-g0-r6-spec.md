# G0-R6 A1 actor 新 wire 执行闭环 Spec（实现前）

2026-11-02。先读AGENTS、README/当前上下文、开发/维护规则及A1 actor/Flash、旧A6 executor/lab、新R4/R5 adapter/checked client。保留并行400修改，不使用子智能体；只用原创素材、独立临时CAS/PKI/绑定根、真实loopback mTLS与独立虚拟时钟。无设备/固件/真实素材读取、烧录、生产listener、插件安装/既有服务配置改变或提交推送。

## 范围与复用

复用Native360DeviceModel/Native360FlashModel/MemoryNative360Flash、既有createRoundPetExecutor；executor增加显式wireProfile=round-pet-native360-wire/1模式，缺省旧候选不变，不在runtime/插件产物加入模拟actor。R6只接模拟设备端新记录/控制映射及测试驱动，不新写Flash、认证、lease guard、队列、root authority或PET4解码器。

测试lab复用R4/R5真实TLS/A2仓库/GET/逐块授权与A8绑定根；关闭自动伪造peer观察/执行，lease仍由原encodeLeaseV5与guard，actor库存由真实模型恢复/提交得出，网络字节必须来自新GET。独立deviceClock偏移700000ms，剩余lease按原保守预算换算，未把host绝对时间发设备。R3修订2/80正62反字节不改，不新增生产入口。

## 契约和实际差异

1. 所有记录由actor transition派生：accepted只请求；load未命中为downloading，supply不verified；verify须完整F/PET4/241帧CRC/index，prepareFrame不playing，只有submitFrame注入刷新提交才独立发playback playing与display；模型事件不称真实面板完成。
2. 旧executor schema1/saved命中只保留旧模式；新模式schema2明确admission、display维护generation/source context、storage commit_stage。already_saved转already_available/inventory_reference、同对象同root，不伪造新root_commit；库存按action_id排序，仅对完整同根表示规范化，不改变manifest/P/M数组身份。
3. 新control完整target/control/package/mode/descriptor必须与批准manifest及actor一致，取消不再只收裸command_id；新模式outbox只用R3 record关联、上限16。模式错误/旧对象混用拒绝，旧A6信封/fixture保持。
4. 保存只在模型verified/playing后；完整payload/staging不可用，commit后saved仍不等于当前库存/playing，淘汰由新完整inventory确认并经A8发布。gate前取消产生cancelled_pre_gate及独立cancel.report；gate后只栅栏播放，可继续saved/unknown。保存deferred先释放dispatch，终态同operation_id且更高seq，无盲重放。
5. marker尝试/读回失败仍outcome_unknown，不报未保存或补历史saved；恢复通过现有actor recoverStorage/reboot和新库存，I/O失败保unknown、低root/同seq冲突不降A8 floor。模型Flash仅内存逻辑持久，不宣称实体V2/掉电证据。
6. 正常断线/新hello不重启actor/清缓存，只用beginSession清volatile；新lease/库存后新revision目标，旧load/frame/context/outbox拒绝。历史画面通过带旧source_context的display snapshot真实呈现，不复活旧命令。gate期间失联不得偷偷清门禁：beginSession可拒绝commit_in_progress，需另显式模拟重启/恢复，不承诺无缝跨会话提交。

## 两处必要宿主修正

R5读许可拒绝所有maintenance，与actor下载冻结loading不相容。仅在显式full-review、当前目标已ready接纳且A3 playback=downloading时允许loading；saving/verifying/recovering/blocked、本地触摸、旧目标/lease仍拒绝。maintenance通过显式display查询由actor提供，不篡改为none或伪造旧动画持续。原R5其他门禁/预算不变。

复用A5已有安全状态规则：EMPTY只准0，IDLE_READY只准0/4，完整OFFLINE_READY才扩其他动作；在新adapter入队/派发检查，actor仍独立验证。不得用full测试profile绕过保护0/4、4活跃+1暂存或不安全bootstrap。R2首窗口仍cached0/11、禁止远端4和保存。

## 验证、验收及回退

30专项覆盖真实初始库存/时钟偏移；缓存与未缓存路径；全下载/坏F/CRC/index；prepare/submit独立首帧；旧画面loading与GET门禁；完整staging/不完整commit；root保存/A8发布/淘汰/命中非saved；保护/EMPTY bootstrap；payload/header/marker/读回故障/unknown与查询恢复；gate前后取消；新context重连、旧ticket/回执/未缓存半截拒绝；模型reboot与owner重开缓存；关闭资源归零/候选排除。新actor路径不用静态peer编造库存/播放/保存；故障注入仅自有medium或字节副本。

独立监督CLI正常/SIGTERM清理，npm run check（仅.mjs语法）、npm test（含构建），只在新失败时扩大。更新当前摘要/交接/待办及按主题归档旧“尚未接A1新wire”记录。真实角色许可、共同G0/GET合同签核、固件G1/G2、生产/设备窗口仍未完成，不把模型闭环当准入。

回退关闭自有peer/server/adapter并等实际HTTP退出、释放actor medium claim与A2 pin后删临时根；撤回显式executor新模式/fixture及两处窄宿主修正即可，旧A6路径、R3 JSON合同、namespace/磁盘格式/TTL不迁移。不改外部锁/固件现场/既有服务。


## 实施状态（2026-11-02）

本片已实现，见[报告](../../reports/2026-11-02-round-pet-g0-r6.md)：30专项、check（仅.mjs语法）及含构建910全套通过，正常/SIGTERM自有临时清理通过。A1核心/R3合同及向量保持，旧未接actor状态已[归档](../history/round-pet-g0-r6-evolution.md)。gate期间失联/暂停收尾、共同签核/真实许可/固件G1/G2/生产和设备仍未完成；保留本实现前范围/回退依据。
