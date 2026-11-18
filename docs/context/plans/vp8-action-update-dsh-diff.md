# VP8 动作 1 独立 DSH 验证 Diff

2026-11-16。初始范围为 Spec、Diff、临时 Web profile 的动态验证及脱敏证据。正常执行无需改生产代码。主线保持 `56644ffd`，已安装素材保留，实际设备只读查询。已确认的问题按最小边界修复并重新验证。完成后更新当前摘要，归档被真机或 DSH 验收替代的旧条件。

安装宿主实际为 `0.2.2-rc.3`，首次 schema 准入因两项精确 `rc.1` peer 拒绝。现有构建脚本增加显式 `--host-version 0.2.2-rc.3`，单独生成候选，匹配本机实测 WebServer 和 Connection。默认 rc.1 固定包与历史摘要保持。isolated profile 使用正常版本检查。
