# P0 Diff（实现前，2026-10-29）

- 新建 AGENTS.md、README、上下文索引/现状/待办/决策、分阶段计划、接口调查与协议边界。
- 新增 packages/{core,source-pet,runtime,ui} 与 apps/dsh-plugin 的 ESM 骨架。
- 新增 node:test 宿主测试与语法检查脚本，精确记录 Node/npm，无第三方依赖。
- .gitignore 追加本地缓存、凭证、素材、依赖/构建目录；保留已有规则和 .DS_Store 文件。
- 不迁移 bridge.py/catalog_state.py 源码，不创建可安装的 DSH bundle；后续迁移需单独审查 Apache-2.0 义务。
- 不修改固件仓库及本机配置，不启动监听端口，无运行回退操作需求；撤回本轮新增文件即可撤回初始化。

## 上游参考补核差异（实现前追加）

新增只读Cordis页面适配入口和能力/首拍/引用隔离测试；修正“未发现公开服务”的笼统结论，补充上游提交、本机同版本接口差异及公开契约链接。不升级pet、不复制上游代码/素材、不安装探针插件。
