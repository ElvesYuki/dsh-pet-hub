# TCP26：管理端采纳 native400-preserving-renewal/1

2026-11-06。[实施Spec](../context/plans/tcp26-spec.md)/[Diff](../context/plans/tcp26-diff.md)/[报告](../reports/2026-11-06-tcp26.md)。管理端设备/播放oracle现已采纳终端合同，使用冻结的24步实际C++ Core/Bridge记录验证Node设备端和实际TcpHubControl；不代表设备已部署。上游合同为终端仓库`docs/protocol/round-pet400-preserving-renewal.md`，来源与固定指纹见[证据](vectors/native400-tcp26-results.json)。

## 一致语义与API

PTC1七消息、CRC/长度/完整action+asset SHA、10秒session/PING、有限BASE保持。没有新HELLO能力位、配置开关或协议消息；不对旧peer猜保位支持。

- `TcpDeviceModel.target.seq`现在固定为播放实例起始BASE；`request(token)`才是当前有效remote的最新命令。合法同session、同固定完整asset的BASE只更新截止/latest request/接纳时间，ACK code2保原token。坏SHA/TTL只返回错误，不更新最新命令时间；重复同seq/body仅原ACK，不续任何期限。
- source周期与请求去重分离。`beginCycle(token)`清当前prepare/source，保留已报request。`prepare(token,source,sha)`仍只供可信模拟worker，在完整SHA/metadata/frame0 CRC成功之后调用；此处由合成回调驱动，无真实媒体证明。
- `presented(token,source,frame=0,drawAt=clock())`匹配当前实例和源，frame必须0。初始新实例可同接纳ms，不得更早；续租drawAt必须严格晚于最新接纳ms。返回record的seq取最新命令，token/source和播放起始seq保持；没有新frame0不得靠ACK或续租合成回执。相同request最多一次，循环不会清去重。
- `TcpDevicePlaybackModel`独立纯core oracle表达worker/Bridge：begin→verified→bind(source/cycle/mail)→decoded→presented，begin新源周期清准备证明，不由续租触发；保存的stamp含起始seq，输出record才用latest seq。有效frame0绘制回调每cycle只消费一次，旧/同ms有效draw即使无法证明新请求也消费该cycle；不能晚些换时间再报。坏stamp、非frame0、无效draw/future或早于decoded不消费有效cycle。
- `advanceFrame`只是合成worker进度标记，用于验证同目标BASE不重建源/帧位；不是媒体解码或实屏计数。`eof`确认当前完整源/最后ACK，remote可随后开始新循环，touch完整结束才按最新有效目标恢复。旧EOF、旧source/cycle/mail/transport/stamp无效。

不同完整身份、取消、先到期后新BASE、断链/新session仍换播放实例；同动作显式重播应先成功CANCEL再BASE。touch期保持Deferred/token0、本地stamp及显示优先，EOF新起播最新有效remote；目标无效则local。BASE不代替PING，续租不延来源/页面权限或lane期限。

## Host、共享来源与兼容

TcpHubControl类体及owner无需更改：新BASE清旧accepted/首帧观察，同token合法ACK可接受，Presented仍核最新seq/session/token与期限；Deferred不加首帧到达超时。观察在下个真实frame0前unknown，verified仍null；不恢复旧首帧或声称whole-media/current playing。

同文件的设备oracle变更使host导入模块SHA改变，因此[六模块pins](vectors/native400-tcp26-manager-pins.json)重新计算并在联合验证前后检查；旧终端pins仅是之前验证快照，不再可用。实际TcpHubControl类体SHA单独保持，owner/wire、HTTP source/bridge/channel等摘要保持；新增播放oracle不进入host的六模块闭包。

A的显式`endpoint-arbitrated`、默认event/observed-local及可选B草案不变。保留新鲜HTTP收据、观察source/page权限/lane三期限及往返扣除、>7500ms准入、2秒低水位/新5秒、CAS/manual优先、unknown原body及只撤自身目标。true/false autoRecover仍只恢复原intent剩余TTL，新连接须新HELLO/OPEN，过期不复活。down/paused的共享取消清逻辑目标，不冒称设备已执行未送达取消。

历史`native400-bridge-events-proposal/1`是独立未接wire的全事件观察候选，仍按旧起始请求/每token去重，不作为本片PTC1或实际显示证据；如以后接全事件，须另行适配latest命令与起始stamp差异，不能直接套用。本片不扩大其能力。

## 验证、许可与准入

`node scripts/verify-native400-preserving-renewal.mjs --output .cache/tcp26/results.json`监督44项：24个A HTTP/UDS/真实loopback案例＋20个纯模型/冻结C++记录/负例测试。上游24步实际C++记录逐字节保存为[fixture](vectors/native400-preserving-renewal-endpoint-v1.json)，许可Apache-2.0，来源在[THIRD_PARTY](../../THIRD_PARTY.md)；本仓库独立JS实现MIT。该命令不运行上游脚本或编译器，不构成重新执行C++、实际媒体或ESP验证。

离线语义采纳与向量对齐已完成；真实窗口的共同准入尚未冻结。必须固定双端实际候选/运行指纹、设备、原缓存身份和独立素材/来源/用途/有限权限窗口。新station构建未上板，设备最后确认仍f553/af5b。终端构建的3944B静态控制内部（+40B）、PSRAM4439288B等只是外部报告，不是动态RAM/栈或实屏连续性准入。真实pet加载身份/自然迁移仍待，禁止重复空闲取样或自动发模型任务替代证据。

回退默认event或observed-local，关闭自己bridge/source/临时owner并await I/O；不改变任何运行配置、存储或wire格式。旧peer不自动升级，保留TCP25重播反例报告；改用旧peer时关闭A，不能借本片oracle推定兼容或准入。设备回退仍由终端另行授权只app操作，原400/360成套保留；本片不刷写。严格24fps不是本窗口门槛，媒体流/保存/V3/长测继续后置。
