# TCP-09 Spec（2026-11-05，实施前）

已读规则、当前摘要、TCP08/07实际代码及终端station接口/status/todos。推进独立LAN窗口的专用单实例宿主，不重复UDP锁/owner/STA实现。R0真实来源/用途、USB/UI配置提供者仍缺，不自行批准或读取真实凭据。

新增独立lanReview opaque prepare（接TCP08 profile，不接受offline binding），无I/O/窗口acquire。profile安全descriptor以规范输入哈希绑定身份/决定/端点/windowMs；不含绝对单调deadline以便不同进程附着同一窗口意图。附着不重置赢家deadline；profile仅赢家acquire一次，两个目录的全局互斥仍不作保证。服务sourceKey含profile摘要与ack/tick策略，异配置拒绝附着。

沿startOrAttach UDS bind选主，显式directory/source disabled/device disabled，与其他review/import互斥。赢家构建一个LAN owner，但不自动TCP start或network up；只有返回的本地控制句柄可显式操作。IPC仅GET status，新core投影仅窗口scope/claimed/invalid/remaining、listener/资源是否退出、link及首帧历史。拒绝设备证明/verified/current_display升级；不返回地址/接口/身份摘要/批准正文/操作句柄。未接UI/CLI或任何网络写路由，旧offline路径保持。

close先fence本地句柄和TCP，再等待关闭成功及资源归零后才删除descriptor/释放UDS；失败保持UDS和503，不假装退出、不抢旧socket。支持可信调用方手动重试close（不是自动重试动作）；若底层close持续不确定仍持锁。附着者close无副作用，重开不能复活已acquire/revoked的同profile。过期窗口保持可只读状态，不由status或重新prepareHost续期。

测试：私有临时UDS+真实loopback，模式隔离/opaque/默认slot/sourceKey、单/跨进程赢家、不同配置、只读/隐私/坏snapshot、到期不续、附着者关闭、实际关闭归零、清理失败持UDS/操作fence/手动重试、原profile重开拒绝。仅原创合成决定/接口快照，不实际bind LAN、STA/ESP、真实素材或固件脚本。先专项，再单套npm check/test含build。

回退close成功等实际资源退出再删临时根；失败留给可信检查，不强制抢UDS。省略lanReview为旧行为，无配置/持久迁移。真实配置生产者、用途审阅和实际LAN/资源窗口仍待独立授权；不把此装配作为生产/设备准入。终端stop/cleanup_complete只读核对，host退出不替代设备退出。

实施状态：本片13专项/独立CLI、check及含build单套1550通过，只有loopback/UDS排练，无实际LAN/STA或真实批准。见[报告](../../reports/2026-11-05-tcp09.md)，旧入口见[归档](../history/tcp09-evolution.md)。
