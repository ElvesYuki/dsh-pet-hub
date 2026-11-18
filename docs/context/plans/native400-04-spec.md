# 400-04 默认关闭临时装配 Spec（实现前）

2026-11-02。读取AGENTS、当前README/index/system/todos、开发/维护规则、400-01/02/03、session/Registry/guard/MTLS与R4–R7、read lane/reader/writer/queue。仅原创媒体、临时存储/PKI、虚拟时钟和独立loopback TLS；无子智能体，不读写固件/真实媒体、不接设备/烧录/安装插件/生产listener/现有配置或服务、不提交推送，保留已有修改。

## 范围／复用

1. 新显式createNative400WireReview，默认disabled，不创建listener/定时轮询或生产入口。复用400-01严格导入/私有CAS/fd指纹reader、原session/guard/绑定权威/readView、A4 read lane/4KiB writer、PullControlQueue与R7实际退出原则。新400观察投影不能伪装成旧360 schema2或EMPTY库存；A3当前/历史/相关性/失败保留原则沿用，新字段独立投影，不扩旧A3 parser。
2. session/Registry目前固定旧能力，MTLS lease decoder也固定360 wrapper：增加仅调用方代码可注入的profile（三个同步校验/decoder函数），缺省原函数，不能从wire/IPC配置选择。400 profile严格校验schema3和目标，decode新lease wrapper交原TLS proof/guard；不重写认证/租约、不造schema1/2 RAM或旧lease字节。Registry/session/MTLS只改这几个信任依赖点；legacy测试回归。
3. 复用临时loopback client，仅显式新增review路径白名单；必要时返回原始响应头，保持旧请求默认路径/单socket/单HTTP/无重试。handler仅允许双端127.0.0.1、外部临时mTLS caller挂载，真实POST/GET/Range/If-Range/ETag及段字节关联。生产service/CLI/plugin入口不装配。

## 冻结行为

- 完整复用400-03 revision1/94正116反及400-02 verified-replay，不改合同/golden/cap，也不开放progressive或storage。hello challenge/confirm按boot/socket/context/版本/包/策略/递增request_seq逐项关联；错误/断线/暂停/过期清权威。原metadata坏档/撤销/证书日期逐次及每块readView继续失效关闭。
- 一HTTP／一pending控制／一latest／一ordinary及有界flags，继续用原queue；内部普通query.inventory槽显式映射为400 query.storage，返回unsupported/null，不产生旧inventory/root提交。新A8存储根不写、不从未知库存造EMPTY；绑定/凭据CAS继续原owner。
- 400-03未有客户端read-request字段。本临时recipe固定20页目录（每页4、末2）→第一遍文件→设备verified后从0重读。host只在GET真实成功退出后推进cursor，取消/故障不推进；不提供任意seek/断点续传/自动重试。permit的kind/页或range精确绑定context/control/target/授予exchange/相对预算，并转原read lane单次票据。段≤32KiB；client可保至多32KiB接收段和有限头表，actor仍1MiB环/3RGB。不得把此recipe说成正式设备调度。
- 接纳ACK≤原4秒；合法lease renew优先控制、段后exchange；作业绝对截止独立于短permit/lease horizon（测试自有假设参数，不代最坏物理预算）。不因20页/双遍延TTL。guard是每次实际操作/块的权威；模型较长本地作业截止不免除外部lease失效。
- 新投影逐request/stream高水位、dispatch与query/lease/cancel关联，P/M/N/descriptor pin。verified证据按单调verification_seq最多保当前远端与本地必要项（有界）；display必须引用同context/包/F的已验记录，remote当前target/control一致，旧会话仅历史held，不能current/playing。seq和source匹配后才能投影；HTTP/download不补verified/actual。
- actor执行通过新wire：未缓存目录/分段→实际完整LZ4/XOR/CRC/F/index/RGB/extra→verified event→显式重读/帧SHA→独立prepare/submit→display。42=118/117短尾、loop/once_hold及欠载沿400-02。local4只有自己全验后发asset.verified，且不造remote4；本片不宣称真实触摸/初始缓存已支持。
- 取消/换target/lease/session/suspend先fence旧工作；io_exited=false不放本地在途read/HTTP槽或reader/catalog pin；close/disable等实际handler及忽略abort的钩子退出，再关worker/reader。新hello/enable不得抢在旧实际退出前重用。历史front可保留但不复活旧目标，无Flash gate/保存/淘汰成功。

## 验证与回退

先新增临时lab与专用监督CLI，生成原创400 source/独立用途批准并经A2导入；优先既有小PET4，另至少一个大于1MiB的400样本验证双遍跨窗。无真实媒体或许可证批准。真实TLS socket/临时绑定＋session/guard，不用mock认证标志。覆盖默认OFF、hello负例/重连、20页/Range关联/一次许可、独立全验/首帧/短尾、old seq/dispatch/验证引用/取消、本地4证据、lease/暂停/撤销/坏元数据、实际退出及关闭/无源缓存重开；保留未实现/待固件确认项。

运行npm run check（语法）和npm test（含构建）及专用CLI，旧360/94正116反保持。更新当前摘要/归档被替代400-04待实现段。回退：disable/close自有adapter→等HTTP/read/worker实际退出→caller关自有TLS client/server/store→删自有临时根；撤回新文件和少数受信注入点即可，无外部配置/namespace/分区/缓存格式迁移。注入故障未退出时保留临时环境/阻塞恢复，不假装清理。

正式profile/N/策略两遍＋7712B成本、400持久化、RTOS退出/TLS/可信时间/凭据/撤销/G1-G2/24fps与真实用途批准依旧W01–W10未确认。本轮无生产装配/自动开关/设备授权。

### 实施细化／限制

local4本片限定空闲时显式原创本地源的全验/独立首帧，不包含活跃base抢占/latest恢复或完整touch/deferred调度；同一个窗口池使用，不创建第二套常驻actor。重读/解码失败由真实actor派生failed回执，作业截止和可续lease分离。server/client实际退出两端都等，不加自动重连重试。下一400-05先Spec/Diff补调度协同；本片不因合同允许字段就标记这些行为已实现。

## 执行状态

2026-11-02本片默认OFF临时装配离线范围完成：37专项/独立监督CLI/check/含构建1091通过，真实临时TLS/session/guard/CAS/window actor链及实际退出已验。完整local优先/latest/自动调度留400-05，Flash/正式profile/N/资源准入未完成；详见[报告](../../reports/2026-11-02-native400-04.md)。
