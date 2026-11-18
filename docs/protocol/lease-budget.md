# 可信回执、漂移余量与发送预算

2026-10-30，已实现离线core opt-in guard及合成验证；后续已补[真实证书/私钥与候选TTL wire](offline-auth-v5.md)，后续[Node loopback mTLS](loopback-mtls.md)已握手并映射proof，仍无固件wire或生产调度接入。依据[Spec](../context/plans/lease-budget-spec.md)，结果见[报告](../reports/2026-10-30-lease-budget.md)。

## 边界与可信来源

createLeaseGuard注入registry、host clock、明确policy和verifyResponse。验证器默认拒绝，生产实现未来必须从已认证设备、已登记绑定、当前boot/session的请求响应中提供证明，并绑定完整packet与上下文；JSON的authenticated=true不构成证明。原预算切片使用不可序列化WeakMap fixture；后续离线runtime适配器已以真实证书/私钥签名产生proof，TLS peer映射已在后续loopback完成，仍无生产服务装配，边界见[认证契约](offline-auth-v5.md)。

begin(context,{request_id,kind,expected_epoch,lease_id?})登记本地sent_at及内部递增uint64 request_seq，acquire不允许lease_id，renew要求它。packet仅接受schemaVersion=1、request_id/request_seq、完整context、kind、grant、lease_ms。完整context为device_id/binding_id/binding_epoch/boot_id/session_id/controller_id/service_instance_id，epoch仍十进制uint64。grant匹配controller/service，acquire control_epoch须为expected_epoch+1，renew epoch/lease_id不变。设备正确执行操作并保守生成TTL是模型假设，认证来源不等于证明设备没有逻辑错误。

lease_ms指设备生成该响应时的实际剩余设备单调毫秒，须≤policy.max_lease_ms；禁止重用原始租约常量或拿网页字段续满。旧DeviceModel内部grant保留expires_at，不用于跨钟运算；相对guard/Registry现在允许省略它，同钟模式仍要求。候选管理wire只含控制身份及剩余TTL，已通过离线编码/解码与报告去绝对字段测试；现行v5固件尚无该表示，不能直接上线模型packet，见[转换契约](offline-auth-v5.md)。

## 明确假设与公式

policy必须恰好给出下列整数，未知/缺失/越界拒绝：

| 字段 | 范围/单位 |
| --- | --- |
| host_ppm、device_ppm | 0–100000，各自相对真实时间的速率误差上限 |
| command_delay_ms | 0–30000，真实毫秒，host发命令到device实际校验set的全链路上界 |
| margin_ms | 2–30000，真实毫秒，明确承担量化/读取/额外误差 |
| max_round_trip_ms | 1–30000，host本地毫秒，等待对应响应的最长观测RTT |
| max_lease_ms | 1–30000，设备毫秒，本profile最大剩余TTL |

这些数必须由实现/测量证明或保守约束产生，不能取默认值冒充175C实测。若host休眠停钟、速率越界或延迟无界，下面保证不成立；恢复后必须使旧session/guard失效并重新认证。本轮没有实现系统休眠检测。

S=1000000，h=host_ppm，d=device_ppm，L=lease_ms，B=command_delay_ms，M=margin_ms：

```
drift_safe = floor(L * (S-h) / (S+d))
reserve = ceil((B+M) * (S+h) / S)
T = drift_safe - reserve
deadline_host = request.sent_at + T
```

全部乘除用BigInt和明确向下/向上取整；仅有界毫秒结果转Number。T≤0拒绝insufficient_lease_budget。response到达必须满足now-sent_at≤max_round_trip_ms且now<deadline_host；等于deadline立即失效，不能从接收时重新计满。原请求发送早于设备响应生成，故从发送时刻起算不会比从生成时刻更晚。

在假设内，host最慢时发送前真实耗时≤T/(1-h/S)，加最坏B仍严格早于device最快的L/(1+d/S)到期；多扣的M承担量化余量。每次expect仍检查同一固定deadline，然后调用Registry.expect；设备自身lease/epoch是最终权威。保证只到命令接受，不包括下载、解码或面板首帧完成；这些动作仍要单独验授权/期限。

示例policy（仅测试假设）：h=d=500ppm、L=15000、B=1000、M=10、RTT上限2000，得到drift_safe=14985、reserve=1011、T=13974ms。不是新板配置或性能承诺；若响应在2000ms才收到，仅剩11974ms发送窗口。

B必须包含hub排队、单连接不可抢占素材分段、exchange轮询、网络/重传和device处理至set校验。现有承载设计有500ms轮询与最多1000ms分段目标，仅两项叠加已可能超过示例B=1000；所以该示例不能直接用作现有设计的生产预算。后续离线求和示例已取B1900、host RTT3802，121相位样本通过，详见[分解](offline-auth-v5.md)。仍须测量或限制各项并求和，未知则保持NO_GO；RTT与命令B分开，不以ping均值冒充最坏界限。TLS认证握手不在已确认租约续期中偷偷占用，重连须新session。

## 顺序、重复与回收

accept先检查schema、当前Registry上下文、可信证明、请求关联、操作/epoch和期限，Registry接受后才推进guard确认与序列高水位。失败不更新Registry/actual或最后确认。成功响应返回的observation含sent_at、保守T（字段名仍lease_ms）和request_seq；Registry相对接口新增可选request_seq，一旦使用序列不能降为无序；同毫秒新续租可前进，旧序列不能覆盖。

完成窗口内完全相同响应可重放，但只返回原观察，不扩截止；不同内容冲突，已被新响应取代者stale_response。窗口外旧响应unknown_request；生成方仍必须唯一ID。最多32 pending、32完成回执、64设备确认/高水位；过期通过expire或新请求回收，无后台定时器。invalidate(device_id)清对应pending/完成/确认、保留请求序列高水位，必须与Registry/承载断线失效一起调用。close可重复、清全部状态；新guard/host生命周期应建立新session，不能重置序列后继续旧会话。

guard是显式路径，不会让其他代码直调Registry.control也自动变可信；旧S1/S2与双时钟raw相对接口仍为兼容参考。本轮未新增生产IPC或HTTP路由。

## 验证、回退与后续

scripts/verify-lease-budget.mjs运行精确有理数速率矩阵并复用11条验收生成摘要（非额外独立测试）；没有socket/设备/TLS。矩阵刻意验证超预算延迟、host停顿反例，不能跨假设套用。后续离线认证/TTL、实际Node loopback、临时绑定/会话一致性及选主后review装配/原生源注册已验证；[承载负载](transport-load.md)补充逐块成本样本和包含活动控制的队列反例。物理时钟/误差、睡眠时序、生产设备调度/监听及固件v5互操作仍待准入，数学guard不提供这些上界。

无持久格式变化；回退关闭离线guard并撤回本轮代码即可，不删绑定/角色/缓存、不调整运行服务。任何真实集成另备方案与回退。
