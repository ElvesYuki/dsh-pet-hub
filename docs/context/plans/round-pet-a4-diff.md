# A4 Diff（实现前）

状态：按实现前范围完成候选，见[48专项/563全套报告](../../reports/2026-10-30-round-pet-a4.md)和[活动API](../../protocol/round-pet-a4.md)。生产/实体准入未关闭。

- 新core拉取候选codec与有界调度状态：context/消息闭合校验、控制/receipt关联、单调序列/绝对deadline；不替代现有lease guard/Registry。
- 新runtime协调器/显式HTTP handler：复用scoped session/binding视图、A3 attestation投影、A2身份元数据、分页/一次性read permit/每4KiB授权。无默认listener/CLI/UI写入口。
- 新实际请求owner与Node HTTPS适配：单在途、总deadline/abort、等待真实req/socket退出、失败blocked，关闭清理。
- 新仅fixture的loopback mock device/临时PKI/原创媒体与专项、隔离CLI；不复制固件或素材，不修改正在运行的服务。
- 更新活动合同/报告/当前上下文/差异表/交接未决项与主题归档；A5及共同wire/设备准入继续待验。

完整边界与回退见[Spec](round-pet-a4-spec.md)。
