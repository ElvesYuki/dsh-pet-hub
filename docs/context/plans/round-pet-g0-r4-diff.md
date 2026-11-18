# G0-R4 Diff（实现前）

- 新增内部默认OFF临时wire adapter及显式启停/handler，无服务CLI/插件入口或listener创建；整合现有session/guard、A2导入、R2门禁、队列及A8权威。
- R3合同修订2仅扩challenge/ready的显式离线full-review选择并补2正向量，旧合同归档；session新增按socket清挑战，不放宽旧hello。
- A3新增显式wire版本入口/事务准备，集中规范化schema2，保留admission/maintenance/touch/cancel信息；命中不伪造saved，取消栅栏不伪造设备phase，旧schema1入口不放宽。
- 新增原创临时TLS/PKI/素材fixture、30专项及监督CLI；验证握手关联/回执/持久后发布、错误与恢复、正常及SIGTERM清理。
- 保留既有A4/v5/旧hello/数据格式/期限，既有配置与设备不动；新GET分段/正式UI/ESP资源不并入本片。
- 更新当前摘要/协议交接与待办，归档R3中被替代的adapter未实现记录；共同签核/独立许可/G1/G2仍未关闭。详见[Spec](round-pet-g0-r4-spec.md)。


## 实施状态（2026-11-02）

本片已实现，见[报告](../../reports/2026-11-02-round-pet-g0-r4.md)：30专项、修订2字节80正/62反、check与含构建844全套通过，正常/SIGTERM自有临时环境清理。旧adapter缺口及R3原合同/向量已[归档](../history/round-pet-g0-r4-evolution.md)。无新GET/生产入口/设备装配；共同签核/真实素材批准/G1/G2继续未完成，Spec/Diff保留实现前边界及回退。
