# P1设备协议 Diff

2026-10-29。本文区分本轮实际文档差异与下一阶段代码计划。

## 本轮实际差异

- 新增device-protocol-spec.md、docs/protocol/hub-device-v1.md、legacy-v4-migration.md、device-simulator-acceptance.md。
- 补齐身份/绑定/启动/认证会话/控制代数边界，明确仅实际首帧提交算playing；更新协议索引、当前待办与决策。
- 不改变现有P0 DevicePlayback、runtime/status、来源装配、候选插件、固件及桥接运行配置；目前deviceTransport仍为false、devices仍为空。

## 下一阶段拟实现（本轮未做）

| 模块 | 计划差异 | 验收 |
| --- | --- | --- |
| packages/core | 新增注册表、能力匹配、控制session/租约/幂等、按设备目标/回执；旧P0示例迁移后再删除 | 对应SIM案例，BigInt序号、不可变摘要、注入时钟 |
| tests/fixtures与模拟actor | 身份认证fixture、两设备、故障注入、持久状态重启模型 | 无网络/真实凭证，输出synthetic=true |
| runtime | 显式simulation装配；仅白名单设备意图/摘要，不引入LAN/任意URL | 默认disabled/无设备行为保持；多客户端不重复下发 |
| ui | 注册/连接/来源/控制/desired/actual分别显示，清楚标识模拟数据 | 禁止把accepted显示为playing或把legacy显示为已绑定 |
| 固件（另授权） | 身份/协议/帧提交确认及NVS提交；保留恢复方案 | 承载/认证子Spec及真机门槛，不能由模拟替代 |

## 非目标

不复制Python桥接Apache源码/动画，不实现自定义密码学；不因本轮文档创建UDP/TCP监听或TLS占位，不把模拟认证fixture连接生产transport。实物迁移、BLE/热点配网、1.75C、音频/IMU、OTA另立任务。
