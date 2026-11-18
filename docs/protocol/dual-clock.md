# 双时钟观察与离线收敛

2026-10-30，仅core参考模型；无生产transport或固件支持。DeviceModel仍以设备单调时钟判租约，Registry以host单调时钟判在线/本地控制估计，不能跨域比较uptime。

Registry.control(context,grant,observation)及expect(context,command,grant,observation)的新增可选观察为对象{sent_at,lease_ms}（预算guard另提供可选uint64 request_seq；一旦使用序列不得省略降级）：sent_at为本host发送请求的单调时刻，0≤sent_at≤host.now；lease_ms为可信grant响应所描述的设备剩余期限，整数1–30000ms。设备原expires_at仅作原grant内容，不与host uptime相减。本地deadline=sent_at+lease_ms，收到时已到期则lease_expired；不从接收时重新起满期限。字段/身份/顺序验证全部成功后才更新。

观察按sent_at不倒退；同时间同内容重放不延长期限，同时间更高epoch的新确认grant可前进，其他同时间差异拒绝。控制身份相同可续租，已验证更高control_epoch可覆盖host尚未过期的旧估计；旧epoch/lease不得覆盖。进入相对模式后该session不接受缺少observation的调用。未使用新增观察的旧同钟S1/S2入口兼容保留；生产适配器不能省略观察偷偷回退。

lease_ms不能来自网页自报或任意旧grant常量：未来承载必须认证响应，并从新请求/响应中给出剩余期限、记录host发送时刻。延迟和时钟速率差使两端到期时刻可能不同；host估计不是设备授权，设备自身#valid是最终拒绝边界。后续[租约预算guard](lease-budget.md)已按明确漂移/时延假设实现保守margin，仍不代表实际ppm或物理最晚失控时刻已测量，也没有安全时钟同步。

report的elapsed_ms在相对模式仅检查非负安全整数，不再要求≤host uptime。started用max(命令host提交时刻,host接收时刻−elapsed)作初次估计，后续重复playing不重置；它含网络延迟和速率误差，不能当设备绝对时间、音频同步或面板扫描时间。报告仍必须匹配当前target、grant、boot/session和递增report_seq，过期/终态/旧目标不复活。

Registry.disconnect(context)显式将当前会话offline/不受控，保留最后actual供观察；旧心跳/报告/控制拒绝。新认证hello替换session并清未知actual，重新acquire、能力核对后由调用方按最新意图生成新命令；本轮模拟台验证该过程，没有添加生产自动重连器。新lease命令revision可从1开始，比较的是commandControl所属lease，不能因预先观察新grant而拿旧lease目标的高水位拒绝它。

模拟台createDualClockLab使用独立host/device VirtualClock及第三个链路时钟、既有FaultQueue，发送时复制负载。支持延迟/丢弃/复制/逆序，身份经fixtureAuth和真实Registry/DeviceModel入口检查；只用SIM1微型合成数据，非PET4/实物。close使后续动作及排队回调拒绝，队列/历史最多1024，无I/O或定时器。

运行node scripts/verify-dual-clock.mjs --output .cache/dual-clock/results.json，可重复生成13条验收摘要；脚本复用同一测试集，不是额外独立覆盖。Spec/Diff及结果见[报告](../reports/2026-10-30-dual-clock.md)。无状态文件迁移，回退只停止离线脚本、撤回本轮变更；不能自动清除现有绑定、指针或缓存。
