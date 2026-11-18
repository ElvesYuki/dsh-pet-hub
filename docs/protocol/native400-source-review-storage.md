# 400-09 来源审阅持久化与只读视图

2026-11-03。仅离线内部候选，不由service/IPC/插件启动。依赖[400-08格式与独立批准](native400-bootstrap-review.md)；[Spec](../context/plans/native400-09-spec.md)/[Diff](../context/plans/native400-09-diff.md)、[测试报告](../reports/2026-11-03-native400-09.md)。新代码MIT，没有本轮外部素材或固件读取/复制。

## 入口与可信输入

`createNative400BootstrapInspector({...candidateInputs,hash}).validateMap(map)`与原inspect共享已验candidate/独立mapping上下文。严格检查recipe/self SHA、closed schema、批准摘要/身份、根选择/floor/degraded/fallback关系、四对象ID/slot/gen/帧数/F/长度/offset、checks和无device_evidence。旧inspect与400-08输出recipe保持。map≤32768 UTF-8字节。它没有原始头/CRC，不能重新证明它们；重新计算自SHA可以伪造历史cache SHA，实际源复验必须再执行400-08。

`openNative400SourceReview({directory,create=false,package,catalog,approval,mappingApproval,fault?})`同步开owner。目录须显式给出、已存在、当前用户私有；先验证调用者重新提供的两份独立批准，再读journal。输入快照由owner持有，不从账本发现或继承批准。原批准ID、用途与身份必须精确匹配；改变决定ID也不能借旧档重开，需另一个显式目录/新审阅，原档保留。磁盘只有历史，不恢复current。

返回API：

| 方法 | 语义 |
| --- | --- |
| `snapshot()` | 纯白名单来源审阅投影，无批准正文、源绝对路径或设备状态 |
| `review({file,expectedRevision,sourceName?,minimumSequence='0',signal?,timeoutMs?,beforeRead?})` | Promise；实际400-08 reader完整关闭后，以revision CAS保存新记录，文件及目录fsync成功才为本次通过 |
| `revalidate({file,expectedRevision,sourceName?,minimumSequence?,signal?,timeoutMs?,beforeRead?})` | Promise；必须有历史，重读完整源/逐payload且完整map SHA与历史一致，结束时再核journal revision；不写盘、不推进revision |
| `cancel()` | 立即使当前任务无效，不释放busy直到实际reader/hook退出；旧记录仅历史 |
| `resources()` | closed/busy/uncertain/open_files、单64KiB缓冲上限、无整cache常驻；不是RSS硬预算 |
| `close()` | 幂等Promise，立即fence，等待实际I/O退出再关闭journal，不删除历史或源 |

`file`仅在实际reader期间使用，绝不持久化。默认sourceName是basename；重验默认沿用历史label。label≤128字符，拒绝路径分隔符、控制/双向文本控制字符和`.`/`..`；React仅文本渲染。重新指定名称也须与历史一致，否则明确新review。缺省复验floor沿用历史minimum_sequence，改变floor会改变map，不能静默重绑。minimum_sequence仅来源审阅下限，不是设备可信回滚锚。

`timeoutMs`沿用400-08的1–30000ms，覆盖reader而非同步磁盘提交的抢占截止；beforeRead/fault为内部测试注入，无配置或UI入口。同步CPU、fsync、底层I/O和不响应abort的hook没有硬退出时限，只能等待真实退出，不能把计时器当硬资源保证。

## journal与失败顺序

`openNative400ReviewJournal({directory,create=false,validateMap,fault?})`是独立小schema，不使用auth绑定或素材偏好存储。已验证private目录中固定`source-review.json`，`source-review.write.lock`为独占wx锁。单文件≤65536B、当前用户/private/普通文件/nlink1，O_NOFOLLOW/O_NONBLOCK打开、固定上限buffer、严格UTF-8/JSON/重复键解析、读前后fd/path指纹一致。未知schema/字段/recipe、坏自SHA/批准错、非私有/链接/残锁拒绝，不覆写修复。

```json
{"protocol":"native400-source-review-journal/1","content":{"schema_version":1,"revision":"0","record":null},"sha256":"SHA256(C(content))"}
```

revision十进制uint64；0须record=null，后续只保最新`{source_name,map}`。map为400-08完整产物，含批准决定的ID/许可/credits摘要信息，**不含两份独立批准原文**，不能据其自授权。只保存当前历史记录，不承诺完整审计链/多记录仓库。首次创建须create=true且锁内确认不存在。

commit(expected,record,{valid})：取得wx锁→完整读/验当前档与CAS→检查valid→临时文件wx600/write/fsync→再检valid→rename→目录fsync→更新内存→释放自有锁。before_write/before_rename故障不推进确认；after_rename/after_sync或释放自有写锁时的故障一律`review_commit_unknown`，当前owner冻结review/revalidate，保最后确认历史，不自动重试。显式close/reopen独立验磁盘后仍历史，再复验源。没有模拟或声称物理断电试验。

取消在rename前由valid gate拒绝；rename之后若提交成功可以保新revision为历史，禁止发布current。取消与unknown同时发生时unknown优先，不称回滚。外部锁不删除；残留锁需另行人工核定，不能自动清除。

实例内记录revision/digest高水位：降revision或同revision换内容拒绝；新owner不能检测完整旧账本重放。目录由可信本地调用者拥有；锁为合作写者CAS，不防恶意同用户篡改/整盘回放。自SHA不是签名。检查结束后不监视文件/其他owner，“本次通过”仅一轮完成事实。

## 投影与共享槽

`publicNative400SourceReviewView`重建schema1/profile `native400-source-review-view/1`的允许字段：phase/revision/current_run、历史source_name/map SHA/cache SHA/N_boot/root_sequence/四引用、当前attempt安全名/类型、枚举error，device_evidence恒false。uint64保持字符串；丢弃私有扩展并拒绝矛盾current/历史/错误/attempt。

phase：empty、historical、reviewing、current、failed、cancelled、closed、uncertain。只有current有current_run=true；失败/取消不继承先前current。source-review与设备observation是不同slot，不能转actual/saved/offline_available。

`hubViewModel(status.sourceReview)`及`renderNative400SourceReview`共用白名单，缺省隐藏、坏投影显示安全错误。固定client构建白名单加入投影/renderer；只读显示状态、来源安全名/历史root/摘要、四引用与“未全媒体验证/非设备确认”。无源路径、文件选择、批准上传、控制按钮或新后端路由。测试涵盖独立构建JS宿主的设置槽注册/渲染；未做本轮浏览器/DSH加载、重载或UI真实数据接线。

## 错误、回退和后续

对外错误为稳定枚举；未知源I/O映射review_failed，cause仅内部保留，不展示路径。主要包括revision_conflict、review_journal_invalid/locked/rollback、review_storage_failed、review_commit_unknown、review_map_changed、review_cancelled/busy/closed、sequence_exhausted及reader原稳定错误。没有自动重试/越权修复。

候选默认不装配。回退：cancel/close并等待busy=false/open_files=0，保源与journal不动；新目录可隔离归档，但unknown或残锁不自动删除。回到400-08只读入口无迁移/分区/缓存/配置变化。后续[400-10临时宿主装配](native400-source-review-host.md)已离线实现owner/只读status/代理与退出所有权及JS宿主实际读取展示；仍无真实源、设备、生产listener或现有服务接入。下一显式操作入口先评审。固件G0/用途、Flash proof/writer、TLS/凭据/时间、资源/24fps仍须独立证据与授权。
