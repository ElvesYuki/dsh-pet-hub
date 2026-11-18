# TCP-16 Diff（实施前）

- TCP15快照新增内部真实lease借用入口，复用原verify/fence/release，不改变旧consumer。
- 新runtime/native400-node-load-audit.mjs与builtin-only child bootstrap：默认关闭、固定Node/入口/清洁环境，逐实际解析source核SHA/receipt，TERM/KILL及退出屏障。
- 新原创专项与隔离验证CLI、当前hub实际import-only CLI；不调用startOrAttach或apps/service CLI，不运行上游Python/设备工具。Node24.14.1 release-candidate hook只用于离线诊断，不并入生产装配。
- 新API/报告/向量、许可登记，更新当前摘要与G0并归档旧记录。外部设备当前20f4恢复待重连，以新交接覆盖此前f553已恢复快照；不参与设备恢复。
- 零第三方依赖，无TCP协议/调度/授权/期限/生产配置变更，无提交推送。

实施状态：27专项/隔离CLI、当前hub166文件快照中新进程85业务模块/JSON及11业务builtins导入对照、check与含build全量1709通过；最终build及证据收尾见[报告](../../reports/2026-11-05-tcp16.md)。未启动服务/设备通道，完整动态/Python/系统依赖及正式launcher仍待。
