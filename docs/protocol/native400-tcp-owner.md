# TCP-02 临时连接owner与调度

2026-11-04。[Spec](../context/plans/tcp02-spec.md)/[Diff](../context/plans/tcp02-diff.md)、[报告](../reports/2026-11-04-tcp02.md)。复用TCP-01七消息/codec/HubControl，草案未共同冻结；不新增STATE等消息，不修改固件。不启动生产服务、插件或连接ESP。

## 默认与接入方向

`createNative400TcpOwner({mapping,records,ackMs=2000,tickMs=25,clock?,timers?})`本身不做I/O。唯一启动方式是显式`start({enabled:true,host:'127.0.0.1',port:0})`，拒绝LAN/固定端口。供独立临时宿主验证，不是生产LAN入口。终端主动连接hub方向保持，owner不扫描/拨号ESP、不修改网络配置。

单活socket；第二连接立即拒绝，不允许未核新连接抢占。server maxConnections=2只容纳一个活连接和暂态拒绝连接，状态不累积session。接纳时创建独立model/parser/TX和新的session/controller随机ID；随机值只是路由信息，不是认证。mapping/恢复对象由可信调用端显式固定，配置在创建时快照。失败后新连接准入退避100/200/400/800/1600/2000ms封顶，周期tick不拨号；终端负责自己的重连。

## API、时间与队列

- `base(action,ttl=5000)`仅0/1/11，ttl1–60000；目标在提交时得到绝对截止。一个正在确认的命令＋一个最新目标；后续base覆盖未发送的latest，不覆盖在途记录。到发送前重新算剩余TTL，过期不发，ACK迟到不延长。
- `cancel()`清latest/desired，待当前记录与ACK边界后发CANCEL；不能撤设备本地触摸。已发目标到期触发CANCEL收敛；PING不续动作寿命。
- 周期timer驱动HELLO等待、ACK超时、动作期限与PING。会话10秒不变；PING沿TCP-01在ackMs余量内优先于未发BASE。取消优先，超预算直接断会话，不延长TTL。tickMs为唤醒周期，不是网络/磁盘最坏时延保证。
- `reapply()`仅在新会话OPEN完成且旧目标仍未到期时，由可信调用端明确调用，使用剩余寿命；不重新给予完整TTL。重连不会自动重放旧BASE，首次连接前明确提交的目标可在该首次会话下发。断线后提交的目标也需要明确reapply来绑定新会话。
- `pause()/resume()`：pause同步fence并关闭旧连接；resume仅允许新的入站连接，不恢复旧会话/BASE。真实系统休眠源未接入，只测显式入口。
- `snapshot()`仅安全状态、desired余量、当前model观察与断线历史摘要，未暴露listener地址、session/controller等路由ID。观测继续accepted、verified=null、last_frame0、current_display=unknown，断线当前观察清空，最后首帧仅historical。不由模型/网络成功生成设备播放证明。
- `resources()`报告自有socket/session/timer/listening/active计数；`address()`仅可信宿主取得临时测试地址，不写Git/配置。
- `close()`返回幂等Promise，返回前同步关闭准入/失效当前代并清timer，随后等待socket实际close/监听退出。bind未完成时也等待本次bind再清理，不留下迟到listener。坏时钟永久使本owner暂停，不能resume绕过，需可信新建。

## socket适配与回调

原`attachNative400Tcp(socket,model)`兼容；可选onProgress/onClose仅为可信owner回调，新增busy/done观察。write完成前拒绝插入另一记录；每条仍只有最多288B，socket.write回调代表本地发送完成，不是设备ACK或PRESENTED。背压/延迟回调不会推进远端受理状态。close先置closed并失效model，旧write/data/error/close回调不能唤醒新会话；done只在实际socket close时完成。

owner的每个回调先比较entry身份；旧连接结束不能清新连接。记录最后首帧观察于当前entry，底层关闭model清空状态后仍可保留为历史，不能恢复current。该候选未接DSH/IPC管理写路由，无页面自动启用开关。

## 验证边界与回退

18专项覆盖默认关闭/隔离参数、真实单字节HELLO与缓存BASE、并发拒绝、定时PING/动作取消、真实HELLO超时、ACK超时无重发、重连新session/不回放/剩余TTL、过期拒绝、latest/cancel、pause/resume、坏帧、实际close/bind竞争/迟到写、退避/坏时钟、历史首帧回收。受控clock/timer与真实loopback分别标明，peer仍原创模型，不是真实SHA/View显示或ESP。

回退close本owner，等待所有自有资源退出，不切换TLS、不改持久格式/配置。生产LAN listener、设备身份选择、STATE/完整性/EXIT/ERROR、端侧socket-owner/worker/View/资源短测与真实窗口仍待做。下一应共同确认这些契约并准备端侧联调，而非自动安装插件/接设备；TCP素材流、长测、保存掉电、400-L/V3后置。
