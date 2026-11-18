# 400-08 Diff（实施前）

2026-11-03，配套[Spec](native400-08-spec.md)。

| 范围 | 新增/变更 | 保持 |
| --- | --- | --- |
| core | N_boot布局/独立批准/候选身份映射与严格只读header inspector | 复用原CRC/uint64/native400Metadata，无DSH/DOM/Node，不改旧identity/wire |
| runtime | 显式私有文件review、流式整cache/逐对象SHA、指纹/路径/取消/实际退出 | 无listener/IPC/服务装配/CAS写/固件执行，不读整片NVS |
| simulator/tests/CLI | 原创临时稀疏.fixture/完整PET4、正反例/隔离监督 | 无真实动画/设备/安装镜像/来源自批准 |
| 文档 | API/recipe/证据/许可、当前摘要/交接/归档 | 来源审阅与设备事实分开，旧尺寸备份及400-07有效证据保持 |

实施后回填实际文件、测试、未覆盖和回退；不把本片当G0签核或生产N已协商。

## 实施结果（2026-11-03）

新增5个源入口：pure native400-bootstrap inspector/批准、runtime bootstrap-review、simulator bootstrap-fixture、44专项与监督CLI；317条原源/fixture/脚本SHA全部保持，无apps/依赖/旧identity/actor/wire/400-07变更。只读布局参考与Apache-2.0许可证已登记，不复制/执行固件实现。未知mapping字段的稳定错误边界在新schema内修正，未扩通用validator。

44专项/监督CLI/check/含构建1194回归通过，[报告](../../reports/2026-11-03-native400-08.md)/[API与回退](../../protocol/native400-bootstrap-review.md)/[原创向量](../../protocol/vectors/native400-08-source-review-v1.json)交付。README/index/current-system/todos/native400基线/G0差异与交接/roadmap/decisions/第三方同步；旧待实现摘要[归档](../history/native400-08-evolution.md)。没有真实用途批准/缓存导入或设备事实，下一400-09保存/重开/只读投影先写Spec/Diff，所有真实资源/生产与固件边界保持。
