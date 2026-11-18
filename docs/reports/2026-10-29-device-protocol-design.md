# 设备协议与迁移设计交付

2026-10-29。本轮对应用户确认的下一交付：Spec/Diff与模拟设备验收清单，实际只更改管理端文档。

## 完成

- [Spec](../context/plans/device-protocol-spec.md)与[Diff](../context/plans/device-protocol-diff.md)：模块职责、模拟→服务装配→实物的分阶段门槛。
- [hub-device/1消息契约](../protocol/hub-device-v1.md)：身份/绑定/会话/boot/控制代数、能力匹配、独立播放确认、幂等/乱序/重连、用户意图冲突与解绑状态。
- [旧v4迁移/回退](../context/plans/legacy-v4-migration.md)：旧接口不能提供的保证、显式legacy模式、单控制者切换、固件/NVS/凭据恢复前置条件。
- [30项SIM清单](../context/plans/device-simulator-acceptance.md)：输入与故障、期望拒绝/状态、验证层级，直接作为后续模拟器测试入口。
- 上下文与README已更新；未把设计或清单写成已完成支持。

## 核对得出的关键事实

1. v4/state是全局三个整数，played只有动作/修订；无设备身份/heartbeat，不能提供认证多设备保证。
2. 当前native240固件在player.bind后就排队ack，尚未提交首帧；新playing语义必须另加真实帧提交钩子。bridge的HTTP ok也不表示本次ack实际匹配目标。
3. /status内部调用调度get，读取可能推进定时动作；未来legacy观察不能照搬pet/state的零副作用声明。
4. 旧pet_config只接受裸数值IPv4 HTTP base；不支持path prefix/HTTPS，不能只换地址就升级到新协议。
5. 最终角色映射中working=11、success=58等不同于早期五动作默认值，后续必须按审核manifest映射，不按数组编号重排。

## 检查结果及限制

- `npm run check`、`npm test`（含候选构建，15组）、`git diff --check`通过。它们验证现有代码未回归，**不是30项SIM测试通过**。
- 新增Markdown链接和JSON示例进行本地解析检查；示例均标合成，未引入真实凭据、运行配置或动画文件。
- 未创建/运行设备模拟器，未修改core/runtime逻辑、固件仓库或正在运行的pet/桥接配置；未烧录、安装插件、提交推送。
- LAN承载/认证/TLS依赖、系统凭证库、BLE、NVS掉电原子性仍为前置技术验证，未以抽象字段替代实现。

下一可执行任务：S1纯core注册表与device actor，注入时钟/认证fixture并逐项执行SIM-01–30；此后才接simulation服务/UI。真实固件/设备接入需另行明确变更和回退。
