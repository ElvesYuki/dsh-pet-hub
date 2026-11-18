# TCP-01 Diff（实施前）

状态：本轮宿主实现范围已完成；最终证据见[报告](../../reports/2026-11-04-tcp01.md)。原实施前边界如下，共同冻结/ESP仍待验。

新增 core/native400-tcp codec/parser/TX、hub会话适配；simulator TCP端侧actor复用业务Schedule；runtime显式loopback承载；native独立C++对拍、终端合成向量（登记来源）、Node测试。只替换新候选的设备传输边界，不接旧生产service/listener/UI写路由，不删除旧review或页面权限。
更新TCP差异/待确认协议、报告、长期摘要/优先级并归档旧6882/TLS默认/broker前置记录。终端仓库不写、不运行脚本；无依赖变化。
