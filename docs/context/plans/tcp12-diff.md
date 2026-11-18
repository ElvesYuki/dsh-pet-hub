# TCP-12 Diff（实施前）

- runtime/native400-lan-input-audit：新增WeakMap任务内已完成证据getter，未完成/失败/close为null，非真实task拒绝；不改变读流程/recipe/资源语义。
- 新runtime/native400-reviewed-lan-request：闭合独立material review校验、同次审计/现有windowDecision关联，复用TCP10生成opaque请求，审计关闭时禁止交接；不新建审批记录或设备事实。
- 新专项和隔离验证CLI，原创实际fd/UDS排练，不bind LAN或执行USB。TCP10/09/08与service/owner/wire/依赖保持。
- 新协议/报告/结构化证据、真实用途草案/共同G0当前状态和归档；MIT登记，无凭据/本地端点/素材或真实批准文件入Git。不改固件/pet/bridge/DSH，不提交推送。

实施状态：18专项/隔离CLI、check及含build单套1604通过；只原创实际audit/临时UDS，TCP未启动，不启LAN/USB/STA/ESP、未签录真实用途记录。见[报告](../../reports/2026-11-05-tcp12.md)。
