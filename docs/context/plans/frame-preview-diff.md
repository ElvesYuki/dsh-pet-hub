# 离线帧预览与资源恢复 Diff（实现前）

| 层 | 计划变更 |
| --- | --- |
| runtime/material-import、material-worker | PET4单帧像素能力、RGB565LE独立ArrayBuffer转移，原摘要不变 |
| runtime/material-store | 统一worker失败/关闭、验证/RPC期限与在途上限，最小资源指标及测试注入点 |
| runtime/role-runtime | 当前actual像素读取与背压/代数校验、显式确认版本retry、服务内单调意图revision |
| runtime/service、client | frame/retry固定接口及隔离响应预算 |
| dsh-plugin、ui | 同源frame/retry代理、受控画布生命周期、显示资源和恢复入口 |
| simulator、scripts | 原创多帧彩色PET4、preview:frames独立预览 |
| tests、docs | 超时/退出/恢复/有界资源/像素/IPC/UI用例、协议和长期上下文 |

不迁移原私有状态格式，不添加依赖，不执行外部代码；旧SIM2和旧偏好链路保留，新像素接口仅用于已激活PET4。实现结果与未覆盖项另写报告。

压力探针发现后、修改前追加：simulator/session的合成请求结果改为128条FIFO窗口，更新S2验收以检查窗口内重放/冲突及淘汰后CAS拒绝。仅消除合成控制推进的终生128请求限制，不改core设备命令/触摸去重规则。

实施结果：上述层均已接入。新增ui/frame-preview.mjs、simulator/pet4-sample.mjs、scripts/stress-role-resources.mjs及tests/frame-preview.test.mjs，构建客户端增加纯UI模块，新增preview:frames命令；verify-role-pet4扩展真实当前帧摘要核对。旧S2测试更新窗口语义，新增淘汰手动意图不能绕过CAS的用例。137项、浏览器及有限压力/完整360通过，内存峰值/剩余core容量限制见[报告](../../reports/2026-10-29-frame-preview.md)。
