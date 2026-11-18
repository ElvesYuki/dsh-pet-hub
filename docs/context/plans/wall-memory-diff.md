# 30分钟墙钟测量 Diff（实施前）

- runtime/role-runtime：资源白名单投影已有worker heap/ArrayBuffer样本，纯观测、无配置/调度改变。
- simulator/wall-memory及scripts/measure-wall-memory：独立临时service、原素材fixture、真实UDS负载、有限定时/指标/阈值/取消及退出清理。
- tests：趋势汇总、短时间真实IPC与清理验证；长测不放默认测试。
- docs：执行报告、当前系统/待办/索引就地更新，被替代片段归档history。

零依赖，默认disabled不启动测量；不改固件、pet、bridge、DSH配置或并行动画代码。

实施完成：测量脚本/指标白名单和3项测试已接入；32秒smoke及1800秒正式运行通过，正式后check/test全套241通过。运行结果、观测限制与退出证据见[报告](../../reports/2026-10-30-wall-memory.md)。
