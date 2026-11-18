# TCP-06 Diff（实施前）

新增core/native400-tcp-network与专项/CLI；runtime TCP02 owner新增可选peerAddress和可信networkLink，TCP05转交。默认配置、七消息、mapping/reader/journal/权限/依赖/固件均不改。新增真实集成执行回退方案、报告/证据，替换当前摘要并归档旧入口。真实LAN、STA、设备/插件/服务及提交推送均不执行。

实施状态：本片12项专项通过，新增/关闭路径保持offline；换代使首个连接前排队目标也需显式reapply，原截止不延长。最终check/build/全套见[报告](../../reports/2026-11-05-tcp06.md)。
