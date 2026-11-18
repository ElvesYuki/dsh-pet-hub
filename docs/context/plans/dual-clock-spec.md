# 独立双时钟与消息收敛 Spec（实现前）

2026-10-30，离线参考模型。已读新开发/上下文规范；保留并行动画与全部已有修改。不接设备、不改固件/pet/bridge/DSH配置，不安装/提交/推送。

根因：Registry.control以host.now比较设备expires_at，report把设备elapsed限制为host uptime；同钟用例掩盖任意启动偏移。保持旧同钟入口兼容，新增显式相对观察control(ctx,grant,{sent_at,lease_ms})：sent_at属于本host单调时钟、lease_ms是经认证grant提供的剩余期限（1–30000ms），本地有效期为sent_at+lease_ms。过期响应拒绝，重复不续期、乱序观察拒绝；不能用接收时间重新起满期限。进入相对模式的会话不得退回绝对时钟比较。设备自身租约和epoch仍是最终拒绝边界，时钟速率漂移下不保证两端同时过期。

相对模式以已验证新grant的更高epoch取代旧控制，不因host旧估计尚有效而拒绝设备已确认的新owner；旧epoch/lease/report不得覆盖。控制输入及观察均在修改前校验，失败不改状态。相对report仅验证安全整数elapsed，不跨域比较uptime；started为受命令发送时间下界约束的接收估计，非面板实际扫描或精确同步时钟。

新增Registry.disconnect使当前会话离线/失控、拒绝迟到心跳/报告，保留最后actual；新认证hello重建session与未知actual，再通过新acquire和最新目标收敛，不重放旧手动命令或旧grant。新接口补JSDoc。旧同钟调用保持，用于原S1/S2参考；生产transport仍未接入，不能把兼容入口当独立时钟支持。

新增仓库模拟台：host/device独立VirtualClock，消息队列用第三个传输时钟；每次发送复制消息，支持延迟/丢弃/重复/逆序。队列与历史沿用既有1024上限，无定时器/socket/worker。覆盖任意启动偏移、快慢/暂停单侧时钟、延迟acquire/renew、原期限边界、乱序观察/报告、重复playing不改计时、断线迟到结果、重启boot/session、epoch接管、持续最新目标收敛。模拟认证仍走fixture可信证明与Registry/DeviceModel真实授权入口，不用wire布尔授权。

验证：新增确定性用例及命令行合成报告，运行check/test；涉及核心租约另跑SIM清单。无UI/素材变更，不机械重跑PET4/浏览器。墙钟内存仅给后续方案：独立临时进程、固定素材/速率、明确30分钟窗口与采样/退出条件，另次显式执行；本轮不把虚拟推进当墙钟耐久。

回退：无持久格式变化，停止离线脚本并撤回本轮代码即可；不删用户指针/绑定/素材。更新当前摘要，已完成待办移出，旧“独立双时钟未验”的结论按主题归档；保留未验漂移硬界限、生产transport/认证/Flash与实物门槛。
