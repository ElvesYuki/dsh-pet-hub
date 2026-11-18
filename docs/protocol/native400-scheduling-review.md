# 400-05 离线触摸与播放调度

2026-11-03。当前周期预算/GET-only gateway/严格计划选项由[400-07 API](native400-cycle-budget.md)补充，下面保留400-05基础调度语义。[Spec](../context/plans/native400-05-spec.md)/[Diff](../context/plans/native400-05-diff.md)、[报告](../reports/2026-11-03-native400-05.md)。这是默认关闭临时宿主的代码选项和模拟器，不是正式设备合同、生产入口或真实触摸实现。沿用[400-04 API](native400-host-review.md)的认证、存储和资源所有权，400-03 revision1/字节向量保持。

## 使用与所有权

`createNative400WireReview(...,{scheduling:true})`与`createNative400WireExecutor({...,scheduling:true,jobMs:120000,localMs:20000})`必须由可信调用方同时选择；缺省false保持400-04。hello仍只表示review profile/版本/包和verified-replay，**不协商本策略或设备本地源**。正式能力/策略需要共同G0确认，不能将此代码开关透传IPC/运行配置来自动启用设备。

纯core `Native400Schedule(clock)`只保一最新意图、一touch周期、revision/generation高水位；没有I/O、DSH或DOM依赖。`accept(target,mode,deadline)`只接受更高revision，返回ready/deferred_local；`requestTouch(localMs)`重复返回false；`beginTouch/endTouch`不延原始截止，取消/完成/失败/过期不复活。可信调用者提供已校验target及单调时钟；回退时钟失败。新session清意图，历史画面不构成恢复命令。

模拟层`createNative400SchedulingDriver({executor,clock,gateway,localSource?,pollMs:500,ioMs:1000})`借用executor和gateway；gateway.exchange负责单TLS交换、应用控制、清空有界回执（400-07对整体设500ms预算），gateway.read只取单个已授权页/段（GET-only，不内嵌exchange、不提前供给actor），可返回control表示本次让出读取。调用方不得并发绕过driver访问同一HTTP槽。

localSource必须显式提供`{bytes,read(offset,length,{signal}),close?()}`，对应独立metadata pin的4号原创PET4；每次≤32KiB，短读/坏内容不能产生有效首帧。它是测试设备本地源，绝不是已确认ROM/Flash或网络下载local4。未提供时touch拒绝且base保持；不能回退下载、用PC预览或空缓存冒充。

`touch()`允许在pump的await中同步fence旧帧；`pump()`同一时刻至多一个，返回一次有界推进状态，无timer/后台轮询。调用方显式推进设备/宿主时钟及提供≤500ms轮询机会。`close()`可重复调用，先fence，再等实际source操作及在途pump（包括借用的控制交换）退出，最后关闭本地源；TLS/server/session/store由借用者在其后关闭。忽略abort不返回时等待，不提前释放资源。

## 单窗口与读取顺序

触摸请求立即使旧frame token/解码工作失效，保最后有效front；普通触摸、remote替换/取消都让**已经接纳的一个GET**有界完成，不强制abort同一TLS。逐块认证/撤销/期限仍完整生效。实际GET退出后先交换控制/回执，再按session/generation/pass/action/local核本段；旧段丢弃，不供给新actor。touch.started只在旧IO退出后产生，host暂停remote许可并重置asset游标。

local4首遍完整F/CRC/index/RGB/extra→asset.verified→同源重读逐帧SHA→独立软件首帧，复用原ring/三RGB/头/段；不留base encoded或收据副本。新remote只更新latest并accepted/deferred_local，不能打断local帧/本地IO或重新计local截止。重复touch不排队。remote cancel清latest并保local；lease/session/auth/未知IO失效则清两者，仅保历史front。

local尾帧240在241/24秒（取整10042ms）后、且该遍完整验证结束，先touch.ended，再只对最新有效意图accepted/ready＋verifying，从asset0重新全验/重读；不从旧ready frame/下载offset恢复。42尾117/4917ms；一次播放已完成/失败/取消/到期不因touch重跑。缺少有效latest就保local尾帧，不虚构有本地idle0。local内容失败结束本周期，可恢复仍有权威且原截止有效的latest；不输出虚假local verified/playing。未知IO、时钟和权威错误失败关闭，不猜测设备物理自主播放。

base_loop只在全遍验证完成且末帧间隔结束后重读；once_hold保尾帧。先decode再tick判欠载；buffering保front并暂停elapsed，重填至少min(24,remaining)帧后提交下一顺序帧，不跳/赶帧。poll离散采样可晚于理论边界，模型平移晚提交；测试精确时刻另核4917/10042ms，不能把宿主pump速度说成设备24fps。

## 观察和取消

request/accepted/verified/actual仍分开。触摸时remote admission=deferred_local，显示local origin且无remote target；remote更新或取消不把正在运行的local误标历史。结束和会话关闭则标历史，恢复期间maintenance=verifying，直到新首帧实际提交/报告。存储保持unsupported、inventory_known=false、saved/offline_available=null，未实现400 Flash或淘汰。

touch.started记录verification高水位为本周期floor，local4新proof/当前显示须处在活跃周期并引用floor以上的proof；触摸期间remote当前显示拒绝。结束后/下轮触摸的旧local，即使stream序列新且旧proof正确，也不能复活。旧frame token、旧session、重复revision/stream继续拒绝。base_target只诊断，不能改写host desired。

同命令触摸恢复由新投影明确重接纳；通用Registry只保最高已观察阶段，不放宽其回退规则。当前本地画面/维护以400新投影为准。已派发旧target的退役ACK可清它自己的pending，退役playback/display只推进有界序列，不修改最新desired/actual或开启读许可；陌生/不匹配记录仍失败关闭。可信queue.discardLatest只清未派发latest，不清pending/期限/控制flags。取消回执的io_exited只指remote操作，不能代替本地源/pump的实际退出。

## 时间预算与边界

400-07已将原6000ms触发改为由声明成本推导的6720ms；严格>4510ms拒绝floor/单TLS/HTTP/原队列/15000租约不变，取消/撤销仍优先。完整exchange/flush500ms、GET-only或local source1000ms由同一个实际owner持有，同pump受控compute累计≤100ms，成本超限失败关闭、不发布新actual；源/控制忽略abort仍等实际退出。所有数值都是离线声明，不是ESP/网络最坏测量。

remote原120000ms、local20000ms不被touch/renew/loop延长，118/241及末帧间隔保持。显式requireBudget先评估声明计划必要条件，超120秒在目标/队列/revision修改前拒绝；fits不保证未建模的实际wall，默认review仍尽力执行且原deadline到期失败。实际170段原创媒体负例已验，见[400-07](native400-cycle-budget.md)。工作池仍原1MiB/三RGB/2194816B逻辑上限，executor段/头及proof/outbox容量不变，TLS/Node/fixture不在此算术内。

## 复现与回退

`node scripts/verify-native400-05.mjs --output .cache/native400-05/results.json`在自有临时环境运行专项，退出后清理PKI/CAS/socket/worker/源；不使用真实媒体或已有配置。

回退顺序：停自有pump→driver.close（等源/控制实际退出）→disable/close adapter（等HTTP/read/worker）→关自有TLS client/server/session/store→删临时根。关闭scheduling代码选项回400-04路径，无旧N/分区/缓存/配置迁移。完整性/正式profile、local源/能力协商、N/Flash、TLS/可信时间/凭据/G1-G2/24fps/真实用途仍待[W01–W10](native400-wire-review.md#交固件的决定待确认项尚未共同签核)，未产生设备窗口授权。
