# G0-R5 Diff（实现前）

- 提取A4现有读许可/预算/Range/逐块校验为共享lane及流写入函数，旧profile/路径/分页/授权/期限保持；R4复用，避免另一套认证/队列/存储。
- R4增加显式readBudget（缺省null、首窗口不发）、单次permit、完整metadata/Range GET及相对截止，响应关联授予permit的exchange；R3修订2JSON合同/80正62反字节不变。
- 增加读取任务AbortSignal；实际await/handler退出前保留read/HTTP槽及A2 pin，逐块新scope验证撤销/日期/元数据/控制/目标/截止，部分响应失败关闭、不自动重试。
- 复用A4 client request owner/Range与完整PET4检查建立原创临时TLS专项/监督入口；30项及check/test/正常取消清理，报告区分宿主与设备未验。
- 更新协议/交接/当前摘要/待办及来源许可，归档R4被替代GET缺口；默认OFF/生产/设备/外部配置均不变。[Spec](round-pet-g0-r5-spec.md)。


## 实施状态（2026-11-02）

本片已实现，见[报告](../../reports/2026-11-02-round-pet-g0-r5.md)：30专项、A4/R4独立78项及check/含构建全套877项通过，监督正常/SIGTERM清理通过；原合同/向量及session/A3/core-wire源码保持。被替代的无GET状态已[归档](../history/round-pet-g0-r5-evolution.md)。新wire的A1 actor全链、共同签核/真实素材批准/固件G1/G2/生产与设备仍未完成，保留本实现前边界与回退。
