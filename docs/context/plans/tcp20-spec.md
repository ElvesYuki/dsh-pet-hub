# TCP-20 Spec：Connection 承载候选与独立浏览器共享会话

2026-11-05，实施前。用户同意TCP19后续入口。先读规则/摘要/实际代码及安装ASAR，当前DSH/Connection为0.2.1-rc.5；旧候选peer与动态宿主加载仅rc.3。本轮不安装/启用插件或启动DSH/profile，不将接口静态核对或注入Connection模型称为实际DSH登录身份验证。设备/固件/现有服务保持不动，无子智能体。

## 问题与实施边界

raw webServer路由不自动admit，Desktop转发删除Origin，现严格raw POST仍应拒绝缺Origin。复用公开`connection.fetch.register`精确/api路由，真实上游先admit，再限制owner principal后调用route.fetch(Request)。Fetch回调无Peer参数；它只证明宿主owner准入，不区分自然人/页面。synthetic request.url为dsh.internal，不能按该URL猜实际Origin或解析DSH cookie/secret。

新默认OFF `createDshNodeControlConnection({enabled=false,resolve})`为可信本地装配工厂，仅注册GET /api/pet-hub-node/controls与POST /api/pet-hub-node/command。resolve(Request,{signal})由可信宿主绑定到已经独立批准的TCP19 scoped client；Connection owner准入本身不发hub许可。没有authorize、批准、路径、token或配网HTTP接口。上游负责Host/Origin/owner认证，本仓库仍保闭合业务schema、实例、逻辑组、CAS/seq、TTL和严格IPC。raw代理保持原门禁，不接受缺Origin。

GET使用buffered模式以适配上游GET不能带body；POST必须`requestBody:'streaming'`，避免上游默认300MiB缓冲先于hub 4KiB限制。POST application/json及X-Pet-Hub=1严格校验；读体4KiB、2500ms整体期限，拒绝query/错方法/坏JSON/UTF8/超限与中断。卸载立即移除路由、abort自有请求，旧resolve晚到不能调用scoped.request；已提交但失去响应仍unknown，不伪装取消设备。返回经过现有core白名单与小响应上限，不泄露底层错误/凭据。页面/路由卸载不撤后台组，trusted owner另end/revoke。

共享UI与业务核心不复制。client factory增加闭合raw/connection策略，原client.js保持raw缺省；build另产显式client.connection.js候选供下一版本宿主准入。两个bundle不可同时加载，不放宽旧rc.3 peer或自动切正式入口。新增服务端adapter随候选复制，默认apply不注册它。

## 验证方案与回退（执行前）

仅原创MIT临时metadata/28MiB cache/four payload SHA audit、独立来源窗口、原Node共享组和真实UDS/HTTP/loopback。复用TCP18/19 fixture，不伪造audit。注入遵照rc.5合同的Connection测试carrier，测试用独立HttpOnly/SameSite cookie模拟宿主身份，另有可信stdin发放的独立hub页面权限。明确这是原创认证fixture，不是DSH cookie/账号或真实profile。多个cookie上下文可独立授权；同cookie的标签页可能共享权限，不能声称自然人或每tab隔离。

宿主专项覆盖默认OFF、精确streaming注册、双层准入、4KiB/JSON/header/query、慢体/abort、晚resolver/卸载、实例/组/CAS、同body去重、页面卸载不取消、授权到期/重领、来源失效与收尾。独立浏览器用实际构建bundle和固定本地React18.3.1种子，不执行旧rc.3提取器。验证只读、真实点击/取消、两页面共享、刷新/权限重领、丢ACK明确确认不重发、新HELLO剩余TTL、卸载/重挂和撤销；仅模型首帧历史，不造设备播放。Playwright CLI无离线缓存时用已连接浏览器工具，不安装CLI/浏览器/依赖。

先check/专项/隔离CLI，浏览器自有context与临时窗口，最后本仓库npm test含build及最终build。仅临时loopback监听，不碰生产listener。浏览器关闭自己创建的页/context；harness stdin close/EOF释放自有HTTP/IPC/peer/窗口/request/audit及临时目录，unknown保现场不抢锁。原profile/安装只读。关闭adapter回只读；省略新client策略回原raw bundle；无持久格式或运行配置迁移。

## 验收与后续

本轮完成候选代码、安装接口证据与真实浏览器DOM；正式DSH rc.5动态加载/重载/卸载与Desktop自定义scheme仍待另行授权隔离profile安装验证，不能因本轮通过扩大兼容声明。120秒来源窗口及命令TTL不延长，不做跨崩溃持久会话、真实LAN/ESP/媒体流/保存/V3。更新当前摘要/共同G0并归档被替代“尚无浏览器共享会话验证”记录。

实施状态（2026-11-05）：本片已完成。20专项/隔离CLI、真实浏览器B01–B09、check与含build全量1804/1804通过，最终build通过；第一次错误状态映射及旧页脚已修复，断言保持。实际DSH rc.5动态认证/profile/自定义scheme与ESP仍待，不扩大rc.3 peer。[报告](../../reports/2026-11-05-tcp20.md)。
