# TCP29：固定副本实际hold宿主

2026-11-06。[Spec](../context/plans/tcp29-spec.md)/[Diff](../context/plans/tcp29-diff.md)/[报告](../reports/2026-11-06-tcp29.md)。已通过真正子进程构造/start→HTTP→原授权IPC/TCP→到期/退出闭环，不再是import-only。SHA/decode/draw仍为合成端侧模型，未接DSH/pet/ESP。

## 可用调用入口

runtime/index导出`createNative400PetHoldHost`。可信本地调用示意：

```js
// 原audit/独立materialReview/windowDecision/request/controlAccess和window
// 均由同一可信父模块图创建、保持存活；没有JSON重建这些能力。
const host = createNative400PetHoldHost({
  enabled: true, snapshot, window,
  base: explicitReadOnlyPetBase,
  expectedRevision: '0', runMs: 45000, sourceMs: 60000
});
await host.start(); // 已在固定子进程实际construct/start，不代表首帧
const result = await host.done; // 自然到期，或明确await host.close()
// 最后由原owner单独关闭window/request/audit及snapshot，不由host代关。
```

snapshot须为同一父模块实例创建的genuine execution snapshot，manager entry固定`packages/runtime/native400-pet-hold-run.mjs`，包含实际依赖、原`native400-node-load-child.mjs`和新`native400-pet-hold-host-child.mjs`；Node固定24.14.1/当前可执行文件SHA。调用方沿TCP15 API显式审阅文件清单/摘要并冻结，不是扫描任意配置自助批准。child/loader/entry须与本次父模块版本的固定文件SHA一致；快照verify在实际启动前后执行，租约持有到child/stdio及原RPC退出。不得在host.done前删除快照。

父调用点的audit、原genuine Request、独立素材/用途/window批准和shared owner仍在父模块图中。NodeControlWindow内部WeakMap品牌验证只允许本模块图的已就绪赢家/shared窗口，JSON clone、其他模块实例、附着者和第二个活跃host拒绝。若window来自固定副本父模块图，factory、snapshot、audit/request/channel也须来自该同一模块图，不能混用工作区模块的WeakMap。host在加载证据通过后才调用原channel.authorize取得本次附件；**没有生成素材/窗口批准**，没有原能力时拒绝运行。

## 原能力IPC，非另一套控制器

子进程不接收bearer、原Request对象、reviewer密码或issuer。固定bootstrap内部创建只向父私有IPC转发的client：GET `/v1/node-control/controls`、POST `/v1/node-control/command`（原base/cancel body）。父以原scoped client走原鉴权UDS，原channel核实例、seq、CAS、有限权限和TTL；无绕过owner.base的旁路。

消息有闭合词汇、实例/单调请求ID、8KiB包与有界stdout/stderr限制，一条原请求在途，abort收尾最多一条等待原I/O退出；迟到响应按ID丢弃。child的AbortSignal映射原IPC请求abort，原POST结果未知不重发。BASE在父关闭/截止后拒绝，GET/cancel可用于原bridge自身收尾。网络仍PTC1七消息/明文LAN方向，无新认证、能力字段或STATE。

可选`observe`为可信父只读同步诊断回调，仅获kind/method/operation/request_seq/body SHA等过滤数据，返回值不能替换响应，不暴露完整body/bearer。专项用它精确暂停**自己的**测试父进程来丢真实IPC ACK，不在产品中加自动故障或approve入口。这里的body SHA和instance不是密码学认证。

## 同一次实际进程证据

新bootstrap从只读副本执行，复用既有node-load-child的库存/字节hash hooks和原receipt校验。得到import收据后，父确认实际pid与启动instance，才交接本次client传输。随后同一child实际调用TCP28构造/start；armed事件和原HTTP/IPC/TCP效果共同证明启动，不把export存在记通过。

result记录父/child启动instance、pid_matched、Node二进制/快照/entry/bootstrap SHA、实际loaded模块、constructed/started、最后run状态/自身资源和本附件释放结果。bootstrap自身在父前后verify并按固定SHA执行，receipt的loaded列表是原hooks实际观察的manager导入；不冒称完整Node/原生运行闭包、既有DSH/pet加载身份或独立硬件认证。

## 生命周期与所有权

构造默认关闭，必须显式enabled=true；构造不取权/开进程，start只能一次。启动默认5秒门限，TCP28仍最多45秒/默认52.5秒启动余量/原三期限、unknown同body和迟到栅栏。closeMs默认3000、允许100–5000；父运行watchdog到runMs+closeMs后要求退出，再经closeMs向**自有**进程组TERM、200ms后KILL。强制退出记unknown/close_timeout，不宣称run已正常取消。不会扫描端口/PID或杀其他服务。

- 正常：child run.close中止/等待source/桥接；发送final，清自己的heartbeat/watchdog，断IPC并退出。父等实际close/stdio、原在途RPC，post-verify副本，释放快照租约和本次grant附件、移除自有私有HOME/TMP。共享window、audit、request由原owner最后关闭。
- 父close/abort：同步fence新BASE，要求child收尾；半途启动晚回不能重新armed。操作结果未知不借新权限复活，manual目标不会被run/host撤销。退出结果可能unknown，不能只看child退出码0。
- 父失联：child收到IPC disconnect立即close run，拒pending RPC；三秒自保上界避免close卡住，清自己的已标记私有HOME后退出。父消失时无法报告原grant/租约已释放；调用进程/测试原owner只在确认child已退出后清自己的快照/运行目录。不能让child删除外部window或其他快照。
- child卡住：父只停止自己PID/组，await真正退出后才释放lease。原client未确认的请求按原有限TTL/断链收敛，不猜cancel或撤人工。OS拒绝终止/清理等异常保unknown和未释放资源，禁止据此抢锁。

host.close不调用window.close/endControls/revoke，不改变外层共享组或其他页面。外层window/设备stop/STA/精确恢复仍须原owner分别执行；本child的done不是设备退出证据。

## 本轮验收与剩余现场输入

`node scripts/verify-native400-pet-hold-host.mjs --output .cache/tcp29/results.json`：16项，固定副本实际Node进程、原创HTTP、genuine父shared owner/原UDS、真实loopback TCP及保位端侧模型。14秒墙钟跨多租期/同token、长touch中更新latest11/EOF、独立模拟draw回执、自然到期与全资源退出。包含错pins/错实例/伪JSON、重复启动/单活loan、abort/半途启动、卡住child、真实父退出、丢真实ACK后unknown精确确认/人工目标保留。全部自有HOME/runtime，原fixture和回退素材不读设备。

实际启动闭环已完成。真机最少仍需：真实pet加载身份与自然迁移，fresh完整素材/用途/window决定，实际部署app与peer/link，现场SDK资源/栈和显示、设备stop/STA及精确只app恢复。终端预检已有历史回退输入的完整SHA但不等于新设备读回；PTC1缺cycle/mail遥测仍单列未覆盖。手动缓存与真实pet自动窗分列；strict24fps、媒体流/保存/V3/长测后置。本轮不改现有DSH/pet/bridge/profile、账号、素材/分区/cache，不安装插件/刷写或自动造任务。

回退await host.close/done核本进程资源，保留借用window/manual；原owner再关闭自己的window/audit/request/snapshot。省略新API即原TCP28/手动路径，无协议或存储迁移。
