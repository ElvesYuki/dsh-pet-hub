# P1隔离DSH宿主验证 Spec（2026-10-29，实现/启动前）

授权范围：用户明确要求仅在独立测试profile中验证加载、重载、卸载。不得改现有pet/bridge/desktop。

## 执行方案

- 固定使用当前安装DSH Desktop 0.2.1-rc.3携带的CLI和运行时。已用单独/tmp/pethub-cli-audit进行离线help/dump核对，没有启动宿主。
- 新测试home为/tmp/pethub-isolated（若已存在即停止，避免覆盖）；profile名pet-hub-test。通过DSH_HOME环境参数隔离，禁止改HOME/CODEX_HOME。
- 独立hub runtime为/tmp/pethub-isolated/hub，source=disabled。DSH监听127.0.0.1、port=0、no-open；不挂pet、不读凭证、不发模型任务、不接设备。禁用测试profile遥测条目。
- 候选dist通过测试profile内node_modules的本地链接加载，不运行包管理器安装或上游脚本。profile bundles和patch仅在新home写入；host Config导出由实际Schemastery构建，runtimeDirectory指向本次hub目录。
- 核对React种子模块与slots客户端服务，加载settings.section；用浏览器实际打开测试UI检查来源disabled及空设备态。
- 仅修改测试profile patch实现停用/启用（重载），检查host路由404/恢复、客户端设置区移除/恢复与共享hub存活。卸载只从测试profile移除候选链接/条目，并重启测试宿主确认不再加载。
- 启动前后比对原desktop profile配置/package/锁文件摘要。原pet/bridge只通过“不触及其路径/进程/接口”保证隔离，不读取秘密。

## 回退

记录本次进程PID，仅向它们发送SIGTERM；不按名称/端口杀进程。正常退出hub清socket；本次测试home保留忽略的本地证据，后续可人工移除。若失败先停止测试DSH与hub，绝不修复/覆盖原desktop配置。不得对已有~/.dsh或固件目录执行安装/patch/删除。

验收：Config真实投影与运行时生效；client工厂、React和slots真实加载；加载/重载/卸载证据；失败与限制明确记录。Web profile验证不扩展为Electron desktop/BLE通过。
