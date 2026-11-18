# TCP-20：DSH Connection 控制候选

2026-11-05。[Spec](../context/plans/tcp20-spec.md)/[Diff](../context/plans/tcp20-diff.md)/[报告](../reports/2026-11-05-tcp20.md)。已实现默认关闭的适配工厂，并完成原创合同carrier和独立浏览器验证；未安装到DSH或验证其真实身份/自定义scheme。

## 已安装接口与可信边界

只读重核DSH和`@deepseek-ai/dsh-client-connection`为0.2.1-rc.5，5份选定JS/manifest前后SHA一致，见[证据](vectors/native400-tcp20-results.json)。安装manifest声明的types文件未在选定ASAR路径提供，本次按实际JS核对，没有伪造类型兼容证明。原候选peer/动态宿主验收仍限rc.3，不放宽兼容声明。

公开`ctx.connection.fetch.register({path,methods,requestBody,fetch})`注册精确/api路由，生命周期归读取该service的Cordis context。上游/api carrier先admit核Host/Origin和live Peer，精确route进一步只允许owner principal；callback收到WHATWG Request，没有Peer参数。browser Peer共享，不能推导独立自然人/每tab权限。Request.url可能是`http://dsh.internal/...`，不能从它反推真实外部Origin。

旧raw webServer路由不自动admit，Desktop转发移除Origin等头，旧raw POST继续严格拒绝缺Origin。新增适配器仅放在已admit的Connection registry，不复用raw handler或修改其规则；不自行读取DSH cookie/secret、凭据库或登录flow。

## 显式宿主装配

可信代码从候选`./connection`入口取得`createDshNodeControlConnection({enabled=false,resolve})`，显式enabled=true后将返回的apply函数用于拥有connection service的context。resolve必须是可信本地提供者：先有独立来源/用途/窗口批准及[TCP19](native400-shared-control.md)页面凭据，再把相应scoped IPC client绑定到该Request。缺省不注册路由，resolve为空拒绝，宿主owner身份自身不发hub控制许可。工厂没有配置schema/CLI自动入口，也没有HTTP authorize、文件路径或设备配置接口。

| 路由 | 契约 |
| --- | --- |
| GET /api/pet-hub-node/controls | Connection requestBody=buffered；返回原私有envelope/可选shared，GET不恢复动作 |
| POST /api/pet-hub-node/command | requestBody=streaming；application/json、X-Pet-Hub=1；原闭合BASE0/1/11或cancel body |

精确method/path、无query，POST已声明及实际读体均限4096B；严格UTF8/JSON和原body schema，整体resolve/读体/IPC期限2500ms。POST不用上游默认300MiB buffered路径。GET采用buffered以避免上游给GET构造body；本片不修改上游全局carrier内存上限，不能将本适配器限额外推为所有DSH请求的预算。

请求/客户端断开/插件卸载/期限合并signal。卸载先mounted=false、abort自有请求并撤路由，晚resolve不能再提交；已开始IPC操作的响应丢失按unknown处理，不声称撤销设备。scoped client继续核实例/组/token、CAS、seq与完整请求幂等，旧凭据/源失效不被carrier绕过。响应走原白名单/小响应上限，底层路径/错误不透传。

## 共享页面与构建候选

client factory的nodeControlTransport只接受raw或connection。原client.js/正式apply默认raw/只读保持；新增`client.connection.js`是显式替代候选，使用相同React/slot/共享组件而只切控制路径。候选package新增`./connection-client`和`./connection`exports及对应files；默认DSH manifest仍加载原client，未自动启用新工厂。两个bundle不能同时加载，否则同一panel重复注册。

页面权限仍由本地宿主发放，不进DOM/URL。页面权限到期后由可信宿主重新领凭据，读取同一后台组；没有网页自助续权或无限后台窗口。新旧tab是否独立权限取决于可信provider的绑定；同cookie浏览器tab可能共享一个页面凭据，本片真实多页面独立权限采用两个隔离context，不冒称每tab天然独立。

卸载页面/Connection路由不停止共享后台或取消目标；可信owner另用end/revoke。进程重建、原来源窗口（最多120秒）、动作TTL及剩余TTL自动恢复保持TCP19边界；raw legacy模式继续原到期取消语义。提交ACK、恢复次数和模型PRESENTED均不能当ESP已播放，verified=null/current_display=unknown/device_evidence=false保持。

## 验证、未验与回退

专项：`node scripts/verify-native400-connection-controls.mjs --output .cache/tcp20/results.json`。浏览器harness：`node scripts/native400-connection-browser.mjs --react-seed <既有本地种子> --output .cache/tcp20/browser`，只接受进程stdin的grant a/b、connect/disconnect、advance、drop、frame、unload/reload、end、state、close。页面无admin路由。private-a/b.json仅本次原创fixture HttpOnly身份，mode600、结束删除；不使用现有DSH登录/配置。EOF与close释放自有资源。

本轮20项宿主/隔离CLI及真实浏览器DOM通过；独立HTTP/UDS/TCP和模型、注入Connection合同、实际DSH身份三者分账。真实浏览器使用既有18.3.1种子而非rc.5前端实测。正式rc.5隔离profile加载/重载/卸载、Desktop dsh-app承载及真实provider身份绑定仍待单独授权，不由本片自动安装或改profile。ESP/LAN/保存/媒体流/V3仍未接入。

回退：先卸载自有页面/路由、按意图可信end/revoke，再await自有窗口/request/audit实际退出；unknown保现场、不抢锁/重发。清理自有cookie/context及临时目录，下一次省略工厂/Connection bundle即原只读/raw路径。无配置/持久格式迁移，无固件、素材或生产服务改动。
