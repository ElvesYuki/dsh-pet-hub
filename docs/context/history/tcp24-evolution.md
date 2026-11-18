# TCP24触摸对接演进

2026-11-06。TCP23 hold与真实来源边界继续有效；新增A/B决定与离线provider/最小快照草案，尚非正式网络能力。以下替代旧“尚无对端合同/管理端provider”的下一入口；真实端侧仲裁一直存在，不将观测缺口说成触摸优先缺失。

## README.md

2026-11-06 TCP23：显式opt-in hold-state已实现，默认event保持；HTTP不可重建采样收据、真实lane source_window_ms与页面权限/观察来源三期限分别验证，查询耗时扣除，低水位2秒才申请新5秒BASE。人工/陈旧/失联/过期/unknown/本地优先态门禁已宿主验证；真实触摸provider缺省unknown失败关闭。15秒真实只读观察30次均空闲、无迁移/失联；安装0.4.3选定摘要稳定，但运行加载版本仍未绑定。见[报告](../../reports/2026-11-06-tcp23.md)/[合同](../../protocol/native400-pet-hold.md)。真实DSH/空闲来源基线沿TCP22保持，不自动开ESP窗口。

## docs/context/index.md

2026-11-06 TCP23：显式opt-in hold-state已实现，默认event保持；HTTP不可重建采样收据、真实lane source_window_ms与页面权限/观察来源三期限分别验证，查询耗时扣除，低水位2秒才申请新5秒BASE。人工/陈旧/失联/过期/unknown/本地优先态门禁已宿主验证；真实触摸provider缺省unknown失败关闭。15秒真实只读观察30次均空闲、无迁移/失联；安装0.4.3选定摘要稳定，但运行加载版本仍未绑定。见[报告](../../reports/2026-11-06-tcp23.md)/[合同](../../protocol/native400-pet-hold.md)。真实DSH/空闲来源基线沿TCP22保持，不自动开ESP窗口。

## docs/context/current-system.md

2026-11-06 TCP23：显式opt-in hold-state已实现，默认event保持；HTTP不可重建采样收据、真实lane source_window_ms与页面权限/观察来源三期限分别验证，查询耗时扣除，低水位2秒才申请新5秒BASE。人工/陈旧/失联/过期/unknown/本地优先态门禁已宿主验证；真实触摸provider缺省unknown失败关闭。15秒真实只读观察30次均空闲、无迁移/失联；安装0.4.3选定摘要稳定，但运行加载版本仍未绑定。见[报告](../../reports/2026-11-06-tcp23.md)/[合同](../../protocol/native400-pet-hold.md)。真实DSH/空闲来源基线沿TCP22保持，不自动开ESP窗口。

## docs/context/current-todos.md

2026-11-06 TCP23：显式opt-in hold-state已实现，默认event保持；HTTP不可重建采样收据、真实lane source_window_ms与页面权限/观察来源三期限分别验证，查询耗时扣除，低水位2秒才申请新5秒BASE。人工/陈旧/失联/过期/unknown/本地优先态门禁已宿主验证；真实触摸provider缺省unknown失败关闭。15秒真实只读观察30次均空闲、无迁移/失联；安装0.4.3选定摘要稳定，但运行加载版本仍未绑定。见[报告](../../reports/2026-11-06-tcp23.md)/[合同](../../protocol/native400-pet-hold.md)。真实DSH/空闲来源基线沿TCP22保持，不自动开ESP窗口。

## docs/context/native400-baseline.md

2026-11-06 TCP23：显式opt-in hold-state已实现，默认event保持；HTTP不可重建采样收据、真实lane source_window_ms与页面权限/观察来源三期限分别验证，查询耗时扣除，低水位2秒才申请新5秒BASE。人工/陈旧/失联/过期/unknown/本地优先态门禁已宿主验证；真实触摸provider缺省unknown失败关闭。15秒真实只读观察30次均空闲、无迁移/失联；安装0.4.3选定摘要稳定，但运行加载版本仍未绑定。见[报告](../../reports/2026-11-06-tcp23.md)/[合同](../../protocol/native400-pet-hold.md)。真实DSH/空闲来源基线沿TCP22保持，不自动开ESP窗口。

## docs/context/plans/round-pet-g0-handoff.md

2026-11-06 TCP23：显式opt-in hold-state已实现，默认event保持；HTTP不可重建采样收据、真实lane source_window_ms与页面权限/观察来源三期限分别验证，查询耗时扣除，低水位2秒才申请新5秒BASE。人工/陈旧/失联/过期/unknown/本地优先态门禁已宿主验证；真实触摸provider缺省unknown失败关闭。15秒真实只读观察30次均空闲、无迁移/失联；安装0.4.3选定摘要稳定，但运行加载版本仍未绑定。见[报告](../../reports/2026-11-06-tcp23.md)/[合同](../../protocol/native400-pet-hold.md)。真实DSH/空闲来源基线沿TCP22保持，不自动开ESP窗口。

## docs/context/current-todos.md

下一入口：hold-state代码/宿主合同已完成，不再列提案待实施。先由运行方核定pet实际加载版本及可信本地priority来源（当前wire不能报告完整触摸周期，缺省unknown不能启用设备hold）；在自然真实任务期间使用有界只读工具补semantic/counter迁移/失联证据。此次15秒无迁移已正常停止，不重复空闲取样冒充通过。之后终端另开绑定来源/许可/新peer的有限窗验证自动保持/触摸/断链；不复用旧USB配置。Desktop scheme、资源长测、素材流/保存/V3继续后置。
