# TCP-08：独立、限时LAN transport窗口

2026-11-05。[Spec](../context/plans/tcp08-spec.md)/[Diff](../context/plans/tcp08-diff.md)/[报告](../reports/2026-11-05-tcp08.md)。代码具备独立LAN监听分支，本轮仅真实loopback排练，未执行LAN bind/STA/ESP。

后续[TCP09](native400-tcp-lan-host.md)已完成专用UDS赢家装配与只读状态；本页TCP08阶段“尚未接专用宿主”为当时边界。真实来源/用途与管理端可信配置装配仍缺；终端USB临时RAM提供者已在本轮收尾新交接中完成，未真实apply，详见TCP09。

## 与旧offline模式分离

`prepareNative400LanProfile`需要可信本地**新的**独立window decision；不接受TCP05/07 opaque option，不修改它们的usage、默认监听限制或用途。新profile不接原service tcpReview槽，也无UI/CLI/配置文件加载器或自动启动。真实单实例LAN装配仍需后续专用模式，不可因有此工厂绕开原赢家所有权。

输入identity闭合N_boot/source manifest/raw index/四记录(action/bytes/frames/F)，固定0/1/4/11与241帧，slot容量≤5865472B；重算原v0 recipe对decision.mapping_sha256。字段类型/整数/摘要严格核对，N_offline/P/M不替代N_boot，原始index分域保持。

decision闭合schema_version=1、profile=native400-tcp-lan-window/1、usage、mapping_sha256、source_review_sha256、approval_id、material_approval_id、license_ref、credits、integrity_policy=file-sha-metadata-frame0-crc、presentation_policy=first-frame-history-only。这里的批准/来源SHA是**可信调用方独立决定的引用**：本函数不读取许可证/素材/缓存、不判断法律权利、不证明设备库存/文件内容，也不会自行发放真实素材许可。本轮仅提供原创MIT合成引用。真正R0可信来源/用途核定仍未完成，不把引用校验写成真实素材获准。

endpoint闭合interface_name/listen_address/peer_address；数字IPv4、单接口/单peer、端口仅0。usage=loopback-rehearsal必须双127.0.0.1；usage=single-device-cached-control禁止loopback和自身peer。禁止DNS/通配/端口字符串/组播；这是路由准入，不是认证。端点仅RAM，不写公共状态/Git或生成设备配置。

## 窗口与owner

prepare不枚举接口或做I/O；只读可信单调clock，windowMs为1–120000，自prepare起计，审阅等待/暂停/重连均不续期。返回WeakMap opaque profile，clone/JSON无法恢复。一个profile仅能分配一个owner、claim一次；关闭/到期/倒时钟/接口失效永久作废，不能重启旧窗口。

`createNative400LanOwner(profile)`复用TCP02 owner，显式start({enabled:true})才绑定profile精确地址；调用方覆盖host或固定port拒绝。绑定时/计时tick/accept/每条入站record/操作前检查窗口；即使没有设备或处于pause也会关闭listener。每条入站记录在model.receive/OPEN前核窗口，避免计时器尚未触发时处理过期HELLO。关闭需await原owner.close确认实际socket/session/timer/listener退出，非仅看逻辑closed。

系统接口来自os.networkInterfaces：指定接口下必须恰好一条匹配IPv4、对应internal属性的地址；缺失/歧义/枚举错误永久失效。测试可注入可信接口快照，不能从页面或网络指定枚举函数。窗口检查是宿主进程内门禁，非CPU阻塞下的硬实时保证，也不是路由/ARP/设备认证。当前没有新增OS接口事件watcher；TCP06可信networkLink初始down且仍必须显式发布，快down-up与旧事件规则不变。

旧createNative400TcpOwner无新profile时仍仅127/port0。旧TCP05/07仍offline-loopback，新LAN profile不能进入旧绑定WeakMap。没有改会话、控制队列/TTL或v0显示语义：accepted/SHA/首帧分开，verified null/current_display unknown，无saved/实时playing成功。host窗口关闭不停止设备STA；设备必须由可信本地提供者调用stop并等cleanup_complete，不能当远程已退出。

## 已读终端新事实

终端station bootstrap完成：RAM一次配置→boot/arm→worker-ready→资源→STA逐步初始化，30秒只限制boot/model等待，连接失败至少10秒间隔重试。stop等owner成功关闭确认，再清理自有STA；cleanup_complete独立于历史Failed，仍不代表全局tcpip内存回到初始态。

default c95f…606752B、owner ef3684…717632B、station f8e0…1208480B均仅构建未部署，设备仍f553。182工具/宿主sanitizer/原owner loopback与三构建为上游报告，本轮未运行固件脚本或ESP构建。station DRAM较默认+35616B、IRAM text另+26700B，PSRAM4439288B；静态余量不保证实际Wi-Fi堆/栈/PHY全校准时延。station独立SDK禁Wi-Fi/PHY持久化并拒绝固定12项NVS表入口，真实无线/NVS计数仍待设备验证。不能沿用前Relay+15216B作为station总预算。

## 验证、剩余与回退

13专项：独立scope与身份域、类型/整数、端点、无I/O准备、opaque/一次分配、真实LAN分支纯预检（注入合成192.0.2.x，不创建socket）、真实loopback排练、等待/暂停到期退出、接口失效/时钟倒退、地址覆盖和旧入口拒绝、过期HELLO不发OPEN。C++/ESP/实际LAN未执行，未读取真实素材/cache或发放真实用途批准。check/build/全套见报告。

剩余：R0真实身份/用途与新profile的可信生产者，LAN专用单实例服务及接口/STA产品调用者，真实资源短窗与回退材料。所有值须另行明确，不能从本合成示例推导设备配置；真实操作需相应授权。丰富STATE/媒体流/保存/V3仍后置。

回退await close→丢弃一次窗口→清理自有临时根；无持久/分区/外部服务配置迁移，旧offline服务保持。真实设备恢复由固件任务按既有成套镜像与缓存方案执行，本轮不动作。
