# P1宿主 Diff（实现前）

- 候选独立host入口导出Schemastery Config，核心/普通单测仍无宿主依赖。
- 补齐候选精确peer依赖和client manifest；按实际宿主修正配置/模块/slots契约，不复制上游实现。
- 仅在/tmp创建独立DSH_HOME/profile/runtime，本仓库.cache保存脱敏证据。
- 如需修复真实宿主兼容问题，补回归测试；更新长期上下文和验证报告。
- 不安装到默认desktop、不改pet/bridge、不提交推送。
