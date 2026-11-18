# 400-02 Diff（实现前）

2026-11-02，配套[Spec](native400-02-spec.md)。变更前源文件SHA保存在忽略的.cache/native400-02。

| 模块 | 计划变化 | 保持的边界 |
| --- | --- | --- |
| core/pet4 | 新增显式400 tile LZ4解码导出，复用已有严格实现 | decodeLz4旧7200上限、完整decoder与旧profile行为不变 |
| core/native400-window | schema3 review校验、真实ring/流式验证、两遍及渐进对照、首帧/时钟/失效/关闭 | 不改通用schema1/2、Native360、认证权威或持久化 |
| simulator/native400-window-fixture | 原创大于窗口的PET4与400-01来源/批准，注入SHA和虚拟时钟 | 不读真实素材/设备，不复制固件 |
| tests/native400-02、verify-native400-02 | 有界执行/像素/完整性/恢复负例与独立临时监督 | 不启动网络/生产listener，不安装插件 |
| Spec/API/report/context/history | 状态/预算/测试证据、替代待实现记录 | 不把宿主软件提交/预算当真机能力或共同合同 |

依赖400-01身份模块、CRC/LZ4和现有隔离verifier，零新依赖。仅调用显式入口产生效果，无新默认模式、配置项、磁盘格式、路由或协议字节迁移。实际偏差与验证结论实施后回填本文件。

## 实际落地（2026-11-02）

按表完成4个新增源/测试/CLI文件及pet4.mjs单个显式tile导出，其他288份原源文件SHA保持，0删除/新依赖。采用单Native400WindowModel，不将新review cap接通用parser/生产adapter。两种完整性路径均有真实ring/解码/SHA对照，默认全验＋逐帧收据重读；时钟额外明确迟到提交平移，防止尾帧零显示间隔。新增48专项（含非零XOR、118跨窗及digest到期），CLI48正常清理、check和含构建1018通过。

未新增Node-C++wire、Flash、OS事件或真实媒体/设备验证；第三RGB为预留池，不声称已接worker前瞻。逻辑数组账本及首帧/带宽/SHA收据成本见[API](../../protocol/native400-window.md)/[报告](../../reports/2026-11-02-native400-02.md)，未与固件预算混用。被替代待实现摘要已归档，下一400-03/04边界保持。
