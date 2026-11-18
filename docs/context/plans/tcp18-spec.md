# TCP-18 Spec：来源绑定的手动控制通道与共享界面（实施前，2026-11-05）

先读规则/当前摘要/TCP17、原source-review channel/IPC/HTTP/React和真实audit/request。保持纯Node，Python外部工具非前置。终端f553恢复/播放触摸已确认，当前流畅度已接受；本片只原创临时来源、UDS/HTTP/loopback，无真实LAN/ESP/服务或profile修改。

## 装配与来源

复用TCP12真实完成audit＋独立materialReview/windowDecision，新增内部request控制上下文：只能真实request取得其lanReview及原closed/audit live检查，不调用deviceConfig、不消费USB交接。增加合法loopback-rehearsal分支，仅materialReview.source_kind=original-test可用；其输入仍完整读原fixture元数据/28MiB cache/四payload并核SHA，不跳过audit。真实reviewed-upstream仍只single-device-cached-control，原设备配置handoff继续只允许真实LAN，loopback不能导出Wi-Fi配置。

prepareNative400NodeControlAccess({request,sessionMs?,clock?,timers?})默认仅程序化准备，返回opaque；descriptor绑定精确request.lanReview、来源与session策略，进入service sourceKey，防止只读服务被附着升级。nodeControl只能与匹配lanReview组合。UDS赢家在已有owner上创建一个控制channel，attached没有issuer；TCP17可选controlAccess传入该option，默认行为不变。loopback与真实来源/窗口都沿同一绑定机制，真实LAN成功仍未执行。

## 操作与权限

独立会话凭据在服务/宿主内存，复用原createNative400ReviewClient的Bearer/实例/X-Hub-Review封装；凭据不进descriptor、全局status、DOM或URL。只本地赢家authorize/revoke/controlClient，页面没有authorize/路径/批准/配网/网络up/reapply入口。

新增仅显式nodeControl模式的GET /v1/node-control/controls、POST /v1/node-control/command。POST闭合body为protocol/service_instance_id/control_session_id/request_seq/request_id/expected_revision/operation，以及base的action/ttl_ms；只base0/1/11及cancel。uint64十进制串，严格顺序与revision，最近一次完整body重放只返回原submitted ACK，不调用base、不刷新TTL；同seq异内容、过期/旧会话/旧实例/缺口拒绝。ACK明确仅本地提交，非设备accepted/完整SHA/首帧。

每次操作及定时检查原来源/audit/window仍有效。来源失效永久fence该channel与TCP owner，不留旧意图继续受控；会话到期/显式revoke或rotate取消该会话目标，不续期或重放。撤销/页面卸载与设备停止不同：页面unmount只撤本HTTP/timer；可信宿主负责显式revoke，service关闭负责所有channel timer与实际owner退出。未知结果不自动重试；会话结束后无法用旧请求确认新目标。

## 界面与代理

扩展原createHostPlugin的可选controlAccess resolver，复用精确Host/Origin/JSON/X-Pet-Hub/Sec-Fetch-Site和4KiB/2.5秒body门禁、unload abort及safe errors；默认无provider仍404。不另起HTTP服务器/权限系统；UDS仍核Bearer/实例，新增路由仍核独立scope token。

新增core请求/白名单view与共享React手动组件，装入现有panel/client/bundle：只0/1/11和取消；私有实例/session/seq/revision留组件closure。只读轮询，迟到generation/换会话不提交旧结果；不确定ACK保留原body，手动确认同一请求，不自动再发或生成新操作。展示本地提交与首帧历史分开，verified=null/current_display=unknown/device_evidence=false。不能将模型PRESENTED写成ESP已播放。

## 验证与回退

原创fixture真实audit→独立决定→request→opaque controls→TCP17→Bearer/私有IPC→Host/Origin代理→组件hook→真实loopback虚拟设备。覆盖默认拒绝/只读附着/配置隔离、scope与来源失效、动作与独立模拟首帧/取消、重复不续TTL、旧实例/session/revision、网络/窗口到期、授权/Origin/坏JSON/预算、UI不确定及卸载实际退出。共享React hook与构建候选验证，不冒称DSH已安装/用户身份/native picker或浏览器真机。

先专项/独立CLI，npm run check与npm test含build，最终build；按新失败再复验。更新当前摘要/G0并归档替代记录。回退可信revoke→卸载proxy/UI→await窗口close与audit/request关闭；不抢UDS、不重发未知配置。默认无controlAccess/nodeControl即旧只读，无Python/USB、真实设备/生产listener、插件安装/启用或配置变更；不提交推送。STATE/流式/保存/BLE仍后置。

实施状态：25专项/隔离CLI、修复后新旧定向61项、最终check及含build全量1755/1755、最终build通过。初次全量1项原同步关闭回归已修复，未放宽断言；退出能力捕获补负例。仅原创来源/组件hook与真实loopback，浏览器/DSH授权provider/ESP仍待。见[报告](../../reports/2026-11-05-tcp18.md)。
