# 服务装配、电源与会话回收演进

2026-10-30。本轮仅替代“会话层未挂服务选主、没有OS观察源、managed路径仍受256历史上限”的当前描述。生产设备listener、真实睡眠/唤醒时序、签名/密钥及物理准入仍未完成。当前证据见[报告](../../reports/2026-10-30-service-power-capacity.md)。

## 原当前系统片段

原文内部链接沿用原current-system.md位置，统一从上方报告进入。

```text
2026-10-30绑定与会话一致性：check（仅.mjs语法）及test（含构建）全套348项通过，新增28项（元数据8＋会话/真实TLS20），含并行角色加载及既有TLS/认证回归。hub-bindings/1单一元数据供Registry/TLS共用，私有文件/摘要/uint64 CAS/写锁/file与目录fsync已验证；撤销先冻结和统一失效，再提交pending_revocation，写前失败或提交不确定都不假报成功。三个真实子进程SIGKILL切点验证遗留锁fail closed及已知自有临时锁恢复后的状态。见[报告](../reports/2026-10-30-session-consistency.md)、[契约](../protocol/session-consistency.md)、[替代历史](history/session-consistency-evolution.md)。

会话owner生成service_instance/session/挑战，真实mTLS上两步hello同socket/同凭据/5秒期限、重复confirm幂等，新连接须重新acquire；Registry按当前绑定代数与完整hello校验。统一取消票据、失效guard/Registry/auth，旧close不清新会话；注入休眠在host停钟时仍撤销旧授权，可信时间未知拒绝恢复，单调回退暂停。断线保留最后actual，新hello current actual未知，历史last_observed明确非当前；历史不跨进程持久恢复。

本轮仅用临时存储、虚拟时钟和literal loopback动态TLS环境，正常及两条CLI的SIGTERM取消清理通过；SIM30+4、双时钟13、租约11及768参数/2368边界回归通过。正式服务仍deviceTransport=false，没有生产listener/元数据迁移、真实OS休眠事件、配对/私钥存储、设备持久撤销确认或ESP接入。256历史session上限的安全回收、实际负载资源/磁盘查询性能与生产单实例装配待审，NO_GO_UNTIL_MEASURED保持。

```

## 原下一入口

```text
1. **生产装配与会话容量评审**：单一元数据/CAS、hub hello/重连、统一失效、注入休眠及故障恢复已完成，见[报告](../reports/2026-10-30-session-consistency.md)，不重复实现。下一先补Spec/Diff审查把会话owner挂入已有单实例服务的边界、元数据显式初始化/迁移与秘密引用、OS电源事件来源、256历史session上限的安全回收、握手/每块重验与同步磁盘查询的负载预算；先临时/隔离验证，不自动启用生产listener或改现有配置。
```

旧348项属于会话一致性阶段；旧直接context auth仍保留256限制，不能把managed一次性admission的新结论套到旧入口。原存储/hello/崩溃恢复证据继续有效，真实电源周期和ESP限制没有被替代。
