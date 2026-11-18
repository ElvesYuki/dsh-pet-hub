# S1实现 Diff（实现前）

- packages/core新增protocol、registry、device、scheduler模块，保留原P0示例入口不替换其行为。
- packages/simulator新增虚拟时钟、故障队列、合成设备/持久层/认证fixture；不导入runtime，不增加网络入口。
- tests/s1.test.mjs包含SIM-01–30独立命名测试及跨设备/故障断言；test:sim脚本不构建插件/启动IPC。
- 测试结果与未覆盖项回写报告、验收清单和当前上下文；不更改候选插件、现有服务装配或固件仓库。
- 新代码MIT，无第三方依赖、真实凭据或动画。下一S2再接显式simulation服务/UI，生产认证transport另立计划。

实施补充：构建复制packages时排除simulator目录，避免认证fixture被装入候选包；只改变构建文件清单，不改变插件/运行服务行为。
