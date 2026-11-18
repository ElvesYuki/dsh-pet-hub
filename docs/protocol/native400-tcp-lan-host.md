# TCP-09：专用LAN窗口单实例宿主

2026-11-05。[Spec](../context/plans/tcp09-spec.md)/[Diff](../context/plans/tcp09-diff.md)/[报告](../reports/2026-11-05-tcp09.md)。独立lanReview已装配；本轮只用合成决定及注入NIC快照做真实UDS/loopback，不执行实际LAN/STA/ESP。

后续[TCP10](native400-tcp-lan-request.md)已补严格私有请求加载和赢家端点交接门禁；本页“未有加载器/下一配置装配”是TCP09阶段范围。产品UI/CLI、可信凭据调用方、真实用途/设备窗口仍未完成。

## 可信本地入口

1. 可信调用方自行完成R0来源/用途决定后，调用TCP08的prepareNative400LanProfile。此模块不读取真实许可证、素材、设备cache或发放批准；source_review_sha256和material_approval_id只是调用方独立引用。本轮样本均原创合成，不可输出为真实设备配置。
2. `prepareNative400LanHost({profile,ackMs?,tickMs?,timers?})` 无I/O、不acquire窗口，返回不可序列化opaque option。使用新的LAN profile，拒绝旧offline binding/host option。安全descriptor仅版本/scope/规范输入摘要，不返回端点/身份/批准正文。
3. `startOrAttach({directory,lanReview:option})` 使用原UDS bind选主，仅同一私有runtime目录内单实例。要求显式directory，source/device disabled，且其他review/material模式互斥。sourceKey绑定profile规范输入（身份/决定/端点/windowMs）及ack/tick；同配置附着，不同配置拒绝、不覆盖旧赢家。
4. 只有赢家acquire一个LAN owner。构造成功不等于TCP启动，claim仍false、network初始down；仅赢家本地返回的lanReview句柄才能显式start/networkLink/base。附着者没有这个句柄，close无权停赢家。旧tcpReview/offline模式的限制保持。

descriptor不含prepare时的绝对单调时刻，使不同进程可附着同一窗口意图。附着者不会acquire自己的profile或改变赢家截止；重新prepareHost也不能续期。单次profile仅一owner，窗口到期不会自动准备新profile。更换独立profile须新可信本地决定；审批引用ID没有被扩为全局持久去重/认证凭据。

本轮没有新增配置文件加载器、USB/Wi-Fi凭据提供者、CLI/DSH UI按钮或自动LAN服务。跨进程JSON仅测试fixture，不是产品可信导入入口。管理端可信配置装配与R0仍未完成，不能靠字段改名把旧PC快照升级为设备用途。

## 只读IPC与退出边界

GET `/v1/status`新增lanReview，profile=native400-lan-host-view/1：窗口scope/claimed/invalid/remaining_ms、listener、占用会话、link epoch/ready、已报告首帧历史动作与transport_exited。current_display=unknown、verified=null、source_evidence=caller-declared-reference、device_evidence=false。pure core重建字段，拒绝不兼容的设备/显示/完整性声明；路径/接口/IP/port、摘要、批准正文和操作句柄不进公共状态。未提供lanReview时不输出该slot，未扩DSH代理白名单。

所有其他IPC路由均404，包括config/source/page写入；状态不是操作授权。capabilities.deviceTransport仍为false，表示没有生产设备管理通道；候选listener即使由可信代码启动也不生成正式设备库存/播放/保存事实。transport_exited仅表示此host的listener/socket/session/timer/active全0，不代表设备STA/View/Flash已退出。

服务close顺序：同步fence本地句柄、开始TCP关闭→等待成功退出→核资源全0→删除descriptor并释放UDS。close抛错或资源未归零时保持UDS及503、拒绝后续本地操作，不能让另一app夺走所有权。可信调用方可手动重试close；不会重试动作/start或修复未知fd。持续不确定则保持故障现场，不自动抢socket。设备stop/cleanup_complete需真实提供者另行观察，host关闭不能代替。

过期窗口的剩余有效时间显示0，而非最后一次检查前的旧值；窗口失效状态仍可只读。正常关闭后同profile重开失败；新的独立profile只创建新未启动窗口，不自动network up或重放目标。进程崩溃后的陈旧UDS继续沿原手动检查原则，不声称自动回收。

## 验证、回退与下一入口

13专项含两独立进程与同进程选主、配置不匹配、默认slot、只读/隐私/坏snapshot、真实loopback手动启动/退出、附着者退出、到期不续、清理失败持锁和手动重试、旧profile重开拒绝。真实LAN分支未bind，不执行STA或固件脚本；全量及SHA见报告。

回退await赢家close并核资源退出，再删自有临时根；清理失败保留UDS调查，不强抢。省略lanReview即原默认模式，无持久配置/分区/素材/现有服务迁移。本轮无ESP、烧录、生产listener、插件安装、pet/bridge/DSH更改或提交推送。

下一入口：完成管理端可信配置装配与R0用途/来源审阅，复用终端已有USB临时RAM导入器，准备双方精确身份/raw index/端点及有限设备窗口的输入和回退；再按授权测实际NIC/STA、NVS拒绝计数/PHY校准、动态RAM/栈/最坏往返及真实worker/View和关闭确认。不重复单实例宿主/Core/owner/STA候选；STATE、媒体流、保存/V3后置。

收尾终端只读更新：station USB提供者已实现372B包与独立392B RX、boot/nonce/共享seq、Ready/Queued和2秒失败封锁；终端有默认只验证的私有文件工具，未执行真实apply。其新station 495969de…未部署，静态DRAM较默认+36016B/IRAM+26700B不是动态准入。USB开关可能复位，真实窗口须单会话观察，stop请求不替代cleanup_complete。管理端尚无产品配置导入器或实际交接；协议/上游证据详见[TCP09报告](../reports/2026-11-05-tcp09.md)。
