# TCP-12：来源与独立用途决定的请求装配

2026-11-05。[Spec](../context/plans/tcp12-spec.md)/[Diff](../context/plans/tcp12-diff.md)/[报告](../reports/2026-11-05-tcp12.md)。此入口只做可信本地一致性校验，不是许可授予、身份认证或设备启用。实际测试全部为原创MIT样本；真实材料只准备[用途草案](../context/plans/native400-material-purpose-draft.md)，未签发新决定/配置。

TCP18后续：新增真request的内部控制上下文（无Wi-Fi/无deviceConfig交接），以及仅original-test的loopback审阅分支；同样核完整真实fixture audit与独立决定。真实reviewed-upstream和设备配置handoff保持原LAN门禁。

后续[TCP13](native400-private-config-session.md)已接内部opaque handoff/guard及私有文件/fake consumer生命周期；真实adapter、service统一退出与LAN/USB成功路径仍未完成。

## 同次来源上下文

`native400LanInputAuditContext(task)` 仅识别TCP11实际创建的task（WeakMap）。已完成且未close时返回深拷贝 `{evidence,license_ref}`，license_ref取自实际解析candidate；否则null，非真实task为lan_audit_evidence_unavailable。替换public ready/snapshot/resources方法、重算JSON self SHA或复制对象均不能创建上下文。

这不新增源读取，也不改变TCP11输出recipe/ready/snapshot。证据仍为历史PC文件，不监控审计后的文件变动、不变成设备库存或许可确认。关闭审计即撤销该上下文使用，不会自动关闭另一个owner的网络服务。

## 独立记录及匹配

`prepareNative400ReviewedLanRequest({audit,materialReview,windowDecision,endpoint,windowMs,clock?,interfaces?,ackMs?,tickMs?,timers?})` 同步装配，未知顶层字段（含identity覆盖）拒绝。三个输入分别是实际来源任务、调用者单独给出的材料决定和窗口决定，不相互生成、也不从磁盘自行发现。

materialReview闭合以下字段：

| 字段 | 要求 |
| --- | --- |
| schema_version/profile | 1／native400-cached-control-material-review/1 |
| review_id | 调用方独立记录ID，1–256字符、无首尾空白/控制字符；本模块不分配 |
| usage | local-noncommercial-cached-control |
| source_evidence_sha256/mapping_sha256 | 同次内部evidence SHA和mapping，不能用manifest/cache/P/M/raw index换域 |
| license_ref | 与实际解析source的license_ref逐字相同 |
| credits | 1–16个唯一非空有界字符串，保留列表顺序 |
| source_kind | original-test或reviewed-upstream；是审阅者声明，不由本模块验证作者身份 |
| remote_actions/touch_actions | 精确[0,1,11]／[4] |
| media_distribution/persistent_write | 均false |
| index_policy | trusted-local-raw-index-pin-no-compiled-check，明确现固件未独立compiled pin |

windowDecision仍完整沿TCP08闭合格式，usage=single-device-cached-control，不扩旧offline。必须source_review_sha256=evidence.sha256、mapping_sha256相同、material_approval_id=review_id，license_ref/credits与materialReview逐字/逐项/顺序相同。原integrity/presentation策略和端点/窗口约束仍由TCP08/10执行；缺决定、旧profile、scope扩张或引用不一致失败关闭。

匹配字符串不是验证法律权利；记录ID/摘要不是签名。实现不能确认credits真实、reviewed-upstream是否有足够依据、是否已取得材料所有者授权或固件方是否接受信任政策。此责任由独立真实审阅记录承担；真实字段不能照抄原创fixture或草案占位值填过门禁。

## 装配结果与生命周期

通过后只用内部audit identity调用TCP10，调用方不能另传四记录或换原始index。不会创建UDS/TCP listener、枚举网卡、读取凭据或调用USB。返回冻结对象：

| 方法/字段 | 语义 |
| --- | --- |
| lanReview | 原TCP09 opaque option，须调用方显式选主/操作，不自动启动 |
| snapshot() | 版本/profile/closed/source_bound/handed_off/inventory=historical-pc-file-only/device_evidence=false/authenticated=false；无地址/路径/ID/摘要/许可正文 |
| deviceConfig(args) | 前后核同次audit仍可用，再复用TCP10实际赢家/窗口/listener和一次交接门禁；无成功则不返回配置 |
| close() | 幂等，禁止新交接，仅关闭自有request；不关闭调用方拥有的audit/service |

source_bound只表示仍持同次历史审计上下文，不表示transport窗口有效或设备在线。到期后它可仍true，hub的独立window状态才描述期限；不能以source_bound重置截止或重放目标。同步clock回调若在prepare期间撤销audit，prepare拒绝返回request。使用后仍按原顺序显式关闭request、service、audit，实际资源退出由各owner确认。

此入口为新的可选上层候选，TCP10原直接可信API继续存在且仍只声明caller-declared-reference；没有把原入口悄悄升级为全局强制审批。不同runtime目录、跨进程/重启全局去重和恶意同用户防护不在范围；真实应用必须固定单runtime、可信调用链，不能只靠这层对象校验。

## 验证与未覆盖

18专项包括真实原创源I/O→上下文→独立记录→opaque请求，以及临时真实UDS选主/附着、未启动owner拒绝导出。JSON伪造、公开方法替换、引用换域、许可改名、credits顺序/重复、remote4/分发/保存、旧profile、prepare期间撤销和绝对期限均有负例。源码审计fd关完才装配，不追加整文件重哈希。

没有实际LAN bind或成功deviceConfig/首帧/USB/STA/ESP；成功交接后再撤销/再次交接的真实LAN分支仍待授权窗口验证，不能用伪owner补成功。本轮未重跑真实45MiB历史源读取，TCP11证据仍是既有历史来源结果。真实用途草案不是可加载批准文件。

回退close新request并另await所属service/audit关闭；清理失败沿原UDS/503保留现场，不强抢。无持久迁移/源/凭据/固件/媒体/DSH配置变化。下一先独立完成真实决定和端侧index职责确认，再做私有文件/单USB会话调用方；真实设备窗口另行准备fresh备份/资源/最坏时延及回退，不延TTL或删CRC/SHA。
