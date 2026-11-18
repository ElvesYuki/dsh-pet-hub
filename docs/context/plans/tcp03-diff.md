# TCP-03 Diff（实施前）

状态：已完成本片内部候选范围，见[报告](../../reports/2026-11-04-tcp03.md)；端侧共同定版/新增wire互操作/设备仍未做。原实施前边界如下。

新增core/native400-tcp-observation：显式OFF候选投影，固定scope/完整身份/完整性等级/状态及退出回执、期限/序列/历史。
新增ui/native400-tcp-observation共享只读renderer，用安全投影，不接设备写入口。
新增tests/verify CLI与协议字段交接/报告/闭合证据/上下文归档。
不改TCP-01七消息、TCP-02 owner、C++/端侧header、依赖/build候选默认入口/DSH/profile/固件或素材。内部字段候选不当成已冻结网络布局。
