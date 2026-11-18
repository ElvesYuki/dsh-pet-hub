# PET4分配与核心回执窗口

2026-10-29，已实现于宿主解码、纯core参考模型与离线模拟；真实固件和生产transport未实现这些协议。依据[Spec](../context/plans/resource-replay-spec.md)/[Diff](../context/plans/resource-replay-diff.md)，验证见[报告](../reports/2026-10-29-resource-replay.md)。

## PET4校验与输出所有权

默认Pet4Decoder.decode(frame)仍返回调用方独立的indices/RGB565数组，默认构造仍复制压缩输入，不能通过修改调用方数组篡改decoder状态。decodeLz4新增可选独立输出数组，长度须等于tile，不能与压缩输入共用ArrayBuffer；decoder内部只复用一个width×20 tile scratch。格式边界、重叠匹配、终结字节、头/表/每帧CRC检查保持。

新增decodeInto(frame,{indices,rgb565})写入调用方缓冲，输出须为尺寸正确的Uint8Array且两个输出不共用ArrayBuffer；未提供RGB则不做色彩转换，未提供indices则不复制索引。随机seek仍从12帧关键帧重建，失败使缓存历史位置失效。返回引用是调用方缓冲，本接口不承诺快照不可变；默认decode保持原独立快照语义。

readRegular按可信上限内的stat长度分配一次，分块填满并额外探测一个字节，短读/增长拒绝；保留路径、链接、文件类型、长度及SHA校验。它不是同用户恶意目录替换的openat沙箱。

inspectPet4默认hashes=true/player=true：复用一个indices和一个RGB缓冲完成全帧诊断摘要，保留按需player；frame仅用复用RGB做当前帧摘要，pixels分配独立RGB输出以便转移。转移像素ArrayBuffer不会使player复用缓冲分离。

worker固定在build使用hashes=false/player=false、prepare使用hashes=false：两者都完整读取并校验文件SHA、头/表/tile和全部帧CRC，以及实际几何/fps/frames；build只留下元数据，不留下已校验资产decoder。省掉的是从未作为worker准入依据的整段indices/RGB诊断hash和瞬态色彩分配，不能据缓存存在跳过CRC或信任旧校验。独立审计默认仍生成全段摘要。

内存资源仍是采样：worker数≤4、文件≤8MiB不构成整个Node进程32MiB上限；V8、压缩输入副本、当前帧、base64及线程分配器仍占用内存。新进程同探针对照没有强制GC，具体数字与波动见报告。

## 命令窗口与设备高水位

DeviceModel在当前lease内保存最近256个成功command_id/完整内容FIFO。窗口内同ID同内容只返回当前snapshot，不重新下载、提交或计时；同ID异内容idempotency_conflict。FIFO访问不刷新顺序。窗口外命令先校验身份/会话/lease与素材，再比较uint64 revision，高水位以下/相等均stale_revision，不因回执淘汰而重新执行。

desired、actual、started及四槽保护独立于回执表，淘汰历史不能擦除实际播放或目标。新lease才清命令窗口/高水位；原lease消息仍必须过epoch、session及精确grant校验。boot变化清瞬态状态。窗口外复用旧ID并携带新合法revision属于新请求，无法永久识别ID冲突；命令生成器必须使用唯一随机ID。不承诺无限期exactly-once或设备持久掉电去重。

IntentScheduler同样保留最近256个成功意图回执，已有缓存命中不再改模式/修订；淘汰后以当前expected_revision CAS拒绝旧意图。服务simulation外层最近128条窗口仍保留，并在调用scheduler前先检查当前设备CAS，防旧内层命中导致再次dispatch。

## acquire与session回收

acquire只保留最近一次成功操作的原expectedEpoch和当前grant。相同session/operation_id但不同expectedEpoch为idempotency_conflict；同内容且grant仍有效，返回同一grant，续租同步更新该回执，不重复持久写epoch。过期/释放后的回执不能复活授权。

新成功acquire先提交control_epoch，再替换唯一回执；提交失败保留原状态和可恢复回执。已被新操作取代的旧acquire还要过当前epoch，原expectedEpoch已过期，不能复活原lease。持久撤销回执及binding_epoch不是可淘汰缓存，本轮没有清理这些状态。

认证session上限仍16；新增session到上限时，淘汰最早进入表的非活跃lease拥有者session，当前活跃owner保持有效。认证失败不淘汰任何项；旧session上下文变成stale_session。连接现有同instance会话仍按原语义建立新session并使旧上下文失效。此策略不授予未认证发现候选权限，发现128/绑定64上限保持。

## 有序触摸与兼容限制

新增纯core调用touch(event_id,duration_ms,event_seq)，event_seq为规范uint64字符串、可从0开始，归属于经过认证/校验的输入会话。第一个有效触摸选择sequenced或旧legacy模式，实例内禁止混用；不能靠省略seq绕过高水位。

sequenced保存最高event_seq和最近256条ID/seq/duration回执：

- 窗口内同ID/同内容返回false，不重触发；同ID异seq/duration冲突。
- 窗口外seq不高于高水位返回false，包括乱序、未知旧ID及重复事件。
- 新seq即使处于1秒冷却内也推进高水位、记录为已处理，然后返回false；其迟到重试不能在冷却后再次触发。
- 被接受触摸暂时覆盖目标，结束回最新手动/自动意图；保留原30秒时长上限。seq到uint64最大值后不能回绕，须由新输入会话按后续协议恢复。

当前没有真实输入承载或设备event_seq；适配器以后必须先拒绝旧boot/session，再调用此接口，不能把不可信旧消息赋新seq。本轮不定义安全重置同实例高水位的入口。

旧touch(event_id,duration_ms)没有新鲜度信息，仍保留最多256个不同已接受ID，满时capacity_exceeded且不丢历史。它无法安全FIFO回收，不将该兼容入口称无限期耐久；迁移需新scheduler/可信输入会话，不静默升级或切模式。

## 可观察计数与模拟历史

内部DeviceModel.resources返回session数、acquire/command回执数、命令高水位和cache槽数；Scheduler.resources返回意图/触摸回执数、模式和事件高水位。不返回凭据、grant、网络或任务正文，本轮未新增公网/UI端点。

VirtualClock默认仅保留最近1024条timeline，构造可显式选择0–65536；FaultQueue同样保留最近1024条诊断事件，待投递队列上限仍1024。historyStats报告recorded/retained/dropped；FaultQueue另报pending。截断只影响诊断历史，不能删除待执行消息、改变时间或业务高水位。S1短清单保留原完整证据，长测报告只能声称近期窗口。

## 验证与回退

npm run check、npm test、npm run test:sim；scripts/stress-role-resources.mjs做50次换包/500帧同参数对照；scripts/stress-core-replay.mjs做双设备三天虚拟时间、17280命令/意图/有序触摸及1200次acquire，只有SIM1合成素材，无socket/worker/真实设备。真实PET4复验仍需显式许可/可信摘要并用临时副本。

回退停止独立探针并撤回本轮代码，不自动删角色指针、绑定或用户素材；无持久数据格式迁移。所有真实集成仍需另备具体方案与回退，不能把虚拟三天等同墙钟或固件耐久。
