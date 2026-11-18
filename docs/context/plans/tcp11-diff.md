# TCP-11 Diff（实施前）

- core/native400-bootstrap：抽取原纯header检查，带批准inspector仍先核原独立批准、返回原map结构；不改变格式/geometry/namespace/recipe或旧诊断行为。
- 新runtime/native400-lan-input-audit：显式只读metadata/历史cache，复用candidate/headers/identity/mapping与严格文件检查、流式SHA、失败/取消/实际退出；结果不具启动/批准能力。
- 新原创专项/独立验证CLI；真实历史源运行结果仅去敏证据，不带本地路径/凭据或原始运行响应。
- 更新R0契约交接/报告/当前摘要及归档；MIT登记，零新依赖。TCP owner/service/request及旧offline批准保持，不运行固件工具、不启动网络或真实设备通道。

实施状态：18专项/独立CLI、check及含build单套1586通过，另完成本仓库真实历史cache来源审计；无LAN/USB/STA/ESP或新用途批准。见[报告](../../reports/2026-11-05-tcp11.md)。
