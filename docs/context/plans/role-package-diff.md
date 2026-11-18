# 完整角色包与激活 Diff（实现前）

新增纯core角色包验证/时钟规则；扩展catalog/import/worker将语义与动作时序纳入摘要并与二进制核对。新增设备级后台激活控制器/原子指针文件/独立候选worker，已登记版本可后台重验而不依赖源路径。服务、清理保护、IPC/代理/共享UI新增激活任务与手动角色动作。新增合成包/故障/恢复/循环用例及上下文报告。保留旧偏好与S1/S2通道，不将旧包隐式激活。

实施后文件对照：

| 文件/层 | 实际变更 |
| --- | --- |
| core/role-package.mjs、materials.mjs | 完整语义契约、规则校验及虚拟帧函数 |
| runtime/material-import.mjs、material-worker.mjs | 新字段白名单/摘要、实际时序核对、登记完整的CAS复验 |
| runtime/role-runtime.mjs | 每设备角色、后台候选、首帧门槛、原子确认指针、恢复/取消/CAS |
| runtime/material-store.mjs、store-lifecycle.mjs | 共享close完成Promise、版本pin、角色引用保护及packages投影 |
| runtime/service.mjs、simulator/session.mjs | 状态装配、异步激活/取消/意图IPC、虚拟时钟/来源/会话边界 |
| core/material-playback.mjs、runtime/materials.mjs | schema2包从旧偏好播放通道分离，要求显式角色激活 |
| apps/dsh-plugin、packages/ui | 同源代理/客户端方法、版本与动作管理组件 |
| simulator/role-fixture.mjs、scripts、tests/role-package.test.mjs | 原创双规格包、独立预览、全360审计脚本及13项边界用例 |

兼容：旧包和无streaming模式保持原路径；激活状态使用新私有文件，无已有配置迁移或自动安装。实际验证与限制见[报告](../../reports/2026-10-29-role-package.md)。
