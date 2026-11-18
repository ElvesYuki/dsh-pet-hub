# TCP-18：来源绑定的手动控制与共享界面

2026-11-05。[Spec](../context/plans/tcp18-spec.md)/[Diff](../context/plans/tcp18-diff.md)/[报告](../reports/2026-11-05-tcp18.md)。纯Node，默认不启用，只使用现有单实例/IPC/代理，不启动额外生产服务或Python。

后续[TCP19共享模式](native400-shared-control.md)显式增加shared/autoRecover：多个页面复用后台组，各自权限到期不取消目标；32条完整请求回执和新HELLO剩余TTL恢复。下文轮换/到期取消与单条回执为原legacy默认语义，继续保持。

## 来源与独立窗口

`prepareNative400NodeControlAccess({request,sessionMs=60000,clock?,timers?})`需TCP12真实reviewed request，不能使用其JSON/clone/快照。它沿原request内部closed/audit-live检查取得精确lanReview，返回opaque option；不导出设备配置或消耗USB交接。sessionMs1–120000，其余运行依赖仅可信本地注入，不从配置/HTTP读取。

新增合法loopback-rehearsal review分支仅接受materialReview.source_kind=original-test，仍须实际元数据/cache/四payload SHA audit及独立materialReview/windowDecision。reviewed-upstream不能使用此分支；真实LAN仍走single-device-cached-control，scope/IPv4/NIC/设备配置交接门禁不变。loopback无法调用deviceConfig拿到Wi-Fi配置，不靠假audit或跳过校验来凑集成测试。

TCP17的`createNative400NodeControlWindow({...原参数,controlAccess})`可选装配；service只在精确匹配lanReview时接受nodeControl option，将binding/policy descriptor加入sourceKey。省略option仍只读，相同目录不同策略不能attach升级。只有赢家创建channel和issuer，attached没有authorize权限。真实源/窗口/许可仍由可信调用者独立核定，descriptor/hash不发放权利。

## 可信宿主与私有 IPC

赢家本地新增authorizeControls()/revokeControls(credential)/controlClient(credential)。authorize生成随机scope token和control_session_id，绑定service实例；controlClient复用既有createNative400ReviewClient的Bearer/实例检查/X-Hub-Review。旧凭据在请求创建前核descriptor实例，不能发给新服务。token不进descriptor、全局status、URL或DOM；页面没有authorize/来源路径/批准/配网/网络ready入口。

| 请求 | 输入及结果 |
| --- | --- |
| GET /v1/node-control/controls | 私有envelope：实例/session、next_request_seq/revision、剩余会话、网络阶段及首帧历史；不创建/续期会话 |
| POST /v1/node-control/command | protocol=native400-node-control/1、service_instance_id/control_session_id/request_seq/request_id/expected_revision/operation；base另含action/ttl_ms；cancel没有附加字段 |

seq/revision为十进制uint64，request_id为64hex；base仅0/1/11、TTL1–60000ms，4仅本地触摸。闭合字段、顺序和revision检查在边界完成。ACK只含submitted=true/operation/request_seq/command_id/revision，表示本地提交，不是设备accepted/全SHA/首帧。

每会话仅缓存最近一次完整body和ACK：相同seq/完整body确认返回原ACK，不调用base/不延TTL；同seq异内容、旧seq、缺口、旧实例/session/revision拒绝。不自动重试或恢复未知操作。TCP重连/触摸/取消/截止仍由原owner/model负责，未新增wire消息或改变codec/TTL。

## 失效与退出

每请求及25ms定时检查原source/audit/request/window；失效永久fence该channel和真实TCP owner。内部借用捕获原始owner fence/close，不信任可替换的公开同名方法。会话到期/可信revoke/rotate取消该会话目标，旧token失效，不续会话或重放。取消只是请求收敛，不承诺设备已停止；在途ACK/CANCEL和失联仍依原协议处理。

service关闭先同步fence channel/owner，清channel timer，再等实际TCP及配置owner/服务退出；未启用channel的旧路径不新增await让步，保持原来源模块同步关闭保证。清理未知仍按既有UDS/实际资源规则处理，不能抢锁或虚报退出。

页面unmount只abort自己的HTTP/定时器，不取消共享任务或服务；宿主需显式revoke，真正服务退出需await window.close。来源audit/request也由原owner显式关闭；不自动重新审阅、配网或写设备。

## HTTP 与界面

程序化createHostPlugin(client,{controlAccess:{origin,resolve}})才开放GET /dsh-pet-hub/node-control/controls和POST /dsh-pet-hub/node-control/command。resolve只能返回受信scoped client，仍核精确数字loopback Host/Origin、JSON、X-Pet-Hub与Sec-Fetch-Site，复用4KiB/2.5秒body门禁和卸载abort/safe errors。默认DSH apply无provider，保持404；没有新插件配置、自动启动或授权发放路径。

共享React组件经既有transport/白名单代理操作。只渲染0/1/11和取消，私有实例/session/seq/revision留在closure；只读轮询不写状态。网络/503/非法ACK保留原body，用户可“确认原请求”，不自动发送新动作；会话/实例变化隔离迟到结果，禁用旧操作。UI明确显示“本地提交”与“首帧历史”，current_display=unknown、verified=null、device_evidence=false。

本轮是共享组件hook＋构建候选和真实HTTP/UDS/TCP链路验证，未安装DSH、不声称真实浏览器DOM/登录身份/native picker/ESP显示已验收。独立用途/audit记录只合成原创来源，不拿本测试许可替代真实素材授权。

## 验证与回退

`node scripts/verify-native400-node-control-channel.mjs --output .cache/<新文件>.json`：25专项含真实28MiB原创cache/payload audit、独立决定和同一request绑定、HTTP/私有IPC/loopback，模拟独立首帧、精确重复不续TTL、换主/换会话、权限/JSON/预算、UI未知确认、定时失效和不可伪造owner退出。真实LAN复合成功/ESP仍未执行。

回退可信revoke→卸载proxy/UI→await window.close及request/audit关闭，核自有资源退出后清临时目录。默认省略controlAccess即旧只读；无持久格式迁移、真实设备/固件/服务/profile/DSH/pet/bridge更改。下一独立浏览器与实际DSH权限提供者接线验收、真实来源/窗口与设备授权短窗；Python不作主线前置，产品配网/STATE/媒体流/保存/V3后置。
