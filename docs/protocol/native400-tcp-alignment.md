# TCP-01：缓存控制共同对齐候选（2026-11-04）

后续基线（2026-11-05）：端侧默认OFF Bridge已接worker/SHA/CRC/View/EOF，新默认f2cf/adapter9dc均未部署，板上仍f553；见[TCP04实际接口/共同待定](native400-bridge-event-alignment.md)。下面TCP01的版本与独立object描述保留为当时快照，不作为最新缺口。
端侧起点：round-pet400-tcp-control-draft / v0；本仓库[Spec](../context/plans/tcp01-spec.md)/[Diff](../context/plans/tcp01-diff.md)、[原7向量](vectors/native400-tcp-draft-v0.json)、[只读来源SHA](vectors/native400-tcp-source-sha.json)。双方尚未共同冻结协议；本片不修改端侧，不新增真实设备入口。

## 事实与路径

TCP01当时端侧矩阵/报告：板上f5538cb9，用户已确认持续播放/触摸返回/画面；源码默认demand/damage/poll/quiet，新a74f2051未上板。400²在466屏(33,33)，三RGB播放窗口＋1MiB压缩环，需求预热/并行供数/欠载恢复及CRC/SHA保持。四缓存0/4/1/11，无运行期400持久写；首段23.944561fps、连续23.743082fps、暖切103.823ms，严格400@24未验收。旧6882与四前缀旧预算只属历史，不能推断当前余量。草案独立宿主/object通过，未链接日常应用，无真实TCP。

| 模块 | 处理 |
| --- | --- |
| pet来源/业务语义、素材目录/批准/P/M/N、流式仓库与校验器、UI权限/IPC | 保留复用；不重新制作compact78 |
| Native400Schedule | 新端侧oracle复用latest-base/local优先；连接/request/token由TCP adapter隔离 |
| 旧HTTPS/mTLS guard、JSON request/response、HTTP Range/read许可、双遍whole-media调度 | 保留旧离线候选/回退，设备新路径不以其作为前置或默认 |
| 新控制 | PTC1固定32B头、256B payload上限、LE/u64字符串/CRC；独立parser/TX cursor/会话及缓存动作adapter |
| 新承载 | 显式借入socket的runtime adapter；不监听/发现/自动连接，不接现有生产service或DSH写路由 |
| 素材后续流 | 同一明文TCP方向，DATA/credit/公平性另议，当前不发送素材或持久保存 |

管理端设备主线改明文TCP；broker/native选源/额外TLS评审为独立后续成果，不再阻塞缓存动作控制。管理页面HTTP/DSH/IPC自身的身份与生命周期要求保持，不接受设备nonce/controller ID/SHA为密码学认证。

## 实现/API与不变量

core/native400-tcp：7种固定长度记录严格封装，CRC=IEEE(header0..27+payload)；u64不转Number。Parser最多288B、sticky失败，不扫描magic重同步；EOF半记录拒绝；Tx复制单记录，0/短写保持偏移，忙时不得插包。

core/native400-tcp-control：TcpHubControl显式mapping/恢复四对象/会话/controller/单调clock，connect代数先隔离旧callback，HELLO验证boot/mapping与400/24/4/10000/256能力，OPEN seq1。仅remote0/1/11；单在途+单latest，PING在接近会话期限时优先于未发base，ACK超时关闭，不自动重放或延TTL。TCP-01核心仍由调用方驱动tick；[TCP-02临时owner](native400-tcp-owner.md)已装配定时驱动/入站重连策略，限显式loopback测试，尚不是生产LAN服务。BASE期限管理端保守从发送前时间计算，不以迟到ACK续期。满u64拒绝，host逻辑clock仅支持安全整数毫秒。

TcpDeviceModel是纯宿主端侧oracle，复用Schedule；实际连接、session、全请求字节去重/最近ACK有界、触摸优先与remote最新base、旧close/touch/token/source先拒绝再读clock。prepare只供宿主模拟worker使用，匹配完整asset SHA；presented另需同token/source/frame0。它不是固件或真实SHA执行器，测试里传入摘要不构成真实校验证据。

runtime/native400-tcp：native400TcpMapping准确recipe排序hash；native400TcpCatalog把既有已验证metadata与明确恢复对象匹配后转换，不从文件存在推断库存。namespace/source manifest/raw index/各asset SHA与bytes/frames明确分域，不把mapping当P/M/N。完整78与role8 raw index不同必得不同mapping。网络不能自批准或更换mapping。

attachNative400Tcp只借调用方提供的socket；有界单record write callback序列化，错误/EOF/close先失效同代控制并destroy。TCP-01模型超时由调用方tick触发；TCP-02另补临时owner驱动。无自动ESP拨号、生产端口配置或UI控制入口。测试只自有loopback server，连接结束清理。UI可复用现有管理能力，但本片没有给DSH设置页增加真实设备按钮或装配全局服务。

## 状态/完整性与共同待定

| 内容 | 一致/差异及门禁 |
| --- | --- |
| HELLO/OPEN/BASE/CANCEL/PING/ACK/PRESENTED | 原7消息type/长度/字段/CRC原样，Node/C++字节一致；seq拒绝/最后请求重放不续期沿端侧 |
| desired与accepted | hub本地目标与ACK独立；发送成功不是受理，受理不是显示 |
| verified | v0没有独立SHA完成报告；管理端保持null/device-SHA-not-separately-reported，不借ACK或模拟prepare填verified |
| 首帧 | 只接当前连接/session/base seq、非零token/source、frame0/action且未失效的PRESENTED；记录last_frame0独立历史观察，不认定持续current_display |
| 延后触摸 | Deferred token0；触摸结束设备才产生token，符合当前seq/action的PRESENTED可绑定新token。v0无STATE，hub不能获知全部触摸抢占/结束或持续actual，current_display保持unknown |
| whole-media | hub现verifyNative400Asset可全帧decode/CRC/index/RGB SHA；端侧要求prepare前全文件SHA+metadata/frame0 CRC，播放中逐帧CRC。两者不等价。本地缓存控制可候选采用后者，但须双方明确；不宣称whole-media已由端侧执行，不放行未缓存渐进播放 |
| proposed STATE/VERIFIED/EXIT/ERROR | 最小补足当前实际origin/action、touch token/source、base seq/TTL余量、完整性等级，以及失败原因/是否保front；都须关联session/request/token/source。尚未分配新type/字节或谈成协商，不会偷偷改变draft-v0 |
| controller选择 | 端侧本地指定LAN端点；controller ID与boot只是路由/去重，不是认证。宿主不调用旧TLS凭据guard来假认证 |

正式控制窗口前：共同确认mapping实际命名域与独立恢复来源、whole-media差异、STATE/退出错误/校验等级，将已实现worker/View内部回执映射到wire、核对v0回调Core草稿并完成真实单socket owner与LAN资源短测。当前宿主不产生设备playing/saved/offline_available；长测、保存/掉电、400-L、V3后置。

## 回退

停止调用新候选→close自有socket/loopback server→丢TX残包/在途/最新意图并使旧代回执无效，最后观察只作历史。无运行配置/分区/缓存迁移，不自动启用旧TLS设备链路。旧review、管理页面权限和旧400/正式360成套回退保留；真实固件回退由终端任务另行授权执行。
