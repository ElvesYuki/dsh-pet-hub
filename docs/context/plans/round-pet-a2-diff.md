# A2 Diff（实现前）

状态：按实现前范围完成离线适配，见[报告](../../reports/2026-10-30-round-pet-a2.md)和[活动API](../../protocol/round-pet-a2.md)。真实包批准/跨端/设备仍待验。

- 新core/round-pet-identity：受限JSON/canonical与包、批准、F/M/P/N/I映射；复用已有JSON/parser、A1固定媒体约束，不复制固件实现。
- 新runtime/round-pet-import：显式目录预审、受限provenance持久发布/读取与cachedOnly重开；调用既有createMaterialStore，无服务/IPC/插件入口。
- material-worker增加内部roundPet分支：生成旧schema index、复核元数据/来源、严格生产媒体及index SHA；保留旧导入分支与配额/CAS/退出行为。
- 新原创fixture、专项测试与隔离CLI；不导入真实大素材库、无新增依赖。
- 更新活动契约、报告、当前摘要/差异表/待办/索引及主题归档；G0数学向量保留，不升级为跨端互操作证据。

不改固件/pet/bridge/DSH或A1执行模型，不启用任何设备通道。发布次序、失败保留及回退以[Spec](round-pet-a2-spec.md)为准。
