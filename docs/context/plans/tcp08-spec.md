# TCP-08 Spec（2026-11-05，实施前）

已读取规则/当前摘要/TCP07实际代码及终端最新station bootstrap报告/接口。终端已实现RAM一次配置、STA初始化/重试/清理和owner关闭确认；尚无真实配置提供者/真机网络。不得重复固件实现；station静态DRAM+35616B及IRAM+26700B非动态准入。

本片实现独立LAN transport窗口，不放宽TCP05/07 offline批准。新opaque profile需要可信本地独立decision，闭合版本/用途/审批引用、N_boot/source manifest/raw index/四恢复对象、mapping及PC来源审阅引用；重算recipe并精确匹配。引用只表示调用方独立决定，不是本模块自动授真实素材版权/设备库存或密码学认证。本轮只构造原创MIT合成决定；真实来源/用途仍待可信提供者。

prepare无网络/文件/接口枚举，仅校验闭合字段、IPv4/记录/摘要与期限。profile固定单interface名/地址/peer，端口仅0；lan-window禁止loopback，loopback-rehearsal必须双127.0.0.1且显式区分用途。配置不持久化，不进公共snapshot/sourceKey正文，不接CLI/网页。旧opaque offline option/字符串改名不能成为新profile。

profile期限从prepare时单调clock计，最大120秒；一次claim，不能重复owner/重启续期；倒时钟、到期、接口缺失/歧义/枚举失败永久失效。绑定前及tick/accept/base/reapply等核窗口；即使未连接或pause也到期关listener。接口来自os.networkInterfaces，测试可注入可信枚举；仅排练真实bind127/port0，LAN地址分支只做纯预检/拒绝验证，不执行LAN监听。IP/摘要不是认证。

复用TCP02队列/session/TCP06 peer/link：新createNative400LanOwner(profile)工厂拿内部配置，start显式enabled，选择profile精确地址，拒绝调用方换地址/固定端口。network初始down，可信epoch仍必须显式up；新会话不重放旧BASE/不续原TTL。默认owner/TCP05/07行为保持，不把LAN profile接到旧service tcpReview槽；其真实用途/赢家装配/产品配置入口后续专用模式完成，不能自动启服务。

测试：closed decision/身份域与四对象、用途、clone/一次claim/绝对期限/时钟/接口失效；实际loopback排练准入、到期/paused/等待连接实际退出、地址覆盖拒绝、旧入口仍限loopback；完整性/首帧仍沿v0 unknown。先专项再单套check/npm test含build。清理自有资源，不接ESP/STA、真实LAN或固件脚本，不改现有服务/DSH/素材，不提交推送。

回退close并等socket/timer/listener退出，丢弃一次profile；不得复活旧profile。无持久配置/分区迁移，不自动切旧TLS。下一真实用途/来源核定和新LAN专用单实例服务/配置提供者，再按既有步骤资源/设备窗口；不宣称本片完成R0或生产准入。

实施状态：独立profile/owner及13专项已完成；真实LAN仅预检，R0真实批准与专用宿主未完成。检查/构建与最终全套见[报告](../../reports/2026-11-05-tcp08.md)，旧入口见[归档](../history/tcp08-evolution.md)。
