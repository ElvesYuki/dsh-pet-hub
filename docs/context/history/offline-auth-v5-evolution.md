# 离线认证与v5期限演进

2026-10-30。本次替代范围：原“仅合成proof/无v5表示”的当前摘要和待办已由真实证书/私钥/报文验证工具及候选TTL编码实现替代。不是TLS握手、现行固件v5或实物互操作完成；实测/休眠/Flash/资源限制保持。当前结论见[报告](../../reports/2026-10-30-offline-auth-v5.md)及[当前系统](../current-system.md)。

## 被替代的当前系统段落

下列为原文快照，内部相对链接沿用原current-system.md位置，证据统一从上方当前报告进入。

```text
2026-10-30租约预算切片当时：check（仅.mjs语法）及test（含构建）全套257项通过；本轮新增11条可信租约预算用例，SIM30+4和13条双时钟回归通过。显式core guard默认拒绝，关联可信proof/完整会话/请求seq/操作/epoch，以BigInt按最慢host/最快device及命令全链路余量计算保守发送期限；同毫秒续租由request_seq防重排、禁止降级。768组参数中592可用/176拒绝，2368次精确速率边界到达验证通过；超假设反例不能保证，由设备lease/epoch最终拒绝。见[预算报告](../reports/2026-10-30-lease-budget.md)及[替代历史](history/lease-budget-evolution.md)。

此前[30分钟墙钟报告](../reports/2026-10-30-wall-memory.md)固定原创240/360小PET4、1Hz：1801样本/1770帧/59次换包，RSS峰值180.48MiB/末值154.69MiB且资源已清理。它不代表本轮新增guard、完整46动作/分层角色/UI共存或硬RAM/多日耐久；本轮没有机械重跑长测/素材/浏览器。真实360全库仍见[资源报告](../reports/2026-10-29-resource-replay.md)。预算guard只用合成可信证明和未实测policy，不是TLS或v5 wire；时钟/延迟/休眠及实际剩余TTL生成仍需实测与承载验证，NO_GO_UNTIL_MEASURED保持。架构/契约自动门禁未实现。

```

## 被替代的待办

```text
1. **认证承载与实际期限来源映射**：离线可信回执guard、漂移/时延数学预算已完成，见[报告](../reports/2026-10-30-lease-budget.md)，不重复实现。下一先补TLS peer/credential/boot/session到proof的映射与证书/报文负例、v5剩余TTL表示转换及休眠失效策略。500ms轮询+最多1000ms分段可能超过测试示例B=1000，需按真实队列/不可抢占分段/网络/处理实测预算或约束设计，不能用未实测ppm/TTL参数准入。旧无seq触摸与实物/硬RAM门槛保持。
3. **认证与资源准入**：按新板预算补离线证书/报文负例及认证层独立时钟验证（core结果不能替代），再另行准备loopback互操作方案。TLS峰值、可信时间、持久凭据/撤销与恢复仍待验证，保持NO_GO_UNTIL_MEASURED，不套旧128/RAM EVAL性能或自动改分区。[准入门槛](plans/transport-auth-device-gates.md)。
```

## 被替代的协议描述

```text
createLeaseGuard注入registry、host clock、明确policy和verifyResponse。验证器默认拒绝，生产实现未来必须从已认证设备、已登记绑定、当前boot/session的请求响应中提供证明，并绑定完整packet与上下文；JSON的authenticated=true不构成证明。本轮用不可序列化WeakMap fixture，不能称TLS/签名/证书验证已实现。

lease_ms指设备生成该响应时的实际剩余设备单调毫秒，须≤policy.max_lease_ms；禁止重用原始租约常量或拿网页字段续满。模型grant保留expires_at以对照旧DeviceModel的精确control身份，不用于跨钟运算。真实wire仍应只传TTL，Registry/DeviceModel生产表示转换需要v5专项；不能直接将此模型packet上线。
```

旧257项与合成proof结论对应先前租约预算切片，数值证据仍有效；当前总测试数量与认证验证范围见新报告。并行动画切片阶段数据未被替代。
