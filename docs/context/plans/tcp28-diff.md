# TCP28 Diff（先写后实施，已完成）

- 新runtime/native400-pet-hold-run.mjs：借用已授权client，复用source/原A bridge，单次start/有限deadline/串行poll/unknown显式确认/自身清理，不关闭共享窗口或授新权限。
- 新专项fixture与离线/loopback/短墙钟计时验证，原core/owner/wire/source/bridge/channel不改。
- 新API/报告/结果、更新runbook和当前摘要，归档监管尚未装配的旧记录；真实固定副本启动/运行身份仍待，不把新helper当生产准入。

完成证据：[TCP28报告](../../reports/2026-11-06-tcp28.md)，24专项/1940全量、check及两候选构建通过；候选import 7模块与自身清理通过。未启动真实宿主或设备窗口。
