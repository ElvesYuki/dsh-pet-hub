# TCP-01 Spec（2026-11-04，实施前）

状态：本轮宿主实现范围已完成；最终证据见[报告](../../reports/2026-11-04-tcp01.md)。原实施前边界如下，共同冻结/ESP仍待验。

按用户新方向：设备LAN明文TCP，控制后接素材流，不用TLS/HTTPS/WSS。管理页面HTTP、IPC权限/生命周期保持。先缓存remote0/1/11、4物理触摸；broker/native选源/额外TLS评审不是前置。固件仅只读，未执行生成/构建/设备脚本；不接ESP、不装插件/改profile/生产服务，不改素材/分区/缓存，无保存/V3。

复用：native400素材身份、批准/仓库/校验器与语义表；Native400Schedule作业务latest-base/本地优先基础，UI使用安全投影。旧native400-wire-review的JSON、HTTPS会话guard、Range/read lane和whole-media双遍调度保留历史，不强行包进TCP。新core二进制codec/流parser/TX cursor、独立连接会话与缓存控制adapter、模拟端侧actor、显式loopback socket承载。默认生产装配不启用。

采用终端PTC1 draft-v0固定32B头/256B上限/LE/u64字符串/IEEE CRC32及7消息；7原向量+mapping recipe逐字节Node/C++对拍。mapping以明确恢复四对象0/1/4/11与独立批准输入为前提，不能把hub目录当设备库存。保留P/M/N/index/asset各域，不混用mapping。

连接代数隔离旧close/source，1条请求在途+1条latest-base，无无限排队；PING优先于未发送base，单record短写/背压不可插包，超时失败关闭，不自动重试/续TTL。新连接HELLO验证固定能力/本地mapping，OPEN回显boot；同请求重放不刷新任何deadline，同seq异内容拒绝。设备模型保触摸与latest，断开/到期回local；控制者ID/nonce/SHA均非认证。

投影分别desired/accepted/verified/last_frame0：v0无独立VERIFIED消息，不能标完整SHA已报告；PRESENTED严格对应当前命令/session/连接/token/source/frame0。deferred后token未知只能将匹配PRESENTED当独立设备报告；无STATE导致触摸当前状态未知，last_frame0不能冒称持续正在显示。whole-media proof仅host原校验器可给，设备本地全文件SHA/metadata/frame0 CRC+逐帧CRC策略须共同确认，不改成网络未缓存渐进播放。

最小扩展提案（本片不编码）：STATE含connection/session/base seq、touch token/source、实际origin/action、TTL余量；VERIFIED或STATE内完整性等级；EXIT/ERROR关联原request/token/source并标原因、是否保front。新type/长度/协商必须共同定版，无自动兼容降级；生产接入前阻塞，既有7消息不变。

测试：原始向量/recipe、半包所有切点/粘包/错长CRC/EOF/回调拒绝、短写/0写/背压；模型重放不续期/冲突/失效/触摸latest/旧close/旧touch/旧source；真实自有动态loopback TCP（非TLS），资源关闭。Node/C++17独立宿主checker；可显式传入端侧只读header编译宿主oracle，不执行固件脚本、不链接ESP应用。npm check/test/build。结果区分模型/loopback/ESP未验。

回退：关闭自有socket/临时server，清当前代与TX/在途，保最后观察为历史；生产默认OFF无配置迁移。保旧review/TLS候选和旧400/360回退，但不作为新设备默认。下一共同确认扩展/身份/校验，然后端侧socket-owner/worker/View与LAN资源短测；再素材流，长测/保存掉电/400-L/V3后置。
