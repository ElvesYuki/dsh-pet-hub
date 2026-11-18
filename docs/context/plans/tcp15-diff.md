# TCP-15 Diff（实施前）

- 新packages/runtime/native400-execution-snapshot.mjs：受限显式清单、私有副本、manifest摘要、完整复核及lease关闭；可选真实snapshot→TCP14 consumer装配，旧入口不变。
- 新tests/native400-execution-snapshot.test.mjs及原创fixture：真实副本加载、篡改/资源关闭负例；scripts/verify-native400-execution-snapshot.mjs复用隔离监督；verify-native400-hub-snapshot以固定code-only范围生成显式清单，封存当前hub后复核/删除，不import副本。
- 新API/报告/结构化证据，当前hub代码清单离线快照一次后清理；许可登记，更新当前摘要/G0并归档旧记录。明确declared inventory不等于完整动态/解释器运行闭包，实际设备窗口与完整Python依赖仍待。
- 零依赖，不改固件、现有配置/服务、TCP wire/owner/调度/TTL，默认不启用；不执行上游Python/USB/ESP、不开LAN生产listener，不提交推送。

实施状态：26项隔离专项、当前hub164文件清单快照/复核/清理、最终check及含build全量1682/1682和最终build通过。两次全量顺序运行，第二次覆盖装配层postflight失败的公共outcome修正；原TCP14/service及现有源文件未更改。仅declared inventory与原创Node加载对照，完整动态/Python/系统依赖和ESP仍待。[报告](../../reports/2026-11-05-tcp15.md)。
