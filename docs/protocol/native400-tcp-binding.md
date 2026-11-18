# TCP-05：离线四缓存绑定与 v0 初窗决定候选

2026-11-05。[Spec](../context/plans/tcp05-spec.md)／[Diff](../context/plans/tcp05-diff.md)／[报告](../reports/2026-11-05-tcp05.md)。这里是管理端已实现的 offline-loopback 准入及交接，不是双方生产签核，不是可安装到设备的配置文件。

## 分析结论与版本

终端最新完成证据为 `apps/round-pet/reports/2026-11-05-400-socket-owner.md` 与 `docs/protocol/round-pet400-socket-owner.md`。177工具、ASan/UBSan、TSan、C++与Node实际mapping函数对拍、真实TCP02六消息及三配置构建通过，均为上游报告，本轮未重跑。默认56b0482e…606752B、adapter c192c75b…625072B、owner dee8e331…716784B均未上板，板上仍f553。合成worker的网络实验不能与旧实际LVGL宿主组件相加称ESP端到端。

本轮期间外部源码与报告并发推进，已重读最终owner合同：PET_TCP_SOCKET_OWNER默认OFF，identity builder、Bridge model-ready、单fd/link epoch/drain和静态8KiB任务已实现。没有真实arm/link调用者，不初始化Wi-Fi、网络不能configure。owner plan显式9420B、整体DRAM较默认+15184B，PSRAM4439288B不变；静态构建不代替Wi-Fi/lwIP堆/栈/时延。不能再把owner标未实现或用旧0e2/Bridge+3904B预算替代新候选。

本轮复用现有收发/播放桥，优先补其配置来源。现有native400TcpCatalog仅是计算工具，调用方给出namespace/index/recovered不代表可信；新增准入层实际调用400-08的私有PC文件reader，而非消费journal自哈希或任意“已恢复”列表。STATE新type/长度/能力协商仍无共同决定，因此不新增wire或重复造收发框架。

## 映射规范化与域

recipe原样采用端侧草案：SHA256覆盖ASCII `pet400-tcp-map-draft/1`＋单个0字节，接 N_boot/source manifest原始文件SHA/所选hub index原始文件SHA（各32字节），再接按action升序的四项，每项 `u16LE action/u32LE bytes/u16LE frames/F SHA32`。没有JSON、末尾LF、额外padding、路径或boot/session。四ID唯一且正好0/1/4/11，均241帧；不是42号118帧的通用78动作网络描述。

本候选固定 N_boot=`a34d0c7b…26e2a`，来自V2已核格式家族；P、M、N_offline、整cache SHA或来源map SHA不能替代。所选index明确取独立批准metadata的`source_index_sha256`原始域，不能用`metadata.indexSha256`（管理端重建规范化index）替代。原始完整78和八语义index不是别名；当前复用400-01的78项metadata，不新增八语义输入解析或自动降级。更换来源/index须重新准备独立匹配的输入和决定。

map SHA绑定PC源的双根、序列、物理槽/代数、完整cache及逐payload哈希；TCP mapping仅绑定约定内容身份，不包括物理slot/root序列/boot。相同四文件迁槽或root序列变化可保持mapping，但本片旧source_map决定仍不能复用，必须新鲜审阅匹配。摘要/nonce/controller ID都不构成认证。

[固定recipe向量](vectors/native400-tcp05-mapping.json)为原创合成输入，包含乱序、u32极值、换index/namespace域。C++原创writer独立重建完整preimage，Node SHA256与固定digest及原native400TcpMapping比较；**C++不独立计算SHA，不使用端侧mapping函数，也不声称终端已采用真实映射**。极值bytes仅测试recipe数值，不是合法PET4或槽容量批准；实际准入由原400-08槽/长度/F校验约束。

## 默认关闭接口

`packages/runtime/native400-tcp-binding.mjs` 暴露：

1. `prepareNative400TcpBinding({package,catalog,approval,mappingApproval,decision})`：纯准备、深拷贝，重算400-01 metadata并复用400-08 inspector。返回WeakMap绑定的opaque option，JSON/clone无法恢复。不读取文件，也不从文件/账本自行批准。
2. `createNative400TcpBindingReview(option,{enabled:true,file,signal?,...trustedHooks})`：先selection元数据选择，再把opaque reference交原reader在实际fd首读前钉住；整28MiB与四物理payload流式SHA完成、实际fd关闭后才匹配decision。源map严格原schema，双根必须健康，不接受degraded/fallback；旧review仍可诊断降级根，两者用途分开。
3. `ready`：只返回PC源快照描述，四对象/F转原native400TcpCatalog，核独立mapping后才创建一个TCP02 owner。此时仍无listener。没有设备配置导出或持久保存；以后文件再变化不改变这份快照，也不被称为当前文件/ESP库存。重复使用option会执行新的实际审阅，不能从旧ready跳过重读。
4. `start({enabled:true,host:'127.0.0.1',port:0})`：额外显式临时监听。所有其他地址/固定端口拒绝。原base/cancel/reapply/pause/resume/tick由新任务受控转交原owner，不改会话、动作TTL、PING或重连策略。
5. `close()`：同步拒绝后续操作、关闭原owner、撤选择/取消reader，等待实际I/O/socket退出；可重复调用。外部signal关闭整个任务，包含ready后已启动的owner。忽略abort的read/hook仍占fd直到实际返回，不能先报清理完成。start/close竞争不留下listener或timer。

decision闭合8字段：schema_version=1、profile=`native400-tcp-offline-binding/1`、usage=`offline-loopback`、source_map_sha256、mapping_sha256、hub_index_sha256、integrity_policy=`file-sha-metadata-frame0-crc`、presentation_policy=`first-frame-history-only`。三个摘要必须由可信本地调用方独立给出；缺字段/未知字段/其他版本/production或whole-media用途拒绝。原approval的offline-validation、mappingApproval的offline-source-review不扩成生产许可。

`snapshot()`只给阶段/稳定错误/候选描述/原owner只读观察，`resources()`给实际fd与owner socket/session/timer/listener计数，不暴露文件路径或批准正文。候选描述`inventory=pc-source-snapshot-only`、whole_media/device_evidence=false；v0没有独立验证报告，owner的verified仍null、current_display仍unknown。policy表示本地选择的预期完整性层级，**不是从HELLO协商得到的能力或一次设备校验成功**。

## 交给终端任务的决定／待确认表

| 项目 | 当前状态 | 下一动作 |
| --- | --- | --- |
| LAN明文TCP、PTC1七消息、remote0/1/11、4物理触摸 | 用户已定方向，两侧已有宿主代码 | 不重开TLS/WSS或broker前置，不把模拟当ESP接入 |
| v0 mapping recipe | 端侧已有草案；管理端本轮offline候选采纳并Node/C++字节验证 | 端侧最新报告已验证C++与Node实际mapping一致；本轮只重跑原创preimage writer，真实四资产与原始index仍需独立核定，不从本合成向量生成设备配置 |
| 配置来源 | 管理端新鲜PC源审阅与独立决定已实现；不产生当前设备库存 | 端侧可信本地Config须核实际恢复Catalog四F及批准来源，网络不能configure。设备身份/绑定准入仍未关闭 |
| 本地完整文件SHA＋metadata＋frame0 CRC，EOF整段SHA | 端侧实际worker/Bridge已实现（仍默认OFF）；管理端新候选明确要求此预期层级 | 端侧合同答复已采用该层级，管理候选一致；真实初窗准入仍需配置/用途/资源，区别于旧hub whole-media全帧前验；不能宣称v0分别回报了这些阶段 |
| 首窗口是否需要新STATE | 两侧文本已一致：保持v0首帧历史，current_display unknown、verified null，不伪造持续playing | 已读端侧合同答复确认同一语义；不据此签核生产或探发新type。若需求必须持续状态，再共同定义扩展 |
| Remote循环换source、Touch结束与最新base | 端侧已实现；TCP04审阅器处理内部stamp，TCP03直接接线不兼容 | 维持内部事件与v0首帧历史分离。WholeSha/FrameReady/Completed/失效暂不发wire，Touch无Presented不能合成显示成功 |
| 取消/失败/关连接与实际退出 | 模型/Bridge/Core已有分层；PC侧新任务close等实际退出 | ESP owner已实现并有宿主完成证据，真实Wi-Fi/资源仍待验证；保front、意图失效、周期完成不是物理I/O终止 |
| 期限与资源 | Core TX2秒/OPEN5秒/完整输入空闲15秒，worker会话10秒；hub默认ACK2秒，均只在各自范围失败关闭 | 动态Wi-Fi/lwIP RAM/任务栈/队列/最坏往返实测待验。两秒相同不保证有往返余量，不延TTL掩盖排队，不复用loopback时延作硬预算 |

本文是交接文件，未对外发送、未代终端签核。管理端候选允许先把“缓存动作初窗”限定为历史首帧，避免让未定的持续状态扩展阻塞所有离线配置工作；正式启用真实身份/用途与资源门禁仍待联合确认。

## 验证、未覆盖与回退

17项专项：独立scope/index/摘要拒绝、实际fresh read、健康根/坏payload/路径替换、abort/close等实际退出、start-close竞争、真实新路径loopback与坏HELLO、option重读/深拷贝/u64、recipe字节正反例。loopback用原创PC缓存与JS peer，首帧由模型驱动，未执行ESP/真实Source/View；端侧177工具/C++六消息/三配置构建只引用上游报告，本轮未重跑。

回退close并等待自有fd/socket/timer归零，再删自己的临时根；不创建候选即可回到原TCP02/04默认关闭状态。无持久格式、生产服务/DSH/pet/bridge、固件/缓存/分区或素材修改，无安装、提交推送。下一按已核一致的最小v0边界确定真实可信Config/用途、管理端LAN入口和终端STA装配Spec/Diff与回退，再审ESP资源短测；丰富状态的同PTC1扩展/字节向量、TCP媒体流、保存/掉电/长测、400-L/V3另做。
