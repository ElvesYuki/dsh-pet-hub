# 400-09 Diff（先行范围，实施后核定）

- core/native400-bootstrap：增加严格历史map验证入口，共享既有批准上下文；inspect/recipe原字节不变。
- runtime/native400-review-journal：独立有界历史记录、CAS/原子持久化和未知提交冻结；不扩展绑定/素材存储schema。
- runtime/native400-review-manager：显式offline owner、实际reader装配、历史/本次复验和取消/关闭生命周期。
- core/native400-source-review-view、ui/native400-source-review及ui/index可选只读slot：白名单输出，无默认IPC或设备控制。
- scripts/build固定纯模块白名单加入新投影/renderer，候选不安装/启用。
- tests/native400-09、verify-native400-09：原创临时数据的正常/负例/故障对照；不读取真实cache或执行固件脚本。
- protocol/report/context/history：同步API、证据、限制与下一入口，归档被替代摘要。

不改400-03 wire/golden、400-02执行模型、400-07调度、认证、固件、pet/bridge/DSH、依赖版本及服务配置。具体验收与回退见同名Spec。

2026-11-03完成：3条既有源修改、6新增源/测试/CLI；319条既有源SHA保持。43专项/独立CLI/check/含构建1237通过，见[报告](../../reports/2026-11-03-native400-09.md)。未扩大服务/设备装配范围。

收尾评审补充：锁释放错误也归入rename后未知提交，仍尝试清理自有fd/临时文件/锁；新增第43项对照并重跑必要检查。
