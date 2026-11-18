# TCP28：有限运行器装配演进

2026-11-06。替代TCP27“45秒监管和来源桥接片段尚未装配”的局部状态；真实固定副本宿主启动/身份、现场准入和设备事实仍待。运行器只借用client，绝不把其close等同外层窗口/设备退出。

## README.md

2026-11-06 TCP27：有限hold窗口方案和非准入准备CLI已完成；复用私有execution snapshot/Node load audit，只import候选bridge而不启动，前后核TCP26源码/候选pins，prepared与device_admission严格分开。7专项／全量1916通过，check及两候选构建通过；实际候选副本import 6模块且资源归零；packages/apps及保位wire/owner保持，未接ESP/真实pet/改现有服务。双方静态指纹已核，真实pet加载身份/自然迁移、fresh用途与窗口、实际app/peer、动态资源/实屏及退出恢复仍待现场证据；计划不能充当准入。见[方案](../../context/plans/tcp27-window-runbook.md)/[报告](../../reports/2026-11-06-tcp27.md)。

## docs/context/index.md

2026-11-06 TCP27：有限hold窗口方案和非准入准备CLI已完成；复用私有execution snapshot/Node load audit，只import候选bridge而不启动，前后核TCP26源码/候选pins，prepared与device_admission严格分开。7专项／全量1916通过，check及两候选构建通过；实际候选副本import 6模块且资源归零；packages/apps及保位wire/owner保持，未接ESP/真实pet/改现有服务。双方静态指纹已核，真实pet加载身份/自然迁移、fresh用途与窗口、实际app/peer、动态资源/实屏及退出恢复仍待现场证据；计划不能充当准入。见[方案](../plans/tcp27-window-runbook.md)/[报告](../../reports/2026-11-06-tcp27.md)。

## docs/context/current-system.md

2026-11-06 TCP27：有限hold窗口方案和非准入准备CLI已完成；复用私有execution snapshot/Node load audit，只import候选bridge而不启动，前后核TCP26源码/候选pins，prepared与device_admission严格分开。7专项／全量1916通过，check及两候选构建通过；实际候选副本import 6模块且资源归零；packages/apps及保位wire/owner保持，未接ESP/真实pet/改现有服务。双方静态指纹已核，真实pet加载身份/自然迁移、fresh用途与窗口、实际app/peer、动态资源/实屏及退出恢复仍待现场证据；计划不能充当准入。见[方案](../plans/tcp27-window-runbook.md)/[报告](../../reports/2026-11-06-tcp27.md)。

## docs/context/current-todos.md

2026-11-06 TCP27：有限hold窗口方案和非准入准备CLI已完成；复用私有execution snapshot/Node load audit，只import候选bridge而不启动，前后核TCP26源码/候选pins，prepared与device_admission严格分开。7专项／全量1916通过，check及两候选构建通过；实际候选副本import 6模块且资源归零；packages/apps及保位wire/owner保持，未接ESP/真实pet/改现有服务。双方静态指纹已核，真实pet加载身份/自然迁移、fresh用途与窗口、实际app/peer、动态资源/实屏及退出恢复仍待现场证据；计划不能充当准入。见[方案](../plans/tcp27-window-runbook.md)/[报告](../../reports/2026-11-06-tcp27.md)。

## 旧下一入口

下一入口：TCP27[有限窗口执行/回退方案](../plans/tcp27-window-runbook.md)和只import候选的准备工具已完成；先补真实pet加载身份/自然迁移、fresh素材用途/window批准及实际固定副本启动shim。工具固定device_admission=false，不能替代授权或直接开设备通道。可由终端独立安排新保位候选的手动缓存控制小窗；真实来源自动hold须满足来源身份等条件后再安排，每片段≤45秒且保原三期限，不自动重试或延窗。真机实屏连续性/动态资源/设备stop及精确恢复仍待。保留TCP26/22证据，禁止重复空闲采样/造任务；Desktop scheme、长期会话/长测、媒体流/保存/V3后置。

## docs/context/native400-baseline.md

2026-11-06 TCP27：有限hold窗口方案和非准入准备CLI已完成；复用私有execution snapshot/Node load audit，只import候选bridge而不启动，前后核TCP26源码/候选pins，prepared与device_admission严格分开。7专项／全量1916通过，check及两候选构建通过；实际候选副本import 6模块且资源归零；packages/apps及保位wire/owner保持，未接ESP/真实pet/改现有服务。双方静态指纹已核，真实pet加载身份/自然迁移、fresh用途与窗口、实际app/peer、动态资源/实屏及退出恢复仍待现场证据；计划不能充当准入。见[方案](../plans/tcp27-window-runbook.md)/[报告](../../reports/2026-11-06-tcp27.md)。

## docs/context/plans/round-pet-g0-handoff.md

2026-11-06 TCP27：有限hold窗口方案和非准入准备CLI已完成；复用私有execution snapshot/Node load audit，只import候选bridge而不启动，前后核TCP26源码/候选pins，prepared与device_admission严格分开。7专项／全量1916通过，check及两候选构建通过；实际候选副本import 6模块且资源归零；packages/apps及保位wire/owner保持，未接ESP/真实pet/改现有服务。双方静态指纹已核，真实pet加载身份/自然迁移、fresh用途与窗口、实际app/peer、动态资源/实屏及退出恢复仍待现场证据；计划不能充当准入。见[方案](../plans/tcp27-window-runbook.md)/[报告](../../reports/2026-11-06-tcp27.md)。

## 被替代的装配说明

真实来源在上述链和实际新HELLO/OPEN通过后，才由可信本地owner创建`createNative400PetHoldSource`和`createNative400PetBridge({mode:'hold-state',arbitration:'endpoint-arbitrated',...})`；不传priority，不使用固定clear。页面仍走原Connection/可信resolver，不能从页面请求启动窗口或授控制权限。本轮仅准备该顺序，未新增可运行生产launcher；实际启动shim/监听端点/固定副本运行仍须具体窗口交接，不把本工具当启动器。
