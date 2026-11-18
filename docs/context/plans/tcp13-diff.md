# TCP-13 Diff（实施前）

- 新runtime/native400-private-config-session：私有单消费文件/lock所有权、敏感buffer回收、run/close/unknown/取消/期限/guard及失败保锁/显式cleanup；无进程启动/串口依赖。
- runtime/native400-tcp-lan-host新增可信内部一次交接guard（原端点/epoch/窗口）；runtime/native400-reviewed-lan-request新增WeakMap内部取config+guard，原public与旧低层API保持。
- 新高层reviewed config session接上述opaque交接；测试低层正向仅原创fake消费，高层真实audit/UDS仅拒绝，不执行LAN/USB成功路径。
- 新专项/隔离CLI、API/报告/证据、当前上下文与归档、MIT登记；零新依赖，不改wire/service/owner/固件/已有配置或素材，不提交推送。

实施状态：24专项/隔离CLI、check及含build单套1628通过；仅原创临时文件/fake consumer和高层未启动UDS拒绝，无LAN/USB/STA/ESP。真实adapter/service统一退出仍待。见[报告](../../reports/2026-11-05-tcp13.md)。
