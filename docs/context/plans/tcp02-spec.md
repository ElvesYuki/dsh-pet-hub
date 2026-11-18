# TCP-02 Spec：默认关闭的连接owner与定时调度（2026-11-04，实施前）

状态：本片临时宿主范围已实现，见[报告](../../reports/2026-11-04-tcp02.md)。生产/ESP/共同扩展仍未验，原实施前边界如下。

复用TCP-01七消息、素材identity与HubControl，不分配STATE/VERIFIED/EXIT/ERROR新type；共同定版与真实端侧适配仍待外部任务。新切片只实施管理端宿主owner，默认不启动。终端主动连接hub方向保持，不反转为hub扫描/拨号ESP。

仅显式enabled与数值127.0.0.1/端口0可启动自有临时listener，无法配置LAN/生产端口；不装生产service/插件或改profile。单活连接，第二连接拒绝，不允许未核新连接抢占活会话；每次接纳生成新session/controller随机路由ID（非认证），新model/parser/TX。连接失败进入有界退避准入，终端负责重连；旧socket/error/定时回调先核owner代数，不碰新会话。close幂等，先同步fence再等socket/监听实际关闭，回收timer。

owner驱动周期tick、HELLO/ACK截止和PING，单record写/回调/背压期间不插包；一个在途请求+一个latest目标。动作寿命从用户提交时算绝对截止，拥塞/断线/重连不重新给完整TTL；过期目标不发。已接受目标到期需CANCEL收敛（CANCEL不能撤本地touch）。重连不自动重放旧BASE；明确reapply才重新关联仍有效目标，TTL仅剩余值。pause/system-suspend入口同步断会话，resume只允许新连接，无自动续命/回放；本片不接真实系统休眠源。

观察仍accepted/verified(null)/last_frame0/current_display unknown；连接断开/关闭清当前观察，历史仅安全摘要。缺STATE不展示持续playing。设备身份mapping/恢复清单显式固定，不推断设备库存。未实现生产重连、实际OS/ESP/View/SHA；loopback对端是原创模型。

验证：虚拟时钟/受控timer/短写回调与迟到回调、HELLO挂起、ACK挂起、PING续会话不续动作、拥塞latest/取消与TTL、并发连接拒绝、断线新session且无自动BASE、明确剩余寿命reapply、pause/resume/close与socket实际退出、坏帧/方向拒绝、真实动态loopback端点；原TCP-01/Node+C++向量回归保持。修改后check/test含build，外部代码不写不运行。

回退：close自有owner→立即fence→等自有socket/server退出→保留日志摘要/既有review成果；无配置/素材/存储格式迁移，不自动启用旧TLS。完整共同合同与ESP资源短测后才准备真实窗口；素材流/保存/V3后置。
