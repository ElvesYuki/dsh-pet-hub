# PET4内存与核心回执回收 Diff（实现前）

| 层 | 计划改动 |
| --- | --- |
| core/pet4 | 复用tile scratch、调用方decodeInto，原decode独立输出不变 |
| runtime/material-import、material-worker | 单次文件分配，完整CRC校验与诊断hash分离，build不保留player |
| core/device | 有界命令回执、单当前grant回执、受保护session淘汰及计数 |
| core/scheduler | 有界意图回执、sequenced触摸高水位/冷却去重及legacy限制 |
| simulator/index | 有界虚拟时钟/故障历史及计数 |
| tests、scripts | 回执窗口安全/多日虚拟耐久、分配行为、前后资源探针和真实库回归 |
| docs | 语义变化、测量证据、未覆盖项与长期上下文 |

无新依赖、无私有状态迁移、无固件/pet/桥接/DSH配置写入；所有缓存优化保持文件SHA/每帧CRC校验，不能把引用回收当作设备持久协议已上线。

实施后：上述路径均完成，新增tests/resource-replay.test.mjs（12项）、simulator/replay-endurance.mjs、scripts/stress-core-replay.mjs；原资源脚本补充worker ArrayBuffer/收尾RSS/耗时采样，audit-pet4使用player=false避免闭包持有。149测试与SIM30/34、同参数50次换包/500帧、三天虚拟核心及真实360双路径验证通过。量化结果、兼容限制与下一入口见[报告](../../reports/2026-10-29-resource-replay.md)。
