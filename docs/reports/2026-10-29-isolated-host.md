# 隔离DSH宿主验证（2026-10-29）

## 授权、方案和隔离范围

用户明确授权仅在独立测试profile验证加载/重载/卸载。本轮先核对CLI/help及安装产物，写[Spec](../context/plans/p1-host-spec.md)/[Diff](../context/plans/p1-host-diff.md)，在启动前明确执行与回退，再启动测试宿主。

- 使用已安装DSH Desktop 0.2.1-rc.3携带的CLI；测试的是它的Web profile运行路径，不是现有Electron窗口。
- 离线help/dump用独立audit home；真实启动用全新临时DSH_HOME及pet-hub-test profile。没有改变HOME/CODEX_HOME；未使用默认desktop/web profile。
- 测试profile从官方web模板创建，只挂hub候选；候选通过本地node_modules链接加入，无npm/pnpm安装、无pet和上游素材复制。
- 独立hub为disabled来源。DSH绑定数值loopback及动态端口，no-open。测试profile禁用otel、session-telemetry-otel、desktop-product-telemetry、product-analytics；未登录、未输入凭证、未发送任务或调用模型、未连接实体设备。
- 原desktop profile顶层5个文件在前后进行SHA-256比对，全部相同。未修改pet源码、配置或bridge/固件目录，未调用其控制接口。没有按名称或端口杀进程。

## 真实契约与候选修正

| 契约 | 安装产物/实测依据 | 候选变更 |
| --- | --- | --- |
| 原生Config | 本机schemastery 3.18.5；app-boot识别Symbol.for('schemastery')；官方插件使用默认导入z及z.object | 单独host.mjs导出Config，字段runtimeDirectory有默认值及说明；core/index普通单测无宿主依赖 |
| 配置传递 | 测试profile patch提供runtimeDirectory；status通过IPC返回服务已连接 | 原生schema投影含hub字段，实际apply接收正确路径；不是只在模拟ctx测试 |
| React | 宿主客户端模块系统提供React种子；renderer构建产物含react@18.3.1路径；实际组件hooks正常渲染 | client.external=['react']；React从factory require获取，不打包第二份React |
| slots | 真实客户端inject:['slots']等待服务；settings.section为实际设置区 | 独立id dsh-pet-hub-settings，热卸载/重挂载移除/恢复 |
| 客户端加载 | ModuleLoader.load({id,factory})，宿主扫描exports ./client和dsh.client | dist/client.js无顶层ESM；manifest external与包导出补齐 |
| 宿主路由 | webServer.register的prefix handler收到完整请求URL，disposer注销路由 | 原有路径判断实测通过，无需改成去前缀相对路径 |

候选package.template.json集中保存main/exports/files及精确peer：schemastery 3.18.5、cordis 4.0.5、host-webserver 0.2.1-rc.3、React 18.3.1。没有在根项目安装这些依赖；实际宿主通过安装范围解析提供它们。manifest保持private，未声称所有DSH版本或平台compatible。

主要参考仍是dsh-pet公开HTTP/Cordis契约和host/client结构，固定上游参考8963384e33400d0c83965bd82f98bd8f81d22863；没有升级本机pet。client manifest的module external与运行时Cordis inject是不同概念，不能把React或slots都填成同一种依赖。

## 加载、热重载和卸载结果

| 操作 | 宿主路由 | 浏览器设置区 | 独立hub |
| --- | --- | --- | --- |
| 初次加载 | health/status均200 | 有实体宠物设备，显示disabled/未启用、空设备、配对禁用 | 存活且IPC可达 |
| 测试patch设disabled:true | health 404 | 设置入口及当前面板自动消失 | 存活 |
| 测试patch恢复启用 | health/status均200 | 设置入口自动恢复 | 存活 |
| 停测试宿主、从测试profile移除bundle/dependency/link及hub patch、重启 | health/status均404 | __DSH_BOOT__无hub条目 | 存活，随后正常停止 |

热重载通过实际profile文件监听与客户端模块图更新完成，没有刷新现有desktop或写现有pet配置。初次加载并进入面板时浏览器控制台0错误/警告；停用/卸载检查产生的404是刻意请求不存在路由的预期结果。新home首次打开有预览版和登录提示，只在测试页关闭提示，不登录。宿主会生成空白初始会话UI，未提交任何任务。

实际DSH设置截图：忽略目录.cache/host-validation/loaded.png，已视觉检查；受宿主模态框高度限制可滚动，中文与状态卡正常。原始host日志含测试URL一次性令牌、schema输出含本机默认路径，均只留忽略目录，不复制到Git或报告。报告不保存实际端口/令牌。

## Schema导出限制

hub在dump-config-schema中为status:schema，字段runtimeDirectory被正确投影，hub条目无诊断。但整个官方web模板的schema导出本身返回4个Agent preset carrier错误（/187–/190）及4个其他条目警告。本轮卸载hub后对官方模板再次导出，诊断级别和路径完全相同，确认不是hub新增。不能将本轮写成“全宿主schema导出无错误”；本轮只验收hub字段投影和实际运行时装配。

CLI在当前执行环境打印一次Electron codesign task_name_for_pid警告，测试宿主仍成功启动。该警告未通过修改应用签名或系统权限处理。

## 清理、测试与结论范围

本次两个测试DSH启动均已停止；测试profile最终不包含hub bundle/依赖/链接；hub在卸载后确认存活，再正常停止，socket/描述文件正常释放。隔离home与原始证据保留在临时/忽略目录，未把它们加入Git。原desktop文件摘要一致。

`npm run check`、`npm test`（含build，共15组）、`node --check dist/client.js`、`git diff --check`通过。新增候选manifest回归检查保证Config主入口、React external和精确schema peer不会在构建中丢失。

本轮完成真实Web profile加载/热重载/卸载及React/slots/Config验证。仍未验证：Electron desktop入口、打包商店兼容审核、同一测试profile与pet共存、页面getState真实接入、真实DSH任务语义、BLE、设备协议与心跳/素材下发。现有desktop/pet/bridge未变更，不能把隔离验证扩大成这些能力已通过。

下一入口：先设计设备身份/控制代数/心跳与legacy v4迁移Spec/Diff；如要继续pet真实来源集成，另建隔离共存方案，在不升级现有pet的前提下明确来源版本与恢复步骤。

最终回归发现并修复macOS UDS竞争偶发返回EEXIST（而非EADDRINUSE）的边界；两种错误均进入已存在实例的鉴权附着流程，不删除socket或覆盖实例。修复后重复独立进程竞争测试及全套测试通过。
