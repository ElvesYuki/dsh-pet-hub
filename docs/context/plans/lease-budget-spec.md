# 可信租约与漂移/延迟预算 Spec（实现前）

2026-10-30，离线core验证，不接TLS/设备，不改固件/pet/bridge/DSH。新guard为显式选择路径，不替换旧同钟/相对参考接口；无IPC/持久格式变更。已读取开发与上下文规范，保留并行动画。

## 信任与回执

核心以注入的verifyResponse(proof,packet,context)接收可信承载证明；默认拒绝，不能接受JSON authenticated=true。模拟台用WeakMap证明绑定消息完整内容与完整device/binding/boot/session/controller/service上下文，不实现或冒充TLS。begin记录唯一request_id、内部uint64 request_seq、操作acquire/renew、expected_epoch、续租lease_id和host本地sent_at。成功grant必须对应未过期请求；acquire epoch恰好+1，renew epoch和lease_id不变。新session/boot和旧实例回执拒绝。TTL来自设备生成响应时的实际剩余单调期限，不能拿原grant常量续满。测试模型仍携带expires_at以便与DeviceModel既有回执比较，绝不跨时钟运算；实际wire不应传该字段，生产转换另验。

## 漂移与延迟不变量

令S=1000000，host/device速率分别在1±host_ppm/S、1±device_ppm/S范围内，均整数0–100000ppm。TTL L为设备响应生成时保守剩余毫秒，1≤L≤明确policy.max_lease_ms≤30000；量化/调度误差须包含在明确margin_ms≥2内。B=command_delay_ms是发送到设备实际校验命令的整个排队/网络/处理延迟上界，不只是网络耗时。

本地可发送时长T=floor(L*(S-host_ppm)/(S+device_ppm))−ceil((B+margin_ms)*(S+host_ppm)/S)，BigInt计算避免浮点舍入。host截止=原请求sent_at+T，严格now<截止；T≤0拒绝。按原发送时刻起算已保守涵盖grant生成前请求耗时，响应RTT还须≤policy.max_round_trip_ms；响应迟到不从接收时续满。实际命令到达仍受设备lease/epoch最终仲裁。若时钟停顿、误差或消息延迟超出假设，不声称保证；不知道界限就不配置guard放行。

验证推导：host最慢时，在T host ticks内真实耗时≤T/(1-host_ppm/S)，加B与误差余量仍早于设备最快到期L/(1+device_ppm/S)。无时钟同步或壁钟证书有效期保证。policy示例仅数学测试假设，不是175C硬件指标。

## 生命周期与失败

单guard最多32 pending、32完成回执及64设备高水位；request_seq拒绝重排/同毫秒旧响应，完成回执重放不扩截止。同ID异内容拒绝，窗口外旧响应未知请求拒绝。过期显式expire/新请求时回收，无定时器。close幂等、清所有状态；连接重置invalidate清对应旧请求/确认/回执，不能通过换ID延长旧lease。校验失败不更新Registry或最近确认，高水位只在Registry接受后提交。

## 验证与回退

确定性负例覆盖伪证明/序列化证明/篡改TTL、上下文/epoch/lease/request错配、超长TTL/字段、重复/重排/过期/断线/关闭、容量和失败不改actual。数学矩阵用独立实数时间/两端整数速率表达验证最慢host/最快device、发送边界和最大B；加入超假设反例，明确不能外推。

运行check/test；新核心路径另跑SIM清单与双时钟。无UI/素材变化不重复长测/浏览器。归档被替代的当前待办/漂移未实现片段；仍保留实际承载认证、振荡器/调度/网络实测、Flash/v5及NO_GO门槛。回退仅停止离线脚本并撤回guard/测试，无运行服务或持久数据需回退。
