# TCP-19 Spec：共享后台控制会话与按期限恢复（实施前）

2026-11-05。用户明确同意后台共享逻辑会话、页面重新附着和设备重连恢复；先读规则/当前摘要及TCP18 channel/UI/owner。主线纯Node，先离线/原创loopback，不接设备/生产服务或改现有配置。TCP18非共享模式保持回归兼容；本片推荐显式shared模式进入sourceKey，不能把既有只读/单会话服务附着升级。

## 三层生命周期

prepareNative400NodeControlAccess增加shared=false、autoRecover=shared布尔策略；autoRecover仅shared可true，写入descriptor。shared逻辑会话归UDS赢家/同一来源窗口持有，保存全局seq/revision、最新目标和32条有界完整请求ACK记录。页面凭据分别授权，最多16个内存attachment，各有原sessionMs期限；authorize在shared模式复用当前逻辑session并新增token，不取消旧页面/目标，不续设备窗口。sessionMs现在是该页面权限期限，不能续动作TTL。

新增可信本地detachControls仅撤该attachment，不取消后台意图；页面unmount依旧只关自己的HTTP/poll，重新打开由宿主重新授权后读同一后台状态。原revokeControls明确撤整个逻辑会话/所有token并取消目标；新增endControls允许后台操作者在无活跃页面token时明确结束。随后重新authorize是新逻辑代，不复活旧目标。来源/audit/request/窗口失效、service关闭仍全部fence；不持久化token/命令/逻辑会话，服务进程重启不能假装延续旧wire会话。

## 设备重连

继续由设备主动连接hub；hub不扫描/拨号。每次TCP重连仍新HELLO/OPEN/session/controller，不复用旧socket身份。仅在shared+autoRecover策略、来源/窗口/网络仍有效、原最新目标未过期且未取消/撤销/暂停时，通过既有owner.reapply使用剩余TTL。定时维护恢复，不用页面GET驱动写操作；成功准备恢复后同一连接不反复重发。重连过程中新的base只保留latest，期限不重置，旧ACK/旧连接关闭不影响新代。

新增owner内部opaque recovery handle，按每次base的唯一intent key绑定。reapply保持同key；取消/新base/close使旧handle无效，pause禁止该handle自动恢复，显式人工reapply可重新允许。这样可信本地直接base同action的新目标也不会被旧逻辑会话代为恢复。不更改wire/codec/固件，默认owner模式仍不自动恢复。保留失败关闭/退避、独立first-frame与当前显示未知，自动reapply不制造accepted/verified/playing。

## IPC/共享界面

仍用原controls/command路径、Bearer/实例/token/Origin白名单、闭合请求seq/revision。shared全局CAS防多页面覆盖；32条缓存内同一完整请求可确认，换页或换凭据不重下发/续TTL，淘汰的旧请求明确拒绝。页面看到的是共享session ID，不是共享bearer；token仅服务/宿主内存。

envelope可选shared profile=native400-shared-control/1，包含后台desired剩余寿命/恢复策略与计数、attachment数量、最近命令白名单元数据；旧envelope无shared仍按TCP18验证。共享状态只描述意图和恢复，不表示设备播放。UI重新挂载可同步后台目标；同组新token不变更逻辑ID。真正逻辑组/服务换代时丢弃旧pending，接纳新授权状态供后续明确操作，不自动重放旧body；legacy模式原stale保护保持。未知ACK仍需原请求确认，轮询只读。没有新增页面authorize/配网/无限续期接口。

当前仍受原120秒有限来源窗口约束；产品长期连接策略另行准入，不简单拉长窗口/TTL掩排队。页面/设备断线后重连恢复是本进程/有效窗口内保证，不承诺跨服务崩溃恢复旧动作。

## 验证与回退

先补Spec/Diff再实现：真实原创audit/来源窗口、UDS/HTTP/React hook与loopback设备模型。覆盖两个页面共享seq/CAS、detach/凭据到期/无页面继续、未知ACK重新附着确认、32条缓存淘汰、16attachment上限、显式结束/撤销、源/窗口失效；新HELLO自动恢复剩余TTL且一次、新目标/到期/取消/暂停/外部新意图不恢复、旧连接/回执保护及资源退出。保留TCP18 legacy回归，不把模型PRESENTED当ESP首帧。

专项/独立CLI、check及npm test含build、最终build；事实更新摘要/G0并归档被替代默认下一入口。回退显式end/revoke→await窗口/来源退出再清临时目录，unknown保现场不抢锁/重发；新策略省略即TCP18旧行为。无真实LAN/ESP/USB/Python/固件/素材/生产服务/profile/pet/bridge或插件安装变更，不提交推送。浏览器DOM/DSH provider与真实设备业务仍待。

实施状态（2026-11-05）：已完成。29专项/隔离CLI、npm run check与含build全量1784/1784通过，最终build通过；旧窗口ready/handler竞态和页面读取恢复旧提示均先复现再修复，未放宽断言。仅原创临时源/真实loopback/组件hook，浏览器、实际DSH provider和ESP待验。[报告](../../reports/2026-11-05-tcp19.md)/[API](../../protocol/native400-shared-control.md)。
