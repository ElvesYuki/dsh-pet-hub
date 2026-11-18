# 模拟设备验收清单

2026-10-29；状态：**SIM-01–30已在S1模型层执行通过**，另有4组补充回归；原P0/P1的15组也通过。真实wire/IPC/UI及硬件不能由此视为通过，逐项限制见[验收报告](../../reports/2026-10-29-s1.md)。

## 测试台

- 两个device actor A/B，有不同身份密钥fixture和合成能力；controller C，同controller的hub实例H1/H2，另一个未绑定controller U。
- 使用注入式单调时钟、固定随机种子和消息队列，可丢包/重复/乱序/延迟；持久层可模拟“提交前失败/提交后应答丢失/重启”。不使用真实网络、设备、凭据或动画。
- 合成manifest仅保留少量代表动作（如0/11/58），摘要/文件均标synthetic=true；46动作实际目录只做独立manifest完整性检查，不把3动作fixture称为46动作验证。
- 每用例输出ID、输入事件、时间推进、拒绝码、desired/actual、控制/绑定/连接摘要及零副作用断言；不输出密钥。报告阶段标签严格区分simulated/host/physical。

## 必选用例

| ID | 操作/故障注入 | 必须观测的结果 |
| --- | --- | --- |
| SIM-01 | 未认证hello、自报device_id、发现广播 | 不进入bound/online，不产生目标；认证层拒绝 |
| SIM-02 | A同身份换IP认证重连；伪设备重复A的device_id | 真A复用绑定、新session；伪设备identity_conflict，不覆盖注册表 |
| SIM-03 | 未知协议、畸形seq、>16KiB/深度超限 | 拒绝且注册表/队列/租约零变更，不自动降级v4 |
| SIM-04 | A报告当前圆屏能力；B仅支持不同尺寸或PET3 | A可匹配合成PET4，B为unsupported/incompatible_asset，不静默缩放 |
| SIM-05 | H1控制A，H2以同controller身份acquire | H2 lease_busy，不能凭新service_instance抢占 |
| SIM-06 | acquire提交前持久写失败；成功后丢granted并重试 | 失败无授权；同operation_id活跃重试同一grant，不重复递增epoch |
| SIM-07 | 续租、过期、旧operation重发、H2接管、H1复活 | 续租不写持久层；旧grant不复活；新epoch后H1命令stale_control/lease_expired |
| SIM-08 | 设备重启、hub重启、会话断开各自注入 | boot/session/instance按各自规则换代；旧回执/旧lease全部拒绝，不盲重放队列 |
| SIM-09 | 在2^53以上比较epoch/revision，推进至uint64最大值 | 精确BigInt顺序；到上限拒绝，不出现舍入/回绕 |
| SIM-10 | 同command_id同内容重复；同ID改action/hash | 前者幂等，不重新下载/计时；后者idempotency_conflict |
| SIM-11 | 先accepted/verified，推进时间10秒再playing | playing前展示计时未启动，不能因冷下载提前结束 |
| SIM-12 | 重复playing、乱序低report_seq、failed之后迟到playing | 不重置首帧时间，低序忽略，终态不复活 |
| SIM-13 | A/B相同action/revision，交换其playing/心跳 | 两端均拒绝串设备/绑定/boot/session；A确认不推进B |
| SIM-14 | 目标A1下载未完连续提出A2/A3，A1晚到verified/playing | 只A3可成为最新目标，A1不能改新计时；旧actual可继续到A3就绪 |
| SIM-15 | 长度/SHA/编码/尺寸/头格式任一失败 | asset_integrity_failed或incompatible_asset，旧播放槽仍可用 |
| SIM-16 | 第五素材到达四槽满，目标槽/当前槽受保护 | 只淘汰允许LRU槽；单下载并发上限生效，控制/心跳可调度 |
| SIM-17 | 心跳seq重复/倒序，15秒/30秒边界 | 重复不能延长在线；>15秒stale、>30秒offline；边界相等保持前一状态 |
| SIM-18 | 已连接source=null；来源不可用超过2秒；来源恢复 | 合法空闲不标断连；仅自动模式在宽限后提出空闲，不篡改手动/桌宠 |
| SIM-19 | 手动预览中source变化；触摸插入/结束，多次触摸 | 手动保持；触摸有去重/冷却；结束回最新意图，不回旧revision |
| SIM-20 | 控制lease到期但动画缓存已完整 | 当前缓存可继续，无新远程命令；online/source状态不冒充仍受控 |
| SIM-21 | 设备重启PSRAM为空、网络不可达 | actual无可播素材；显示冷启动不可播，不能凭旧注册表标playing |
| SIM-22 | 在线撤销重复operation；设备提交后撤销应答丢失 | 不重复提交；旧epoch失败；无可信确认显示revocation_unconfirmed |
| SIM-23 | 离线forget_pending；旧凭据再次连入 | hub拒绝新控制/显示撤销待确认，不把本机删除当设备解绑 |
| SIM-24 | mDNS地址变化/冲突、未知hostname或任意asset URL | 不自动绑定、不跟随任意地址；只允许已认证目录摘要的素材通道 |
| SIM-25 | 旧v4 state/played/status fixture注入 | 仅legacy标签、弱确认；不得生成真实device_id/心跳/新协议playing |
| SIM-26 | legacy第二设备或同时启用两写者；旧v4与新协议自动降级 | 明确拒绝，不能共用全局ack；无隐式切换 |
| SIM-27 | 用户解绑/取消与在途下载/playing竞态 | 绑定冻结后不接受新目标；旧会话回执不能恢复已撤销关系 |
| SIM-28 | 多个插件/独立客户端同时向同一服务提交意图 | 服务唯一调度器；请求去重/意图冲突明确，客户端退出不重置设备 |
| SIM-29 | 持久配置CAS冲突、hub异常退出后恢复 | 用户绑定/映射不被旧revision覆盖；瞬态队列/lease不持久重放 |
| SIM-30 | 日志、IPC摘要、UI状态序列化 | 不含秘密/任务正文/SSID/任意URL；UI区分discovered/bound/online/controlled/playing及synthetic |

## 跨模块额外门槛

触摸冷却默认1秒，单次上限30秒（虚拟时钟fixture）；本地挥手动作由角色包帧数/fps确定时长。具体板上手感仍需另验。unknown mandatory字段按解码schema拒绝；可选extensions被忽略且受限。

服务simulation装配后再次运行单实例/IPC/Config与宿主回归，不能因为SIM测试通过就改默认source/设备连接方式。软件验收报告至少列每个SIM ID的实际结果及未覆盖项。

## 不能由模拟替代的实物项目

认证/加密重放与降级攻击、设备安全存储/NVS写入耐久和掉电、BLE授权/GATT/配网、Wi-Fi并发及吞吐、首帧提交钩子/面板表现、四槽内存峰值、下载窗口24FPS与长帧、物理断网/断电、USB恢复。这些分别在承载/固件/P2计划验收，SIM全部通过也不得标为physical通过。
