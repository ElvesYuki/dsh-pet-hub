# 400-11 显式离线审阅操作契约评审

2026-11-03。**400-12选择/400-13内部控制及[400-14显式临时交互](native400-interactive-host.md)已离线验证；默认无provider仍只读，400-15已补共享UI真实浏览器验证；DSH用户身份/native picker未验，本页CTL整体不能标完成。** [Spec](../context/plans/native400-11-spec.md)/[Diff与实施切片](../context/plans/native400-11-diff.md)、[报告](../reports/2026-11-03-native400-11.md)、[既有API探针](vectors/native400-11-controls-review-v1.json)。依赖[400-10只读宿主](native400-source-review-host.md)与[400-09存储](native400-source-review-storage.md)，不改变既有证据等级、wire、素材/固件许可或设备范围。

## 事实、缺口与决定

| 项 | 当前实际代码/证据 | 本次决定（待实现） |
| --- | --- | --- |
| 可信输入 | prepare验证快照candidate/catalog与两份独立批准，内容摘要进sourceKey，winner才开owner | 保持原批准边界；网页不提供批准正文或自批准，换批准须可信宿主显式新实例/新目录并保旧历史 |
| 文件选择 | 400-12元数据选择/opaque引用与可选expectedSource已验，原O_NOFOLLOW/private/28MiB和任务内SHA保持 | 400-12已实现上述可选内部绑定；未来交互必须强制携带，不允许失效后降级为undefined旧接口 |
| 选择到读的间隙 | 400-11 OBS-01表明旧路径接口只验任务打开对象；400-12已验可选绑定首读前拒该替换 | 合法新对象也拒绝；expectedSource缺省旧路径保持，400-14已接临时受限流程，真实宿主身份/native picker另验 |
| 取消关联 | 原owner.cancel()仍只操作当前任务；400-13控制器已在同栈先匹配job/session，OBS-02接线缺口已补 | 400-13已实现定向检查，旧终态取消无操作、过旧/跨scope拒绝；原owner API不直接给网页 |
| 宿主与页面权限 | 本仓库已验prefix/React设置槽/只读status，未验native picker或可信审阅页面身份 | DSH网页保持只读。先做临时内部控制器/原创fixture；正式交互必须另核选择provider与授权发放，不因能注册路由就开放写权限 |
| 异步/退出 | 单IPC2.5秒，reader最长可设30秒且I/O可忽略abort；关闭等真实退出 | start只异步受理任务，不等待整文件/持久化；HTTP失败不推断未受理，取消/退出期间busy保持至真实退出 |
| 授权期限到提交 | 400-13 owner可选同步Boolean gate已接会话/任务期限与提交/发布，默认旧行为保持 | 400-13已实现同步时钟门禁/首次失效锁存与迟到timer隔离；非抢占提交跨期仍只保历史，不许以timer代替提交检查 |
| 持久恢复 | journal原子CAS、rename后unknown、重开仅历史；没有持久请求去重账本 | 去重只在同实例/同审阅会话有界成立，重启旧请求失效；未知提交不重试，可信宿主关闭重开后再实际复验 |

OBS探针描述400-11时旧接口；[400-12选择绑定](native400-source-selection.md)已补内部选择子范围，400-13已补内部会话/去重/定向取消与授权gate；400-14已接受信临时页面provider，实际浏览器/DSH身份与native picker仍待验。已通过的完整文件SHA不是选择时授权、全媒体验证或设备库存。当前`sourceReview/1`与400-03 wire字节均保持。

## 1. 四种权限分别持有

1. **独立用途批准**：可信调用者持有原400-01 approval和mappingApproval，prepare固定到P/M/N/来源两SHA/用途/许可，usage仅offline-source-review。视觉批准、文件自SHA、点击“确认”或账本内approval摘要都不能生成它。
2. **来源选择许可**：可信运行层显式接收用户所选路径，检查是私有普通nlink1/精确29360128B文件；只记录元数据，不做整文件审计/安装。页面只获受限选择引用，不能传路径、fd、指纹或任意摘要要求宿主读取。
3. **审阅会话授权**：由可信宿主发放给一个明确控制页面/测试adapter，绑定service_instance_id、审阅者会话和批准输入摘要。随机client_id/Host/Origin/X-Pet-Hub只用于关联或CSRF防护，不能发放此权限。不存在GET全局status→自动拿审阅权限的路径。
4. **单次操作确认**：在前述权限已有时，用户明确选择review或revalidate并核对来源名/批准ID/用途/revision，再提交一次请求。它只授权本次PC来源审阅，不改用途批准，也不授权设备下载/播放/保存。

首实现仅一个可信审阅会话、一个待消费选择、一个在途任务、一个最近终态和一个最近受理请求；无等待队列、自动latest替换或多窗口共享控制。第二控制页缺省只读；接管须可信宿主撤旧会话、取消并等真实退出，再授新会话。

## 2. 选择记录及任务内绑定

拟定内部记录：schema1/profile `native400-source-selection/1`，service_instance_id、reviewer_session_id、generation/selection_seq（uint64字符串）、approval_inputs_sha256、selection_id（运行层随机256bit）、expected_revision、可用操作集合、safe source_name、路径和完整fingerprint、单调时钟期限。**路径/指纹/selection_id不进入全局status、DOM、日志、journal或Git。** 请求中不能由网页替换这些字段。

选择时通过O_RDONLY|O_NOFOLLOW|O_NONBLOCK打开、核fd/path同一私有普通文件/大小/链接数；保存dev/ino/size/uid/mode/nlink/mtimeNs/ctimeNs的规范字符串并关闭该短期fd，不闲置持有第二份流式reader。它不表明内容已校验，界面应显示“已选择，尚未审阅”。不自动复制/导入cache、不扫描目录或读取带NVS整片。

任务消费许可后，**复用400-08打开的实际fd**，在第一次读前比较内部expectedSource，再沿用每次读前后/结束时的fd与路径检查和全cache/逐payload SHA。只在控制器预查stat而reader之后重新open不足以绑定选择；不能用当前mtime缓存代替hash。读取期间路径替换/权限/链接/原位修改仍按既有规则失败，源不修复。

选择被替换、指纹变化或许可过期须重新选择，不自动跟随新路径对象；文件内容未通过审阅前不填current。指纹仅防普通文件变化/选择混淆，不是内容证明、签名或防恶意同用户/特权OS伪造。即使mtime被恢复，ctime/实际SHA仍需核对；不许放宽原私有/nlink1门禁来适应picker。

选项建议上限（**设计策略，非测量/硬时限**）：选择有效60秒、审阅会话最长5分钟、任务reader上限30秒。使用注入单调时钟，期限相等即过期；公开剩余毫秒可展示但不能作为网页自行延长的依据。选择过期前已成功消费的任务不再受选择TTL约束，仍受任务截止/会话撤销；重试/轮询不延任何期限。处理器/同步fsync/底层I/O停顿没有硬退出上界。未涉及设备租约/400-07预算，不能据此改变旧TTL。

## 3. 拟定请求与有界去重

新操作profile拟为`native400-source-review-controls/1`，独立于现有来源展示schema。未来仅在显式controls选项下进入sourceKey；默认400-10描述/路由原字节行为不变。来源证据view与journal不扩字段，控制状态单独白名单。

拟定start闭合请求（均需可信会话凭证，凭证走私有transport，不在正文或全局status）：

```text
protocol, service_instance_id, reviewer_session_id,
selection_id, request_seq, request_id, expected_revision, kind
```

protocol固定；kind仅review/revalidate；seq/revision为uint64十进制字符串，不转Number；随机ID严格长度/字符集，正文≤既有4KiB。未知字段（尤其file/path/fd/approval/fingerprint/timeout）拒绝。sourceName、minimumSequence、timeout及批准摘要由可信选择/策略绑定，网页不能添加覆盖；更高floor或换label须新选择/明确新review，不能静默重绑历史。

顺序必须是：鉴权/实例/会话有效→闭合schema/请求摘要→同seq去重→新请求的状态/容量/选择/代数校验→同步保留任务/推进序列/消费选择→启动原owner方法并后台等待→立即回受理ACK。busy/unknown检查不能阻挡已受理同一请求的ACK重读。请求摘要使用既有canonical recipe规则，不能仅比request_id。

- 保存最近受理的`seq/request_id/body_sha256/ACK`及会话高水位；相同seq且相同body返回原ACK，无新read/write/任务。相同seq不同body为idempotency_conflict，较小seq为stale_request，下一新请求必须high_water+1；耗尽拒绝，不回绕。
- selection_id单次消费、绑定该会话/实例/批准/generation和revision；选择被消费后，相同受理请求仍走去重返回ACK。较旧请求即使去重条目被覆盖，也由高水位拒绝，不重建旧选择。
- 受理前拒绝不推进高水位/不启动I/O；失效选择需重新由可信宿主选择。创建任务后，owner的实际journal读取/CAS可能以revision_conflict等失败，该任务仍算已受理并消费选择，不能以异步失败重置seq或自动重跑。
- 控制器的expected_revision只是受理关联，权威读验/CAS仍在owner/journal；不得称选择时的内存snapshot为跨进程新鲜盘视图。
- ACK仅`accepted=true/job_id/request_seq`，表示控制任务已建立，不是源verified/current、更不是设备accepted/playing/saved。同请求重复返回原受理ACK，即使任务已失败/unknown；任务结果另取状态。
- 断HTTP/2.5秒超时不能证明未受理。先用同一实例/同一seq/同一body重取ACK或查状态，不能生成新request_id盲重试。服务实例改变时旧请求拒绝，新授权后先核历史；没有跨重启exactly-once承诺。

start不得等待整文件或任务结束才回复；同步授权/元数据/fsync仍可能阻塞event loop，不承诺2.5秒内一定收到ACK。去重不依赖HTTP成功，也不把请求失败当任务回滚。

## 4. 定向取消、撤销与unknown

拟定cancel闭合请求：protocol/service_instance_id/reviewer_session_id/job_id。同一会话/实例下核当前job_id后，在**无await的同步栈**调用owner.cancel。取消已终态的同job返回其终态/无操作；旧job已不在最近终态/当前任务则stale_job。特别是新job在跑时，旧cancel只能返回旧终态或拒绝，不能调用当前owner.cancel。job_id本身不授权，跨会话/实例即使知道ID也拒绝。

取消ACK只是cancel_requested；sourceReview原phase可立即cancelled，但controls仍cancelling/busy、io_exited=false，直到原owner Promise/fd/hook实际退出。只有真实退出才释放单任务和选择保护。不得从source.phase=cancelled推断退出或允许新任务。

可信撤销/授权到期必须经同步授权gate进入owner的最后提交与发布检查：核同实例/会话代数和单调时钟，不做I/O、不返回Promise或重新进入owner；非Boolean/异常失败关闭。事件timer只唤醒取消，不能代替在同步文件写/fsync之后、rename之前直接读时钟。400-13已最小扩展owner同步授权gate，并保缺省旧语义；实际API/容量与计时边界见[控制器](native400-review-controller.md)。

取消不保证持久回滚。rename前valid gate可阻提交，rename后已知提交可保新历史，unknown必须显示outcome_unknown并冻结。门禁时授权有效、但非抢占rename/目录fsync跨过期限时，可留下已确认历史，最终再核gate禁止发布current；不声称时限一到能撤回已进入OS的提交。控制器不能只凭revision变化/HTTP状态猜not_committed；只展示原owner已确认历史和uncertain，复验结果仍以sourceReview为准。unknown无自动重试/清锁/网页“恢复”捷径，可信宿主显式close→等退出→新实例/新批准输入→历史→显式源复验。

HTTP取消/只读页面unmount不撤销共享任务。可信**控制授权adapter**显式撤销/到期则失效该会话所有未用选择并取消其在途任务，等实际退出；它与400-10只读代理卸载不同。新只读页可继续看历史，不获得控制权限。服务close仍在返回前使owner失效并等实际I/O后释放UDS；不得因网页断连而停止整个共享服务。

## 5. 宿主接入与只读降级

没有本项目已验证的DSH native file-picker/provider或可信控制页面身份契约。因此不能给现有DSH网页加一个任意路径POST，也不能把浏览器上传/文件名当宿主路径。第一实现由可信内部runner/测试adapter显式登记原创源，之后再核原生选择与审阅会话交接；provider缺失/用户取消选择应保持只读/旧历史，不能猜目录或默认选真实文件。

未来候选沿用原UDS/Bearer/实例鉴权及HTTP路由所有权；拟新增start/cancel/控制状态，不开放通用read/file/approve/reopen/clear-lock。交互profile必须独立进入sourceKey，只读owner不可原地升级；旧profile依然404。新增HTTP写代理须精确Origin校验及私有审阅会话授权，若Sec-Fetch-Site存在仅接受same-origin；不得修改已有只读/其他模式的兼容策略来绕过。Origin/X-Pet-Hub只防跨站请求，不能抵御同源XSS或恶意本机用户，也不替代可信会话。

全局GET status继续只有sourceReview来源展示，不发selection_id/会话凭证/输入正文。审阅者私有channel可返回一次选择引用，但轮询不能新发授权/延期限。引用保在transport内存、由显式确认使用，不进DOM/dataset/URL/本地存储。拟定公开controls view仅状态/安全来源名/selection_seq/剩余时长/批准ID与输入摘要/job摘要/枚举错误；无路径、fingerprint、完整approval或凭证，不能把控制状态混入设备view。

UI须区分“选择来源”“开始本次审阅”“按历史复验”“请求取消”“等待实际退出”“结果未知需可信宿主重开”。源选择、ACK/下载结束、PC画布都不能显示“设备已保存”。本轮无按钮/新view实现，真实浏览器/DSH/auth/provider验证单列待办；现有只读slot仍可用。

## 6. 待实现验收向量（不能计为已通过）

| ID | 输入/竞争 | 预期（拟定） |
| --- | --- | --- |
| CTL-01–04 | 缺/错独立批准、账本/页面自批准、换批准attach、准备后原对象修改 | 准备拒绝或快照保持；不创建读取任务/提升用途 |
| CTL-05–08 | 网页path/fd/approval/未知字段，伪造或跨会话/实例selection，无native provider/用户取消 | 拒绝或只读；无任意路径读/自动选源 |
| CTL-09–12 | 选择后换inode/同大小新合法文件、原位改字节/mtime恢复、变权限/nlink/symlink、打开后再换路径 | 首读前/任务内失败，不审新对象或修复源；未用grant不代表内容已验 |
| CTL-13–16 | selection/session到期边界、选择消费后TTL到期、任务/关闭忽略abort、跨实例旧选择 | 到期拒新任务；已受理受独立截止/撤销；busy等实际退出；旧引用不重活 |
| CTL-17–20 | 相同受理request重复且grant已消费、同seq异body、旧seq重放、跳seq/uint64耗尽 | 原ACK不重跑；冲突/陈旧/耗尽拒绝，序列不回绕 |
| CTL-21–24 | 响应丢失后相同请求、busy时另一start、任务受理后CAS失败、跨进程revision变更 | 不盲重试/无排队；已受理失败仍消费；journal权威拒绝，旧历史不升current |
| CTL-25–28 | 同job重复cancel、旧job cancel遇新job、跨会话cancel、cancel已ACK但fd未退 | 幂等终态/拒旧或跨会话；只影响匹配job，退出前不放busy |
| CTL-29–32 | rename前取消/同步阻塞后授权到期、rename后跨期限/unknown、授权撤销/非法异步gate、只读代理卸载 | 无假回滚/自动重试；unknown冻结；可信撤销失效；只读卸载不关共享任务 |
| CTL-33–36 | 旧只读profile POST、无控制会话/错Origin、get status取grant、私有字段/错误注入 | 404/鉴权拒绝/无授权泄露；安全展示，不回旧current |
| CTL-37–40 | 源坏后复验、unknown可信重开、相同输入原recipe、真实退出后的资源/原模式回归 | 历史等级正确；新实例无旧grant/请求复活；原字节/格式不变；无泄漏/生产自动启用 |

按切片列实测/未覆盖：400-11为OBS-01/02；400-12的35专项覆盖内部选择；400-13的45专项覆盖内部会话/消费/seq去重/定向取消/同步gate/退出。400-14已覆盖临时HTTP Origin/provider、service交互接线和构建JS hook宿主；400-15已补共享UI真实浏览器验证；DSH用户身份/native picker仍未验，不能将CTL-01–40整体标完成。协议解析测试不等于OS dialog/真实浏览器/DSH身份授权或设备证明。

## 7. 回退与放行条件

400-12已交付可选内部绑定，默认旧调用/recipe/持久格式保持；400-13/14撤控制adapter授权、取消且等实际退出后回只读profile，已提交journal保留，unknown/残锁不删除。新profile不能通过旧descriptor自动启用或改DSH配置。

允许先离线实现选择绑定/控制器，不以缺原生UI阻塞这些独立工作；正式交互须补provider与可信页面会话证据。真实源/用途及共同G0另核，设备N_boot/库存、Flash writer/proof、TLS时间凭据/G1-G2/24fps仍NO_GO，不纳入本次PC审阅控制。外部仅沿用400-06文档快照，未刷新现场。
