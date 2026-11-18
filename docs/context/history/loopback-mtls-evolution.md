# loopback mTLS演进

2026-10-30。仅替代“本仓库尚无实际TLS握手/监听”和“下一先做loopback”的当前状态。原离线证书/TTL及漂移算术仍有效；生产listener、ESP、固件v5、可信时间/持久凭据及物理时延资源限制保持。当前证据见[报告](../../reports/2026-10-30-loopback-mtls.md)。

## 原当前系统摘要

以下原文内部链接沿用原文件位置，统一由上方当前报告进入。

```text
2026-10-30离线认证/v5期限：check（仅.mjs语法）及test（含构建）全套270项通过；本轮12条认证/报文/延迟用例通过，SIM30+4、双时钟13条、租约预算11条及768参数/2368速率边界回归通过。runtime以真实临时P-256证书、私钥挑战及原始报文签名映射绑定/credential_epoch/完整上下文，生成不可序列化proof供默认拒绝的guard验证；每次重新检查撤销和可信证书时间。候选4KiB canonical v5管理回执仅传生成时剩余TTL，Registry相对路径不再依赖绝对expires_at，同钟兼容保留。见[报告](../reports/2026-10-30-offline-auth-v5.md)、[契约](../protocol/offline-auth-v5.md)及[替代历史](history/offline-auth-v5-evolution.md)。

管理设计500ms轮询/1000ms分段加假设排队/网络/处理，命令上界1900ms、最快host RTT3802ms、121相位样本通过；15秒TTL/双端500ppm/margin10发送跨度13074ms。均为假设，旧B1000不能覆盖。只读当前v5源码为300ms循环末尾等待、Bearer及整文件下载，没有管理租约；本仓库候选profile不代表现行固件支持。未执行TLS握手/监听、生产peer/报告映射、休眠自动失效或物理延迟/漂移验证，NO_GO_UNTIL_MEASURED保持。

```

## 原下一入口

```text
1. **真实TLS peer互操作方案**：离线证书/私钥/报文负例、绑定映射、v5候选剩余TTL及轮询/分段假设预算已完成，见[报告](../reports/2026-10-30-offline-auth-v5.md)，不重复实现。下一先补独立loopback mTLS Spec/Diff与回退，固定套件、临时私有CA/动态端口、真实peer→绑定→proof、撤销和Range失败边界；当前没有监听或真实TLS握手。休眠/速率越界后的auth/guard/Registry统一失效仍待实现；1900ms/500ppm仅设计参数，不可作实物准入。
```

原270项是离线认证阶段数量，后续并行角色导出16项及本轮TLS22项使本轮全套为308项；不将其他路线成果归于TLS。旧阶段报告保留，不能用历史未实现描述覆盖当前结论。
