# A1 单RAM＋Flash资源模型

2026-10-30。本仓库纯core离线参考实现；[Spec](../context/plans/round-pet-a1-spec.md)/[Diff](../context/plans/round-pet-a1-diff.md)、[35项专项报告](../reports/2026-10-30-round-pet-a1.md)。G0 profile仍待双方定版，本模型不等于生产固件、UI、认证通道或真实V2驱动。

## 入口及信任边界

`Native360DeviceModel`位于core/native360-device.mjs；`Native360FlashModel`位于core/native360-flash.mjs，profile约束在core/native360-profile.mjs。均不依赖Node/DOM/DSH。旧DeviceModel仍只接schema1，保持原模拟行为；不是通过删除schema检查让旧RAM LRU接schema2。

构造设备模型显式提供caps、manifest、medium、clock及受信同步verifyAsset；create仅用于明确的全擦空模拟介质。能力按G0候选值：466²/center、encoded与Flash payload5865472B、4活跃＋1暂存；manifest为46个不重编号的最小动作描述，包含8个基础语义ID，不接受PC角色package_schema=2策略。真实46集合、M/P许可及namespace映射批准仍属于A2/C02；模型校验元数据不授予素材许可。

verifyAsset默认拒绝，成功必须返回{width,height,fps,frames,codec_flag,key_interval,tile_rows,bytes,sha256}，与实际目标及360²/24/241/1/12/20匹配。它是内部验证器依赖，必须从字节求得SHA/媒体/CRC；不接受wire传来的true。异步返回拒绝且消费其异步拒绝，不保留待完成验证。opaque工作／帧／read票据不可序列化，不是密钥或网络认证；装配必须先验证完整context/lease/凭据，再调用资源模型。

## 设备模型调用

| API | 行为与失败边界 |
| --- | --- |
| beginSession(context) | A7受信已认证context边界；同context幂等，新context清volatile工作/票据/暂存/RAM/read lease并重置命令revision，保留根、未知和held画面；不reboot/重扫，不是wire或认证入口 |
| request(command) | 校验原target字段／单调revision，返回本地work票据。同当前command同内容幂等，异内容冲突；旧revision拒绝。只去重当前工作，不承诺完整wire重放窗口 |
| load(work) | 冻结最后画面，取消当前刷新票据，开始network或flash_ram；旧encoded在覆盖前放弃。cached动作4持Flash stream lease，允许已验证base RAM仍保留一份 |
| supply(work,bytes) | network候选只能提供一次精确长度的私有副本，拒绝超限/缺字节；不自动verified或playing |
| verify(work) | 受信验证器通过后成为verified。回调返回后再核票据/工作集身份，旧结果不覆盖新目标；失败丢候选。Flash stream沿用本次有效root恢复的文件验证证据，不实际解码新帧 |
| prepareFrame(work)／submitFrame(frame) | 至多1个当前frame票据；仅显式刷新完成事件推进playing/actual。重复消费拒绝；新目标/load/save/cancel/reboot使旧frame无效。首帧时间不会因后续提交重置 |
| beginSave(work,{victim_action_id}) | 已验证当前RAM才可写；若root已引用同文件，返回already_saved，不产生新提交或冻结stream。真实写先冻结；没有空位时必须显式提供非保护victim |
| writeSave(work,maxBytes=4096) | 分段写当前私有工作集，1–4096B；部分写不进库存，失败清pending并保留当前root |
| commitSave(work) | 未写满拒绝且可继续；完整字节验证后写对象头／root。成功返回synthetic保存事实；root marker尝试后失败为outcome_unknown，阻止新写，不报失败未保存 |
| cancel(work) | 取消未提交stage、使帧失效、释放RAM/stream；已经发生的saved事实保持，不能撤销root提交 |
| reboot() | 局部generation推进，所有旧票据／RAM／目标／首帧失效，恢复有效root；不重播旧命令、不自动确认idle已播 |
| snapshot/resources/close | snapshot区分desired/actual、held_last_valid维护、保存事实与inventory。close释放所有本地票据/编码工作集和介质claim，数据仍在调用方medium中 |

`accepted`只是资源actor已接纳受信本地请求；没有设备网络回执含义，旧Registry.expect仍只作模拟；A3/A5使用独立观察投影。这里没有physical touch仲裁、租约或真实显示事件，cached4仅验证读资源策略，不能称本地挥手寿命或实体首帧已经接入。

## Flash root、暂存与read lease

medium由调用方持有，MemoryNative360Flash是simulator中的逻辑内存实现。两个root、五个对象分别保存元数据和合成字节；model schema_version/validator_version=1是**模型版本，不是固件V2二进制格式**。没有扇区CRC/marker bit布局、擦写时延/磨损、断电原子性或NVS实现。

每个root有N、sequence:uint64-string、EMPTY/IDLE_READY/OFFLINE_READY及至多4个(slot,generation)引用；对象含N、id/F/bytes、generation和validator版本。恢复完整验证对象后选最高有效root，坏对象/根候选可回退仍完整的旧根，同序列不同引用冲突拒绝；介质I/O错误直接失败，不能装成坏候选回退旧根。两个根均无效时拒绝恢复，不自动格式化。create只允许完全擦空，先0再4形成离线默认集合。

begin/append/commit/cancel只允许一个stage。准备先撤回旧恢复root再复用未被当前引用/read lease占用的对象；不模拟逐个4KiB物理擦除。0/4不能被其他动作替换；显式victim即使还有空引用也必须被尊重/验证。相同ID更新可以原子换引用，旧物理对象在旧lease结束前不能复用。暂存或只提交对象头的残留对象不进入offline_available。

openRead返回不可伪造票据，绑定slot/generation/N/id/F/bytes，最多8个；read返回≤4096B私有片段，releaseRead可重复。root替换后旧lease仍可读退休对象，但该旧F已不在当前库存；若唯一未引用对象被pin，新stage返回cache_busy。close/reboot清票据，旧token不可用于新owner。

root写入并读回成功才发布内存root/保存事实。marker写入后错误可能已经落盘：inventory known=false，写入拒绝。recover要求无pending/读lease；reboot明确失效它们后重扫。恢复读取I/O失败或根冲突也保持blocked（flash_recovery_required），不能用缓存旧root伪装成功。取消不清数据、不自动重试；保存历史receipt与最新root是否仍引用该F是不同事实。

介质claim只约束同一个内存medium对象的单owner，不是跨进程锁或设备端fencing。实际生产仍需现有服务选主、认证/lease及固件Store实现。

## 资源口径、验证与回退

encoded_buffers是**模型保留的逻辑工作集**数量（0或1），并非Node RSS或ESP运行峰值。内存模拟Flash、read副本和验证器会有宿主分配；不能据该计数声称无临时副本或真实RAM准入。模型的显式submitFrame也不是绘制/DMA或面板证明；真实Frame0/运行CRC由未来显示适配负责。

```sh
node scripts/verify-native360-a1.mjs --output .cache/native360-a1/results.json
npm run check
npm test
```

专项35项；多数是明确标注的原创合成验证hook，另有原创真实360/241帧PET4通过已有严格解析/CRC路径及240帧拒绝。CLI只用自有临时监督根／进程组、30秒上限，不创建新listener/凭证。保存去敏用例与清理结果到忽略目录；取消明确失败并删除自有根。

本轮未改runtime/UI/插件或实际服务配置；模块虽随候选构建被复制，未被入口装配。回退关闭模型、释放调用方模拟medium即可，数据格式没有迁移；实体Flash/固件/前瞻与a7、pet/bridge/DSH全部不动。联合G0、A2/A3/A4/G1/G2/真实设备门槛仍未通过。

## A6后续模型对照

[A6](round-pet-a6.md)已在隔离临时TLS/UDS链装配本actor，由完整字节验证、submitFrame和root commit生成A3报告；初始库存/淘汰/故障恢复已对照。未改本actor、不接生产固件；显式model reboot与内存medium仍非物理断电。hub owner重启而设备actor不停机时的revision生命周期和低root回滚维护仍须共同契约，不从原A1纯core35项推导完成。

A7已补[不重启会话边界/显式根检查点候选](round-pet-a7.md)。该方法不批准新context，真实固件的会话权威/任务退出仍待双方确认。
