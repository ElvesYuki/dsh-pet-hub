# TCP26 Diff（先写后实施，已完成）

- core/native400-tcp-control：只更新TcpDeviceModel的续租/最新请求/源周期/绘制时间，保持TcpHubControl类体；host导入闭包SHA重锁。
- 新增纯core播放oracle：模拟Bridge source/cycle/mail、prepare/decoded、每cycle draw消费、真实回调时序和EOF；无I/O、无DSH依赖。
- 更新持续端侧fixture、END16由重播反例改保位正例，补联合24步及新负例；保留TCP25三期限/恢复/event/B。
- 新增宿主监督/结果与上游数据许可登记，更新当前摘要/G0/待办并归档被替代代码阻塞；不运行固件脚本、不改其仓库或现有服务。

完成证据：[TCP26报告](../../reports/2026-11-06-tcp26.md)，44专项/1909全量、check及两候选构建通过；实际ESP/媒体/显示和真实pet身份/迁移仍待。
