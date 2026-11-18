# TCP-04 Spec（2026-11-05，实施前）

读取本仓库规则/上下文/TCP03与终端最新status/todos、control-bridge接口/报告及实际control_bridge.h。新事实：默认OFF Bridge已接worker/Source/SHA/CRC/View完成/EOF，输入8输出16；默认f2cfaa4a/adapter9dc15171未上板，板上仍f553。不能重复开发固件bridge，也不能将它写成正式TCP已接入。

本片仅管理端默认OFF的Bridge内部事件归一/审阅器与显式宿主C++对照，交接字段调整；不分配新wire type、不发TCP扩展、不接ESP/生产服务/插件/profile、不写固件或运行其脚本。保留既有修改，不用子智能体/提交推送。

实际代码差异需对齐：WholeSha在Source.bind前，source/mail为0；FrameReady后才有source/mail和CRC完成。相同remote token循环会换source/cycle，WholeSha/FrameReady/Presented仅每intent一次；Completed每cycle一次，不能要求每圈重发proof，也不能拿Completed生成新首帧。Touch没有Presented事件，不得由FrameReady生成Touch已显示。Connected/Ack的stamp非当前播放凭据；ConnectionClosed不是Touch退出，IntentInvalidated/Completed都不是实际I/O销毁。

新增core纯候选，由未来可信调用方在同一boot/mapping/恢复资产scope中创建并显式启用（本候选只接四对象，不从Event自建boot/mapping），transport为非零u32严格递增，事件从未来已审adapter转换而来。可信调用方还须expectBase固定本地已选session/request/action；事件不能自报建立控制目标。只有同transport事件才处理时间；旧事件/旧hint不污染新代。stamp全intent/token/session/request/source/mail/cycle/action校验；phase分别file SHA（含reused声明）、frame ready、View first-frame report、completed cycle、invalidation/failure。无whole-media/saved/物理面板扫描或实际I/O退出推导。输出满hint必须独立处理，不能仅等ConnectionClosed消息。

事件对象严格封闭schema（命名沿端侧Event），uint64字符串/uint32 Number；内部对象不是网络JSON。one active stage/last frame历史/最高cycle与token，重复不积累队列，冲突/坏当前事件失败关闭。重连显式begin新transport；无grant/真实catalog自动批准。默认不桥接TCP03，因其固定token/source、非零source verification与现端侧循环语义不一致；保留原候选，记录修订依据。

测试：原创合成事件、虚拟时间，SHA-before-source、FrameReady/Presented分离、reused SHA、remote两圈仅一次Presented、touch/本地随机、失败/失效/连接关闭/输出满hint、旧transport/cycle/source/mail/timestamps、schema/uint64。可显式只读include终端header编译本仓库原创C++host driver，调用真正Bridge生成事件再经Node审阅（仍模拟worker调用，不是真实Source/View）。不复制端侧实现/运行其脚本/构建ESP。默认npm测试无外部路径依赖；可选对照另记，不冒称Node/C++新增wire向量。check/test含build。

回退丢弃候选、只保历史，无持久配置/格式迁移；TCP01/02/03默认入口保持。下一共同落实事件→wire协商/类型/长度/校验等级，再二进制对拍与端侧socket-owner/Wi-Fi资源短测。媒体流/保存/V3后置。


实施状态（2026-11-05）：本片代码与21项宿主验证已完成，显式C++ Bridge对照通过；检查/构建和全套证据见[报告](../../reports/2026-11-05-tcp04.md)。新增源审阅发现未接app_main的control_transport.h v0回调Core草稿，另记[共同交接](../../protocol/native400-bridge-event-alignment.md)，未运行或采纳为正式owner。无新wire/loopback/设备结果；旧摘要见[归档](../history/tcp04-evolution.md)。

收尾补强：本地换目标先历史化；同token不能换intent；失败/失效/Touch完成退役token，Remote Completed仅退役cycle，不阻止正常后续圈。追加既有专项负例并复验，计数仍21。
