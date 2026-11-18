# A6模型执行对照演进

2026-10-30。A6用A1 actor驱动离线peer，替代“A5仅声明式mock、A1尚未接模拟执行”的当前结论；真实Flash/面板、联合G0、真实包与G1/G2门槛保持。[报告](../../reports/2026-10-30-round-pet-a6.md)、[API](../../protocol/round-pet-a6.md)。以下原摘要保留当时语境，相对链接沿用原文件位置。

## 原当前摘要

```text
2026-10-30 A5默认关闭装配候选：check（仅.mjs语法）和test（含候选构建）全套604项通过，新增41项；独立CLI41项及SIGTERM均清自有临时环境。仅显式内部roundPetAssembly/offline-review由UDS赢家组合A2严格导入/CAS、A3四流投影与A4主动pull；异步validating后仍disabled，不创建TCP listener。GET status/插件白名单/共享UI只读显示装配状态，deviceTransport=false。[报告](../reports/2026-10-30-round-pet-a5.md)、[API](../protocol/round-pet-a5.md)、[替代记录](history/round-pet-a5-evolution.md)。

worker同一全验fd的私有指纹支持≤4KiB磁盘reader，无全库字节或fd缓存；修改/替换/坏路径失败关闭，重启完整复验才恢复。A2 pin直到实际HTTP退出、managed/power及reader关闭后释放。新hello先查询完整库存；unknown不发base/save，EMPTY仅0、IDLE_READY仅0/4。保存需verified/playing和当前库存/lease，满缓存显式非保护victim，旧F仍计占位；派发再次检查。保存unknown需重新查询，不盲重试。

disable/休眠/源失效先fence，resume仍OFF；显式重新enable、新TLS/hello/acquire/库存，不重放旧manual/save。仅A2来源/CAS持久，未新增生产选择/意图配置。临时真实TLS/原创241帧46描述已串联至宿主代理和候选VM；PC/HTTP/下载不生成首帧或saved事实。A1资源actor仍未接设备执行，mock回执不是Flash/面板证据。

联合C01–C12、真实包P/源SHA/许可、Node/C++共同wire仍未关闭。ESP TLS峰值/可信时间/凭据与G1/G2维护/有界退出未验；本机样本和1000/500/100/10预算不作为物理上界。线上read permit仅相对remaining_ms，双端本地截止；实物漂移与最坏延迟仍NO_GO。自动重试=0，无自动重连、生产listener或CLI/插件启用入口。

```

## 原下一入口

```text
2. **可先离线的执行参考对照**：先补Spec/Diff，用A1资源actor驱动mock设备的库存/验证/首帧/保存/淘汰，与A5默认OFF owner全链路对照，补故障恢复向量；本轮mock仍显式声明设备事实，未覆盖真实执行。Node/C++共享字节golden由双方分别实现；不以Node peer替代ESP或擅自启用listener。
```

A5的604项/41专项为当时证据，A6新增30项后当前634项。A5旧mock仍在其专项中保留，A6正向事实改由A1步骤生成；不把历史报告改写为物理持久化或生产装配完成。
