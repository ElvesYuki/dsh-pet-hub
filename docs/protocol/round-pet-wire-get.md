# G0-R5 临时 GET 与分段承载

2026-11-02范围说明：本文是360兼容协议/模型，不随目标切换自动支持400。当前主线见[400规划](../context/plans/native400-manager-alignment-spec.md)和[共同G0](../context/plans/round-pet-g0-handoff.md)，下一实施入口400-01至04；本文验证结果/API保持。

2026-11-02。[Spec](../context/plans/round-pet-g0-r5-spec.md)/[Diff](../context/plans/round-pet-g0-r5-diff.md)、[报告](../reports/2026-11-02-round-pet-g0-r5.md)。只装配内部temporary-wire-review/1，不创建生产listener，不接设备或插件/IPC/UI。R3修订2的JSON合同和80正/62反字节不变，以下HTTP关联语义仍需固件共同签核。

## 复用及准入

[共享read lane](../../packages/runtime/round-pet-read-lane.mjs)由A4既有代码提取，A4与临时adapter复用相同Range、相对预算、单次许可和逐块校验。[共享writer](../../packages/runtime/asset-stream.mjs)处理每4KiB应用写、背压、setImmediate让出；reader仍是A2已验证bundle的私有CAS/fd指纹检查，不保完整库或fd缓存。A4原profile/路径/分页、许可编号与授权边界保持，没有重做认证/guard/根权威或A10减量。

createRoundPetWireReview新增受信选项readBudget，缺省null；默认disabled、首窗口始终不发permit。只有显式full-offline-review/1加预算、完整库存、当前target已accepted/ready、当前有效控制且队列无work时，才可由exchange给1个许可。deferred_local/本地触摸未结束/saving等维护/播放终态不发；R6仅允许当前downloading目标在loading冻结期间继续读取（其他门禁保持）。独立ready接纳可解除deferred。GET无动作执行或持久写副作用。

预算沿A4：segment_ms/exchange_ms/cleanup_ms/margin_ms每项1..30000，本轮fixture1000/500/100/10；原guard保守horizon减剩余reserve，仅在总余量足够时发。host deadline不出wire，只有remaining_ms。它们是宿主假设，不是ESP/磁盘/网络硬上界，不延租约或ACK/入队deadline。

## 路径、许可和关联

GET需x-round-pet-read且只能消费该次permit一次。许可绑定认证socket、完整context/control、当前target和会话(P,M,N)；更新exchange会替换未用旧许可，新意图/取消/失效使其不可用。段后必须回exchange，pending/latest/ordinary/renew/cancel等控制先处理，不同时给control和permit；普通控制等待当前有界段退出，取消/换目标在块边界停止旧段。

| 请求 | 响应与限制 |
| --- | --- |
| /hub-device/v1/manifests/{M}?offset={0..45}&limit={1..8} | 当前批准M；manifest.page按既有manifest数组顺序生成descriptor，total46、next_offset至末页null，实际canonical封套≤4096B；不为身份重新排序 |
| /hub-device/v1/assets/{F} | 只准当前target的F；显式bytes=start-end，1..32768B，If-Range必须为F强ETag；以A2真实文件总长核范围，不收suffix/multi/越界/旧ETag/URL/额外query |

GET不另造request_seq。manifest.page的request_id/request_seq回显**授予该permit的exchange**，context/包亦相同；响应头x-round-pet-read、x-round-pet-request-id、x-round-pet-request-seq对应同一关联。asset返回206、Content-Length、Content-Range、强ETag及上述关联头。客户端须同时核许可/关联/预期页或range/文件长度，收齐后再核完整F/PET4/CRC/index；下载结束不产生设备verified/首帧/保存事实。

handler只允许双端127.0.0.1、单HTTP；调用方仍须配置mTLS单socket/maxHeaderSize8192/禁恢复。实际请求行及头计量≤8192，控制body≤4096；GET无body，POST/GET均禁content/transfer encoding。没有redirect/chunked/自动重连或重试。测试client复用既有request owner、固定loopback origin和实际request/socket关闭等待，只增加受信路径前缀二选一；缺省旧A4前缀不变。

## 逐块授权与退出

beginRead/metadata/range/chunk均在调用方新的同步readView内。每个≤4096B块读前、读后由原session/guard检查context/日期/撤销/完整元数据、control/horizon/target和许可deadline；A2 reader核同fd前后指纹。scope不跨await，不跨块缓存元数据。同步文件系统不可由JS timer硬打断，超预算的块返回后仍须拒绝写入。

invalidate只清未用permit并abort读取任务，**不删除正在执行的ticket**。request timer或client abort可先关闭socket，但beforeChunk若忽略AbortSignal，handler仍await实际返回；read/HTTP槽、A2 reader/catalog pin及close承诺都须继续等待。res close与handler/I/O实际结束是两个边界；新enable/hello/GET不能抢占旧slot。超时只是失效，不是退出证明。

中段撤销/取消/换目标/超期/坏档/文件改变会阻下一块、destroy部分206并fence原会话；已经授权发送的先前块不能撤回，客户端不得将半段发布为完整素材。未发headers可按固定安全错误表回复；已发headers不能再拼JSON或伪造HTTP成功。不盲重试未知副作用/重放旧manual，重连须新hello/库存/控制；部分下载恢复策略本片未实现。

## 验证与下一边界

30专项覆盖原始完整PET4分段/F/CRC/index、6页46 descriptor、Range/ETag/包/许可负例、逐块撤销/日期/元数据/文件指纹、许可与lease/ACK预算、取消/替换、timeout/abort/disable/close与忽略abort的钩子、控制优先/实际退出。A4/R4既有回归及全套结果见报告；特殊钩子是测试依赖，不是公开配置。

本片没有真实设备、RTOS/Flash/刷新事务、物理网络/断电、ESP资源/最坏时延、生产HTTP/正式UI。共同G0签核、真实素材独立批准、固件G1/G2及设备窗口继续必需；外部事实仍为历史快照。本轮不能从“完整文件已下载”推导“设备已播放”。

R6已接同一A1 actor经新wire GET的[执行闭环](round-pet-wire-execution.md)，继续复用actor/A8；R7已补同步gate失联收尾，[共同G0/资源证据核定](../reports/2026-11-02-round-pet-g0-closure-review.md)已完成本轮只读范围，下一按400身份/窗口能力/完整性与新协议分片推进，实施先Spec/Diff，保持离线边界。真实来源与设备验收另审。

回退保持readBudget=null/disabled，关闭自有server/socket并等实际handler退出后释放pin/删临时根；或撤回共享提取及新GET。无旧格式/namespace/配置/期限迁移，不清外部锁/恢复固件现场。
