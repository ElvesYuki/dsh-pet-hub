# 400-08 只读N_boot来源映射待实现记录的替代

2026-11-03。400-07后的“下一400-08”及未实现PC来源映射由[400-08报告](../../reports/2026-11-03-native400-08.md)/[API](../../protocol/native400-bootstrap-review.md)替代。范围仅独立批准/PC文件/严格header/流式SHA与无副作用审阅；原400-07、400-06外部设备快照及全部未决合同/资源限制继续有效。下文是实施前原文，链接按归档位置重定位。


## 原docs/context/index.md

管理端最新（2026-11-03）：[400-07 Spec](../plans/native400-07-spec.md)/[Diff](../plans/native400-07-diff.md)、[完整周期/计划准入API](../../protocol/native400-cycle-budget.md)、[24专项与1150回归报告](../../reports/2026-11-03-native400-07.md)/[去敏对照](../../protocol/vectors/native400-07-cycle-review-v1.json)、[旧记录归档](native400-07-evolution.md)。原6001/499/999本地读漏窗已在冻结旧链真实复现；新6720提前续租、GET-only/完整exchange与源owner/累计compute检查和显式计划必要条件已验。170段原创媒体在lease有效时先触及原120秒失败。24专项/监督CLI/check/含构建1150通过，旧400-02/03固定字节与原fixture保持；默认OFF/无生产入口/无设备操作。下一400-08 N_boot只读来源审阅；外部6882/新预取仍是400-06快照，正式G0/策略/用途/TLS/时间凭据/Flash写/G1-G2/24fps未关闭。


## 原docs/context/current-system.md

2026-11-03 [400-07完整周期预算](../../reports/2026-11-03-native400-07.md)已完成离线实现：冻结旧链实际复现R6001/499ms间隔/999ms本地读后R4503失败关闭；新调度6720ms提前续租、原4510ms拒绝floor/15000租约/120秒作业不变。控制exchange/flush整体500ms、GET-only/local源1000ms共用一个实际owner，读前后交换并核代数，同pump受控compute累计100ms，超限不发布新actual；内容失败后的恢复交换也须失败关闭。显式requireBudget在改目标/queue/revision前拒绝不能装入声明计划的动作；fits只为必要条件，不是物理wall保证。170段原创5564915B媒体在合法renew/单socket下未完成全验即触原job截止，actual保持null。[API/退出](../../protocol/native400-cycle-budget.md)、[对照证据](../../protocol/vectors/native400-07-cycle-review-v1.json)、[被替代记录](native400-07-evolution.md)。24专项/独立监督CLI正常清理、check（仅语法）与含构建1150/1150通过；314条原源中308保持、6处候选/fixture/测试改动及3新增文件，无apps/依赖/固件/现有服务变化，400-02/03/旧fixture默认字节保持。


## 原docs/context/current-todos.md

1. **400-08 N_boot只读来源映射/审阅**：下一先Spec/Diff；用原创V2元数据/稀疏fixture核N_boot=a34d0c7b…、双根/几何/slot/gen/F与400-01 P/M/N_offline、独立用途批准的对应/误换拒绝。PC审阅不造设备库存/actual/saved，不读带NVS的整片备份，不运行固件导入器或生成写入镜像。
