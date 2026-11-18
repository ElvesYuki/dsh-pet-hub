# 400-10 Diff（先行范围，实施后核定）

- runtime/native400-source-review-host：准备不可序列化选项、批准快照/身份描述及赢家专属owner工厂，复用400-09，不自读源。
- runtime/service：显式互斥选项/sourceKey/仅赢家创建/status白名单/只读路由门禁/退出等实际I/O；默认模式行为保持。
- apps/dsh-plugin/index：原status代理加入sourceReview白名单；无新写路由、config或自动启动。
- ui/index：已存在来源审阅slot的页面阶段标题对齐400候选，不改交互/数据契约。
- tests/native400-10、fixtures子进程及verify CLI：临时私有UDS/动态loopback代理/原创fixture、选主/重开/退出与构建UI对照。
- protocol/report/context/history：API、边界、证据、回退与下一入口；归档400-10旧待实现记录。

不改依赖/锁文件、400-03合同/golden、400-02执行池、400-07调度、400-08reader、400-09持久化/manager、旧尺寸、固件、pet/bridge/DSH或现有配置服务。不运行固件脚本，不导入真实媒体。

2026-11-03核定：3条既有源变更、325条原源SHA保持、4新增文件；36专项/独立CLI/check/含构建1273全套通过，见[报告](../../reports/2026-11-03-native400-10.md)。收尾保证仅新模式的owner在close返回前同步失效，原模式清理顺序保持；测试长临时目录负例缩短别名，不放宽既有100B UDS路径门禁。
