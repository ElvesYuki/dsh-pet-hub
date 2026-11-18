# TCP24 对端草案：最小触摸优先态轮询

状态：TCP25已按用户选择A，[endpoint-arbitrated合同](native400-endpoint-arbitrated-hold.md)替代此B查询前置；以下保留TCP24当时设计，未装配，不要求A使用autoRecover:false。

2026-11-06，**联合定版前的离线草案**，未接既有TCP parser/owner/生产入口，未发送新type到ESP。管理端实现payload codec/provider/fixture；终端实现、C++字节对拍、资源及真机另由终端任务完成。

## 产品决定与两种方案

| 方案 | 能保证的行为 | 与当前合同的关系 |
| --- | --- | --- |
| A：只靠端侧仲裁，host继续有限续租 | local触摸不被BASE抢占，结束回最新有效remote base | 模型已验；会自动恢复远程，改变TCP23检测本地后停止hold的政策。若产品明确选择该行为，可另审简化方案；不能以写死clear冒充可信状态 |
| B：有界轮询优先态，host sticky停止 | 检测本地/故障/未知后停hold并尽力撤自身目标，结束不自动恢复 | 本轮选择用于保持TCP23语义。无需完整事件流、当前画面或播放证明；只做最小快照和单调代数 |

端侧仲裁始终保留：clear快照后、BASE到达前仍可能发生touch。该在途BASE可以deferred，不能靠网络观察保证物理触摸瞬间零在途命令。检测到local后停止后续续租/撤自身目标；触摸结束回本地策略，重新控制需可信显式新bridge/provider或新授权事件流程，不自动清sticky latch。

## 能力和旧peer兼容

共同配置profile暂名`ptc1-priority-poll/1`；type编号待双方冻结。后续可信配置需显式wire_profile闭合枚举并纳入用途决定/选主sourceKey，不能附着旧实例升级；当前闭合RAM/USB配置尚无此字段，版本及承载位置由终端共同核定，本轮不扩旧配置或生成新设备配置。仍用PTC1原32B头、LE、原CRC算法、payload<=256，无TLS/认证语义。hello type128在**显式新profile**才为64B：原56B完整身份/400参数不变，能力尾部如下。

| offset | 类型 | 值 |
| ---: | --- | --- |
| 56 | u16 | priority schema=1 |
| 58 | u16 | snapshot payload bytes=32 |
| 60 | u16 | max queries per second=2 |
| 62 | u16 | reserved=0 |

原默认cached-control仍严格56B/seven types，不放宽长度、不接受新type。显式priority profile必须核64B能力及原boot/mapping/参数后才OPEN/查询；收到旧56B不能静默降级后开启hold。旧模式可以继续event/manual；priority保持unknown。默认旧parser也会拒绝扩展HELLO，升级必须双方明确选择，禁止对旧连接探发type5。

**网络priority profile必须用既有shared autoRecover:false。** 保持TCP19旧模式策略不变；新profile在断链/新OPEN后不得由后台恢复旧hold目标。新连接先unknown，等完整初始快照及可信重新取得控制，不把旧provider换成clear后复用已停bridge。现有factory已支持该策略，本轮没有改原owner恢复语义，也没有把新profile接入生产。

## 查询与32B快照

- Host QUERY暂定type5，body空；加入原control全局单调seq，和BASE/CANCEL/PING共用**单在途**，不自建并行控制队列。仅OPEN后可发。
- Device PRIORITY_SNAPSHOT暂定type131，header.session为当前会话，header.seq严格回显QUERY序号；只回一个snapshot，不再同时回ACK。无效序号/协议错误走既有拒绝/关闭，ACK不得被当snapshot。
- 状态发送/队列满不得阻塞本地touch/EOF，可关闭观察连接回unknown，计数仍由arbiter保留；必须在同一串行arbiter/worker视图取得快照，不能从旧Presented、单次Deferred、debug串口或最后显示帧猜状态；以下body与已有队列里的transport generation一起核定，旧连接结果不得进入新连接。

| body offset | 类型 | 语义 |
| ---: | --- | --- |
| 0 | u16 | schema=1 |
| 2 | u8 | mode：0 clear、1 local、2 fault |
| 3 | u8 | flags=0 |
| 4 | u64 | boot，非0，与HELLO一致 |
| 12 | u64 | local_epoch，每次**接纳新touch**递增，重复未接纳触摸不变 |
| 20 | u64 | priority state_revision，每次start/end/failure/恢复状态转换递增 |
| 28 | u32 | reserved=0 |

禁止C++ struct直接cast：有未对齐u64，须沿原put/get序列化。uint64无回绕；溢出失败关闭。epoch<=revision；local需epoch>0；local/fault需revision>0。计数不因BASE/PING/remote帧循环增加，也不能复用会随remote变化的intent token。端侧触摸结束/失败必须核既有当前touch stamp，旧EOF不能清新touch。

clear→local→clear即使两次查询间完整发生，epoch/revision仍变化，host能sticky停用，不需要积压BEGIN/END事件。Failure已关闭transport时直接断链unknown即可，不强求在坏链上补发failure；连接尚可时fault快照同样停止hold。该状态只表示仲裁优先态，不是accepted/SHA/首帧/current-playing/saved。

## 新鲜度、重放与竞态

候选参数：最小查询间隔500ms（最多2Hz）、单query响应期限250ms、最近成功查询年龄<1000ms。年龄从host查询开始计，保守扣除往返，无设备墙钟依赖。参数是待资源实测的候选，不能据loopback宣称最坏网络延迟上界。

初始unknown，只有匹配boot/session/本地connection对象/当前query seq的有效clear快照才clear。不同的新query可收到相同revision并刷新活性；旧/重复/乱序/错scope不刷新。当前scope坏payload/rollback/同revision异内容、超期或断链unknown；local/fault或任何priority revision/epoch变化都会latch，即便新快照已clear也不自动恢复。断链立即disconnect旧provider，旧回复/旧触摸结束不能影响新代。

QUERY低于CANCEL/PING等原关键调度；只能原控制槽空闲时发送。不以排队理由延目标TTL/快照年龄或塞无限query。请求超时必须清原在途/使该连接失效，不能留一个永远占位的query；provider为unknown并停止hold。断链后按上文no-auto-recovery规则，host来源/权限窗口不续期；设备继续独立触摸与本地策略。重新使用需新scope/快照/显式控制，旧目标过期绝不复活。

## 资源、实施分工与回退

每query32B头、每reply64B（32头+32体），2Hz合计应用字节192B/s，未含TCP/IP。HELLO增加8B。均小于原288B解析缓冲；设计不新增无界队列。端侧至少新增两个u64本地计数的16B逻辑状态；不含锁、Event对齐/缓冲/栈，**不是实测RAM上界**。终端须给实际布局/队列高水位/串行化成本/250ms期限可行性/栈与业务RAM、关闭和退化观察证据，保持原门禁。

管理端本轮已实现：`packages/core/native400-priority-draft.mjs` payload严格解析/向量；`packages/runtime/native400-priority-provider.mjs`无I/O、无timer、单pending/一个快照的连接绑定provider。收到已协商新连接的数据后才可由可信transport adapter调用receive，将priority函数交TCP23；当前没有任何正式网络接线或自动发权。17项离线/真实IPC模型验证见[报告](../reports/2026-11-06-tcp24.md)。

终端需实现/共同确认：profile选择、HELLO尾部、QUERY/响应、boot计数/仲裁原子快照、旧stamp拒绝、队列/资源及C++字节对拍。管理端下一再接新profile parser/owner和原单在途调度，核no-auto-recovery配置、断链hook与临时装配；共同确认前不能拿纯payload/provider当真机已支持。

回退：不装配新profile/provider即可保持旧七消息，priority unknown禁止设备hold；event/manual及终端原f553/400/360回退不变。临时profile退出仅清自己的进程/授权/目录；没有分区/cache/素材或生产服务迁移。
