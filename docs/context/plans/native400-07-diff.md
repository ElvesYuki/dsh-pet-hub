# 400-07 Diff（实施前）

2026-11-03，配套[Spec](native400-07-spec.md)。

| 范围 | 计划修改 | 保持 |
| --- | --- | --- |
| pure预算 | 固定声明成本/提前renew触发/首个完整播放保守估算 | core无Node/DSH/DOM，非物理实测 |
| 默认OFF临时host | scheduling提前触发/可信可选bounded-job准入 | 4510拒绝floor/原guard/单队列/TTL/400-04缺省不变 |
| 模拟driver/lab | GET-only边界、完整exchange/source/compute预算、受控双时钟/故障 | 单实际IO owner/旧actor/全验首帧/实际退出与历史画面 |
| 验证/文档 | 修改前后证据、专项/CLI/回归、API/当前摘要/归档 | 无固件/真实设备/媒体/生产入口/原固定字节/依赖变更 |

实施偏差与验收在完成后回填；如固定wire需改，另写合同，不原地扩revision1。

## 实施结果（2026-11-03）

按Spec完成：新增pure预算、24项专项/隔离监督CLI；修改临时host/driver、原创window fixture的显式dense模式、两处lab及400-05关闭终态期望。314条原源中308条保持SHA，6处修改/3新文件，原small/large fixture字节/metadata、400-02 actor与400-03固定合同/golden保持。无apps/依赖/认证减量/读lane/writer或生产入口变化。

冻结旧链已实际复现6001/499/999→4503失败，新链同输入提前renew/读成功；170段原创5564915B文件经A2/CAS/TLS/原actor在逐段999ms双时钟注入下先job到期，lease仍有效。严格计划入口在状态修改前拒超预算，fits仅必要条件；不是正式协商/物理上界。累计compute及恢复交换失败的审查补充已先写Spec再实现，关闭控制交换旧测试改为断言终止拒绝并保实际退出。

check/24专项/监督CLI与含构建1150项通过；[报告](../../reports/2026-11-03-native400-07.md)/[API](../../protocol/native400-cycle-budget.md)/[对照证据](../../protocol/vectors/native400-07-cycle-review-v1.json)已交，README/当前摘要/待办/基线/roadmap/交接/旧API同步，替代的条件算术[已归档](../history/native400-07-evolution.md)。外部固件仍400-06快照，下一400-08只读来源审阅；无设备或现有服务/配置变更。
