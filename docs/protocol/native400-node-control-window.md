# TCP-17：纯Node控制窗口启动装配

2026-11-05。[Spec](../context/plans/tcp17-spec.md)/[Diff](../context/plans/tcp17-diff.md)/[报告](../reports/2026-11-05-tcp17.md)。正式方向为React共享界面、Node单实例管理服务、LAN明文二进制TCP与ESP C++；Python/serial不是管理端运行依赖。

后续[TCP20](native400-connection-controls.md)已补默认OFF Connection承载候选与独立浏览器共享验证；实际DSH rc.5 profile认证/动态加载仍待，未自动安装，TCP19有限后台窗口/剩余TTL边界保持。

后续[TCP18](native400-node-control-channel.md)增加可选controlAccess及本地authorizeControls/revokeControls/controlClient，绑定真实request后才开私有命令；默认无option仍为本页只读/可信本地控制模式。 [TCP19](native400-shared-control.md)在显式shared策略下增加detachControls(credential)/endControls()及后台剩余TTL恢复；表中“新会话不自动重放”指缺省owner/legacy模式，shared只对最新有效intent在新OPEN后恢复。

## 明确入口

runtime/index导出`createNative400NodeControlWindow({enabled=false,directory,lanReview,signal?})`。必须enabled=true、绝对规范目录、当前进程真prepareNative400LanHost选项。构造参数闭合，拒wifi/consumer/executable/source等附加配置；不读取Wi-Fi文件/凭据，不生成设备RAM配置，不运行USB脚本、子进程或探测设备。

可信本地调用方负责已有来源核定、独立用途决定和LAN profile准备；此入口不签发许可/批准，不将历史PC库存当当前设备，也不让JSON文件自授权。实际LAN应从既有reviewed request取得真实lanReview并遵守来源/audit与独立窗口契约；本轮没有执行其真实LAN复合成功分支。

它复用startOrAttach和既有sourceKey/UDS单实例：只有赢家await原LAN owner.start({enabled:true})，动态port0/指定单地址；附着者不另建TCP/不取得控制句柄。source/device继续disabled，pet和DSH配置不被写入；没有额外生产listener、自建调度器或新IPC写路由。

ready返回`{role,instance_id,transport_started,device_evidence:false}`。owner表示该host监听已启动；attached只完成只读附着，不能控制/停止赢家。**ready不表示设备联网、HELLO/OPEN成功或已播放**。来源/配网由外部完成，本入口不把networkLink自动置true。已有apps/service/main的默认Node服务行为不变，插件不自动启动窗口；新增可信本地API尚不是面向用户的产品CLI。

## 控制、网络与观察

| 方法 | 本地语义 |
| --- | --- |
| address() | ready且未关闭赢家才能取真实动态IPv4/port，仅本地后续交接使用，不进公开view或Git |
| networkLink(epoch,ready) | 明确外部单publisher观察；旧epoch不改状态，新epoch包括up/up使旧连接失效；不代表密码学认证 |
| base(action,ttl?) | 只remote0/1/11，调用提交沿用原截止，不代表accepted/verified/首帧；4仅本地触摸 |
| cancel()/reapply() | 复用原取消/重连策略；新会话不自动重放，显式reapply只用剩余TTL |
| pause()/resume()/tick() | 原owner行为，无新会话监听/TTL延长或自动动作 |
| snapshot() | wrapper阶段/角色/关闭/稳定错误、python_required=false与原publicNative400LanHostView |
| resources() | startup_pending/service_owned/ownership_unknown及原transport实际计数，无端点/凭据 |

操作在ready前、关闭后或attached调用时明确拒绝，错误稳定node_control_*，不回显底层路径/配置。snapshot.transport的verified=null、current_display=unknown，frame0_history只是收到的首帧历史报文；device_evidence=false。loopback模拟ACK/prepare/PRESENTED不作ESP显示或完整文件SHA证据，TCP发送成功也不推进设备播放声明。可信调用方调用动作仍需既有产品权限/选择/会话边界，不能把本地函数直接公开成无鉴权网页路由。

现有单活socket/一个在途与latest、映射核定、触摸优先、取消和deadline/PING/失败关闭全部复用原实现。本片未修改wire/codec/owner/core/TTL。窗口过期时原transport关闭且不会给新窗口；UDS状态可保留供检查，最终仍须显式close本task。

## 关闭及恢复

close同步fence后续控制，已有service立即开始关闭；UDS启动尚未完成则等迟到赢家返回再清理，不继续启动TCP。返回Promise等待ready收尾和原service.close的实际TCP/socket/timer/UDS清理；attached close只关闭本任务。

清理失败保存cleanup_unknown和service句柄，保留失败Promise，不在同一次close/ready收尾里暗中重试。人工核对并修复后，**再次明确调用close**才重试原服务清理，不重run/start/base/配置下发。TCP资源退出失败沿原service规则保UDS/503；若失败发生在更后面的descriptor/服务收尾，TCP/UDS可能已关闭，但wrapper仍报告未确认，不虚报全部释放。启动在service返回句柄前遇到AggregateError则标ownership_unknown，不能自动抢陈旧UDS。

不主动删除调用者目录/配置，不自动执行设备stop/STA cleanup或固件回退。正常退出只能证明本机资源退出，不能证明设备已退回本地策略；后者仍需真机证据。close可重复，abort同样fence和清理。

## Python与产品边界

此前TCP14的createNative400UsbProcessConsumer、TCP15通用快照/consumer和TCP16加载审计保留为显式可选开发候选，**不装配进此启动入口**。固件仓库Python USB工具可由固件开发人员另行人工使用，其解释器/serial环境只在选择该工具时核定，不再作为管理端启动/发布或TCP控制前置。

产品化USB/BLE配网另做Node串口或随应用分发的原生辅助程序设计，不默认浏览器页面具备BLE能力；当前未实现。本轮不重写该协议、不增加serial依赖。空PATH的独立Node进程仍能单实例启动及真实TCP往返，验证本路径没有Python/外部命令启动要求。

## 验证及下一入口

`node scripts/verify-native400-node-control-window.mjs --output .cache/<新文件>.json`：21项原创临时UDS/真实127.0.0.1动态端口，合成身份/用途、独立模拟设备；覆盖赢家/附着、0/1/11与首帧历史、触摸/取消/重连剩余TTL、期限/启动取消/实际退出、元数据清理失败及明确修复重试、空PATH两进程。没有真实LAN bind、Wi-Fi配置、上游Python/设备/素材脚本或ESP。

下一把此Node入口与现有来源/audit/独立窗口以及管理界面受控手动操作装配，保持IPC鉴权/实例和操作权限；先离线验证再准备独立授权LAN短窗。真实设备/STA、固件稳定启动、动态资源/最坏延迟仍待；当前帧率/流畅度已获上游用户接受，严格24fps不再作为门槛，保留退化观察；STATE/媒体流/保存/V3后置。

回退await task.close核实际退出后清自有临时目录；unknown保留现场、修复后明确再close，不抢占或重发。省略新入口即保留原行为，无插件/profile或生产服务迁移。
