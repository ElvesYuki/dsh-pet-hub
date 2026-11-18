# 400-15：可信provider、原生选源及DSH承载评审

2026-11-03。[Spec](../context/plans/native400-15-spec.md)/[Diff](../context/plans/native400-15-diff.md)、[报告](../reports/2026-11-03-native400-15.md)、[闭合证据与安装代码SHA](vectors/native400-15-provider-v1.json)。本片只读DSH安装产物和本仓库文件，执行原创临时浏览器验证；未读现有profile凭据/运行日志、pet、桥接、固件、真实cache/素材。没有启动DSH/Electron、打开OS dialog、安装启用插件或接设备。

## 新鲜安装事实与兼容范围

当前安装包与desktop-host等相关包为 **0.2.1-rc.5**；2026-10-29的真实P1加载/重载/卸载仅验证rc.3。候选manifest仍固定host-webserver rc.3及React18.3.1，本片不放宽peer、不推导rc.5兼容。安装代码路径均相对于app.asar，完整SHA见证据，下面是源代码静态核对，不能称rc.5动态集成验收。

| 实际入口 | 核对结论 | 对hub的决定 |
| --- | --- | --- |
| host-webserver `WebServer`命名路由匹配/handler | 直接调用注册handler；不自动执行Connection的身份准入 | 当前raw prefix不继承宿主认证，保持14显式reviewAccess；不得因同源/能进设置槽就授写权限 |
| client-connection `requestRejection(req)` / `admit(req)` | 核Host/Origin、已处置状态、签名browser cookie或存活API peer；browser请求共享owner Peer | 可作为额外宿主准入候选，不是每页/每人/每次审阅的许可；不自行解析DSH cookie或获取内部secret |
| `connection.rpc.handle` / `connection.fetch.register` | 注册生命周期随owner effect释放；RPC入站先admit，Fetch exact route限owner principal | 后续适配优先用公开Connection通道，复用hub现有控制器/私有IPC；完整参数、取消/4KiB与实例绑定另验 |
| `dsh-authorization` | 凭据获取flow registry，执行流程并提交credential record | 不是当前HTTP来访者身份或文件用途授权；hub不为审阅注册登录flow/读取模型凭据 |
| Desktop `__DSH_DIRECTORY_PICKER__.pick()` | main持有窗口/主frame与dsh-app://app来源校验；单pending；只openDirectory/createDirectory，返回路径或null | 不是单文件picker，也不是给插件的可信选源回执；不能从返回目录自动扫描/猜cache |
| Desktop `__DSH_HOST_PATHS__.pathFor(file)` | preload用webUtils取得File宿主路径，再把字符串返回页面 | 页面转发的路径可被页面脚本替换，不能证明“此路径已由OS确认”；不接任意路径POST |
| Desktop `forwardWebRequest` | 检查来访Origin（若有须dsh-app://app），删Host/Origin/Cookie/Fetch-Site，再注入宿主cookie并转发；WS另有独立重写 | 14严格要求POST精确Origin，因此该raw写路由不会直接适配Desktop；保持拒绝，另用经Connection准入的适配方案，不能随意接受缺Origin |

`lib/main.js`的来源校验、目录picker约7016–7045行；HTTP转发约8268–8300行；协议挂载约12406行。`lib/preload-app.cjs`约861行暴露目录picker与hostPaths。`dsh-client-connection/lib/index.js`约727–749行是公开registry/准入，约855行注册RPC；同文件BrowserAuth内部authenticate不是本项目要直接调用的公开接缝。行号仅适用本次SHA，版本变化须重新核对。

真实用户概念必须限定：当前Connection证明的是宿主认可的owner/API peer；不证明云账号登录身份、唯一自然人或当前原生文档。共享browser Peer不能代替hub的单次审阅会话，也不能从全局status生成授权。

## 交接决定与状态机（设计，未生产装配）

推荐可信本地broker直接拥有选源结果，与既有UDS owner交接；共享网页只消费14已授权引用。broker应为独立桌面入口/辅助进程或宿主明确支持的可信native服务，不从网页全局变量回传路径便认定可信。仍保独立core/runtime/UI/DSH入口结构。

1. 默认只读。请求必须先过宿主实际承载的身份检查；身份不可用、过期、重载/卸载或实例不符拒绝，不默认为本地owner。
2. 可信本地一侧显示明确的“仅离线审阅此文件/用途”操作，取得独立源与映射批准的固定摘要；取消选择不授权、不扫描目录。OS确认仅代表选择，不代表内容完整性、素材许可或设备安装批准。
3. 单次文件选择结果由broker内部回调直接交给既有owner `reviewChannel.authorize/choose`，路径/FD不经HTTP/DOM，12的metadata捕获和reader首读前绑定继续生效。只允许单个常规私有文件，不复用目录picker的任意子路径。
4. broker把当前实例的scoped IPC client绑定到被确认的宿主/页面授权上下文，页面只获私有选择引用，凭据不入URL/DOM/日志/descriptor。选择引用不产生新权力、不续期，仍受原session/selection/job期限。
5. 操作走14既有start/cancel与同body ACK去重。broker撤销、授权到期或自己关闭必须失效所授会话；页面HTTP中断/卸载不能冒充可信撤销。重选要CAS revision，旧picker晚结果须核实例/授权代数并丢弃，不能给新session补选择。
6. 撤销/到期即同步fence，实际I/O退出后再允许新授权/选择。picker本身也要单pending、有限期限、取消/late-result释放；未选完窗口关闭返回取消，不发grant。
7. unknown只可信close→新实例读取历史→新身份/批准/选择/复验。UI不能clear-lock/reopen或把保存记录视为本次有效。回只读使用原prepare新实例，无格式/配置迁移。

本片没有实现这个正式broker，也没有将真实OS用户/进程/窗口权限映射为生产credential。复用13/14，不另造身份库/reader/journal。系统签名/权限与Keychain等仍是后续实际运行边界。

## 实际浏览器结果与证据等级

本片新增的harness仅在tests/fixtures及scripts中：原创MIT sparse28MiB、临时私有UDS、动态127.0.0.1 proxy；使用既有dist client、原14 proxy/channel/controller/reader/journal。privileged测试指令只走本次进程stdin，浏览器没有authorize/choose/reopen/approve/file路径。CLI串行处理指令，EOF/close清理自己的资源和私有browser-state。

真实浏览器为独立Playwright context（UA报告Chrome156），React/ReactDOM为先前本地准备的固定18.3.1种子，SHA42132116…；不把该种子当rc.5 frontend/React实测，未重新执行rc.3专用提取器。种子、截图、原始网络日志只在忽略目录，不入Git，无CDN/依赖/浏览器安装。

可信测试侧显式发临时页cookie，HttpOnly/SameSite=Strict，server绑定scoped client；浏览器未从页面/URL自授权。已实际点击审阅/复验、取消等真实I/O、503抑制ACK后原请求确认；刷新读数/请求数保持、proxy卸载移除操作/owner存活、重挂恢复、unknown阻塞/历史重开/新会话显式复验均验。真实浏览器cookie/DOM结果不等于正式DSH身份与原生picker。

初期TCP断开试验中浏览器可在连接层重试，不能靠“点一次=发一次”判断去重；仍由13同body ACK去重兜底。确定性的503是在原操作实际受理后抑制ACK，用来验UI手动确认，未伪造成功结果。选择60秒/会话300秒照旧，多次操作准备过程中实际过期会拒绝；不为测试延长，可信重开后再验证。

## 下一可独立验证切片与门禁

**400-16：可信本地broker的默认OFF交接适配器。** 先Spec/Diff，限定可信调用端、固定实例/单会话/单picker、独立批准摘要、晚结果/撤销/到期/unknown与真实I/O退出；复用14 private channel。可先注入身份/picker回调离线验证，必须明确它不是OS窗口或DSH身份验收，不再重复浏览器基本按钮或reader/journal。

实际DSH写接入另依赖rc.5的Config/React/slots/Connection承载兼容验证、明确的owner与页上下文绑定及原生选源服务。若选择Connection通道，需独立profile验证加载/重载/卸载、HTTP/自定义scheme语义、错误/取消与body上界；不得以去掉Origin检查来让旧代理“通过”。候选peer/manifest只在对应版本实测后调整，不能仅凭源码方法存在。

真实OS文件选择、窗口所属/主frame校验、进程退出/系统休眠/签名、DSH完整profile和生产启用都未完成。本任务不自动执行这些窗口；固件/真实用途/G0/N_boot/Flash writer/proof/TLS时间凭据/G1-G2/24fps仍另审，外部沿400-06快照。

## 真实集成的具体方案与回退（准备，未执行）

1. 先固定待验rc.5安装SHA和候选manifest，记录原profile顶层文件摘要，不保存原配置正文/令牌；仅新临时DSH_HOME/profile和新runtime，disabled来源、无pet/bridge/遥测、无登录或模型任务。
2. 通过受信Connection/native provider的已审接缝装配候选，验证未授权默认只读、显式用户选源/取消、晚结果/换主/撤销、未知结果恢复；设备通道始终关闭。独立Web与Electron自定义scheme分开验，不复用现有desktop窗口。
3. 候选停用/重载/卸载只改新profile，核对操作面板/路由移除和共享owner生命期，确认页面卸载不取消共享任务、可信provider退出会撤授权。
4. 先撤自己发放的授权/取消picker/退出I/O，再停自有宿主/owner、删自有cookie与临时输入；保需核定的journal历史/坏档/残锁，不迁移或修复原目录。只停止自己创建的PID，不按名称/端口杀服务；核对原profile摘要保持，失败退回无provider只读，不扩权限。

上述真实宿主/native步骤是后续执行方案，不是本轮已运行项或自动安装授权。
