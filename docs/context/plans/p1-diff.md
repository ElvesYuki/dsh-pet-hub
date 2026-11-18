# P1 Diff（2026-10-29，实施前）

- 拆分source-pet纯schema/page与Node HTTP模块，新增来源装配器。
- runtime新增UDS服务/客户端、用户私有目录检查、Bearer+instance握手、配置CAS及CLI；保持无设备下发。
- ui新增共享React组件工厂；dsh-plugin增加host代理和client设置槽工厂。独立client构建不引入Node模块；增加bundle patch和仅dist候选manifest。
- 新增build脚本及P1行为测试，依赖仍为零，保持原Node/npm锁定。
- 新增具体隔离集成/回退文档和验证报告，更新README/长期上下文。
- 不覆盖已有P0修改、不改pet/桥接/固件、不安装启用插件、不提交推送。
