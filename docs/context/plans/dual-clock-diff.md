# 独立双时钟 Diff（实现前）

- core/registry：显式相对grant观察、host本地期限/观察顺序、相对elapsed估计、显式断线；原同钟接口兼容且会话模式不降级。
- simulator/dual-clock：独立时钟与已有FaultQueue装配，合成可信身份、快照消息和恢复入口；不进入候选包。
- tests/dual-clock、scripts/verify-dual-clock：确定性延迟/丢包/重排/断线与重启用例、汇总报告。
- docs：协议、报告、墙钟测量方案；直接更新当前系统/待办/索引，替代范围归档history。

无依赖、IPC、配置、固件、素材或并行动画变化；相对接口为离线core契约，不新增真实网络支持。

实施结果（2026-10-30）：新增13条确定性验收及复用测试的汇总CLI，207项全套与SIM30+4通过。发现并修复观察新grant后仍以旧lease命令revision比较的问题；相对started仅为估计。当前摘要/待办已就地替换，旧片段归档history/dual-clock-evolution；协议/报告保留未验范围与回退。墙钟方案仅文档，未执行。
