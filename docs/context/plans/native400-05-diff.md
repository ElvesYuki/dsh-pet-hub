# 400-05 Diff（实现前）

2026-11-02，配套[Spec](native400-05-spec.md)。全原源及当前摘要已备份在忽略.cache/native400-05/before，前置SHA另存。

| 范围 | 实施 | 保持 |
| --- | --- | --- |
| core scheduling | 新有界latest/touch/deadline仲裁，可信queue discardLatest | 无DSH/DOM/Node，旧queue wire kind不扩 |
| 400 executor | opt-in local优先/deferred/恢复原deadline、loop/frame/失败入口 | 一个原window池，默认04路径/原wire不改义 |
| runtime 400 host/projection | opt-in touch周期/许可暂停/ready重置、合法自动renew和同命令重接纳 | 原guard/认证/TTL/read lane/CAS/A8原义、默认OFF、无生产入口 |
| simulator driver/lab/tests/CLI | 单实际IO owner/pump/local source、真实TLS回执与时钟负例 | 无真实源/设备/固件/运行配置，清理自有临时环境 |
| 文档 | API/证据/当前摘要/归档 | 不把宿主通过当设备/资源/许可准入 |

实际文件/偏差/测试与未覆盖项在实现后回填；需要改变revision1时先停止该分支并写独立合同，不静默改golden。

## 实施结果（2026-11-03）

已按Spec完成本片，见[35专项/1126回归报告](../../reports/2026-11-03-native400-05.md)/[API/退出与回退](../../protocol/native400-scheduling-review.md)。新增core/native400-scheduling.mjs、simulator/native400-scheduling-driver.mjs、tests/fixtures/native400-scheduling-lab.mjs、tests/native400-05.test.mjs与scripts/verify-native400-05.mjs；既有5处修改为native400-observations、round-pet-pull的discardLatest、runtime native400-wire-review、simulator native400-wire-executor及原review lab的可信选项。

未改400-02窗口/400-03表/profile/golden；revision1足以表达显式本地源/remote从0重读，未新增read-request或协议版本。关闭投影/周期verification floor的负例审查补充先写Spec再修复；另将在途借用控制交换纳入driver.close实际等待。check/完整构建测试/监督CLI通过，无依赖/apps/固件/设备/现有服务变化。README/当前摘要/待办/roadmap/共同G0/API及MIT边界已同步，被替代摘要[已归档](../history/native400-05-evolution.md)。正式调度能力协商、Flash/真实源/资源/时间/凭据/24fps仍未决；不启生产listener。
