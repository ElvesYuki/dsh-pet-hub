# G0-R5 临时 GET／分段承载 Spec（实现前）

2026-11-02。先读AGENTS、README/上下文、开发/维护规则与R4 adapter、A4 pull/Range/reader/request owner实际代码。只在独立临时CAS/绑定根/PKI与loopback验证，原创素材/虚拟时钟；不访问设备/固件/真实素材或既有服务配置，不安装、提交、推送或用子智能体。保留并行400修改。

## 范围与复用

将A4既有读许可/相对预算/Range/逐4KiB授权和读校验提取为共享内部read lane，A4仍使用原profile/路径/分页/lease协议；R4显式临时adapter复用同一lane。原createRoundPetReader继续使用验证过的fd指纹，每块打开/关闭，不缓存全库。流写入/背压/await让出提取为共享函数，两个handler复用；不再实现认证、guard、root存储或控制队列。

R4缺省readBudget=null且默认disabled，首窗口始终不发读许可；只有测试owner显式full-offline-review/1及readBudget才可下载。无服务CLI/插件/IPC/UI/生产listener。旧HTTP v5、A4信封、R3合同修订2及固定80正62反字节不改。GET只是管理端提案/宿主装配，不代固件签核。

## 契约决定

- POST exchange响应至多1 control或1 read_permit，不能并存；队列有pending/latest/ordinary/紧急旗标时不发permit。仍复用PullControlQueue截止，不延TTL。每段后必须新exchange，续租/取消等在下一许可前处理。
- permit单次消费，绑定认证socket/context、control、当前target/P-M-N、主机本地deadline；只传remaining_ms，按现有guard保守horizon及segment/exchange/cleanup/margin预算预留。旧permit被新exchange/意图/取消/失效取代，不能跨会话/目标重放。deferred_local、当前本地触摸/维护或终态不发行读许可。
- GET /hub-device/v1/manifests/{M}?offset=0..45&limit=1..8：仅完整会话批准包，按既有manifest数组顺序取页，descriptor映射符合R3，实际canonical body≤4096B，不因超限改TTL/扩大上限。GET无独立请求序列；manifest封套request_id/request_seq回显**授予该permit的exchange**，不是新造一次控制请求；响应头x-round-pet-read同permit。此关联决定须固件审阅。
- GET /hub-device/v1/assets/{F}：仅当前target文件F、单显式Range≤32768B，If-Range必须等于F的强ETag，范围按A2真实文件长度校验；拒绝suffix/multi/越界/旧ETag/任意URL/额外query。206带Content-Length/Content-Range/ETag及x-round-pet-read/request-id/request-seq，后两项同上述exchange；不重定向、压缩、chunked或静默截断。GET不得带body/编码。
- 每个≤4096B应用写块前新同步readView：session/TLS/日期/撤销/完整元数据、control/horizon/target/队列/permit截止；reader指纹前后验，之后再确认许可，未检查块不发到socket。不跨await持revision，不放宽A10减量边界。
- 元数据/Range验证不等于F/格式验证；测试peer须收齐后用现有validateSegmentResponse及verifyRoundPetAsset核完整F/CRC/index。PC下载结束不产生verified/playing/saved，必须独立设备模拟回执。

## 取消、超期和实际退出

共享lane最多1 permit/1 read ticket，失效清permit并abort ticket，但ticket到handler实际结束才删除。HTTP response关闭与实际handler/I/O退出分别观察；beforeChunk若忽略AbortSignal仍在await，资源槽/pin/close必须继续等待，不以timer或socket关闭冒充退出。不得在这个窗口enable/新hello/新GET抢槽；同步文件系统调用不能由JS timer硬中断。

取消/新latest立即使旧许可无效；中段取消/撤销/租约或permit/ACK deadline超期阻下一块并关闭失败会话，未完成字节不作为完整素材发布，无盲重试。普通query/renew等待当前有界段实际退出，下一exchange优先处理；取消/newlatest在块边界停止旧段。中段中断明确是保守失败关闭，未承诺同TLS继续半截响应。disable/close先fence，再等待实际HTTP/read退出，最后释放A2 reader/pin；不关闭借用根权威。

HTTP timer使用较小的请求期限与permit剩余时间，错误前未发headers可固定安全码，发出206后只能destroy，不能再返回JSON伪造完整段。固定origin/单TLS/单HTTP及8KiB头/4KiB控制body保持。

## 验证、验收与回退

新增30项离线专项：默认/首窗口/未接纳拒绝，许可一次性与换目标，6页46 descriptor/包/关联，真实32KiB分段及全文件F/CRC/index，错误Range/If-Range/路径/文件身份，逐块撤销/日期/坏元数据/指纹变动，permit/horizon/ACK预算，控制优先/段后exchange，取消/断线/timeout/disable/close在忽略abort的await期间保槽和pin、实际退出后归零。原A4/新版R4回归，全套check（仅.mjs语法）/test（含候选构建）；独立监督CLI正常/SIGTERM清理。只在新失败或明确风险时扩大复验，不把loopback样本当最坏设备时延。

回退撤回新GET装配/共享lane提取，或保持readBudget=null/disabled；关闭自有临时server/socket并等待handler结束后删除自有根。无格式/namespace/期限迁移，无外部服务/设备恢复。共同G0、真实许可/G1/G2与独立设备窗口未关闭；事实变化更新摘要/交接/待办，并归档被替代的“无GET/read_permit”状态。


## 实施状态（2026-11-02）

本片已实现，见[报告](../../reports/2026-11-02-round-pet-g0-r5.md)：30专项、A4/R4独立78项及check/含构建全套877项通过，监督正常/SIGTERM清理通过；原合同/向量及session/A3/core-wire源码保持。被替代的无GET状态已[归档](../history/round-pet-g0-r5-evolution.md)。新wire的A1 actor全链、共同签核/真实素材批准/固件G1/G2/生产与设备仍未完成，保留本实现前边界与回退。
