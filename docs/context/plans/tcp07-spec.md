# TCP-07 Spec（2026-11-05，实施前）

已读规则/当前摘要、TCP05/06、实际service选主/cleanup与终端STA最新status/todos及合同。终端Relay/owner已完成，无真实watch/arm/STA初始化；不重复固件或升级offline用途。

本片推进R1的共享宿主所有权：可信代码显式prepare TCP宿主候选，仍offline-loopback。复用startOrAttach的UDS bind选主，只有赢家创建TCP05 fresh-file任务（附着者不读源、不创建TCP），任务默认只审阅不监听TCP。可信返回句柄才能显式start/networkLink/base；IPC仅白名单GET status，写/config/page全部拒绝，不提供页面/CLI/LAN入口。directory必须显式私有临时目录，source/device均disabled，其他review/material模式互斥。

prepare无I/O，opaque绑定option不能从JSON恢复；sourceKey纳入绑定输入摘要、源路径摘要、单peer及ack/tick/timeout策略，防另一app附着不同配置。地址/路径/批准正文不进status。独立纯core投影重建允许字段，显示源审阅阶段、listener/session/link、首帧历史是否报告，current_display unknown、verified null、device_evidence false。不将任意内部snapshot直接转发，不扩DSH代理/权限。

赢家任务在UDS成功后创建；IPC可在异步源审阅中只读。坏源失败状态不自动重试/开TCP。服务close先同步fence并等TCP任务实际reader/socket/timer退出，再释放UDS；附着者close不能关闭赢家。启动半完成、失败回收和配置不匹配沿原服务，不抢陈旧socket。保留用户修改，无提交推送。

测试：选主赢家/同配置附着、不同源/peer/mapping拒绝、默认slot缺省、模式互斥、只读与隐私/坏snapshot、实际新鲜源任务、显式loopback和peer/link、附着者退出/服务关闭等实际reader退出及重启不恢复旧目标。原创临时cache/UDS/TCP，无真实素材/设备/固件脚本或生产服务。先专项，再单套npm check/test含build（不重叠全量）。回退close赢家等待实际资源后销毁临时目录，省略tcpReview默认行为不变，无持久配置迁移。

真实LAN profile独立设计：未来新用途决定/真实来源/接口peer/单实例owner/STA调用者及动态资源通过后才启专用监听；本片不放宽127/port0限制，不把TCP05批准升级成设备配置。终端unwatch异步，不当fd关闭屏障。下一R0真实用途/身份与受控LAN激活另行门禁，丰富STATE/媒体流/保存/V3后置。

实施状态：本片13专项/独立CLI、check及含build单套1524通过。两进程选主/关闭已验；仅共享宿主子范围，LAN及真实批准仍未实现。见[报告](../../reports/2026-11-05-tcp07.md)，旧入口见[归档](../history/tcp07-evolution.md)。
