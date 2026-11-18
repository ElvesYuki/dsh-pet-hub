# PET4内存与核心回执回收离线验证

2026-10-29。先补[Spec](../context/plans/resource-replay-spec.md)/[Diff](../context/plans/resource-replay-diff.md)，实现[分配与回执契约](../protocol/resource-replay.md)。保持离线：无设备、烧录、插件安装或提交推送；未写固件、pet、桥接或现有DSH配置。已有工作未回退，私有状态格式不变。

## 实现结果

PET4 decoder内部复用单个tile scratch，新增调用方decodeInto缓冲，默认decode仍独立输出、仍复制压缩输入。默认完整审计复用索引/RGB缓冲；worker build不保留player、不生成无需用于准入的整段色彩摘要，prepare保留单动作player和复用当前帧缓冲。文件SHA、头/表/tile/每帧CRC、几何/帧率/帧数检查保持。pixels输出为独立数组，转移不分离内部复用缓冲。

readRegular改为按受限stat长度单次分配、分块填满并探测多余字节，保留链接/类型/长度及摘要边界。审计脚本明确player=false，避免新增pixels闭包进入records后持有整库decoder；没有跨版本免验缓存、强制GC或放宽格式检查。

核心命令/意图回执为256条FIFO，高水位独立保留，淘汰后旧revision仍拒绝；actual/desired/槽保护不受回执淘汰影响。acquire仅保留一条最近成功操作和原expectedEpoch，续租更新它，持久写失败不替换；同操作改expectedEpoch拒绝。16个认证session满时只淘汰非活跃lease拥有者的最旧项，旧上下文失效，当前owner不受影响。

新增sequenced触摸event_seq高水位与256条窗口，冷却内新事件也消耗序号，迟到不能绕过冷却。旧无seq调用保留256上限并失败关闭，不能混用模式；没有真实输入承载、固件seq或可信高水位重置。模拟时钟/故障历史有界，保留近期1024条及dropped计数，未改待投递队列上限或绑定/发现容量。

## 校验结果

npm run check、npm test（含候选构建）通过：149项，无失败/跳过，新增12项；npm run test:sim通过SIM-01–30及4补充，忽略目录证据更新。

| 新增验证 | 结果 |
| --- | --- |
| 3000命令 | 回执256，旧actual/槽保留，窗口内重复不重置，淘汰旧revision不下载或计时 |
| 2000意图 | 回执256，旧CAS拒绝，缓存重放不改模式，异内容冲突 |
| 600次acquire | 回执1，epoch/持久写准确，提交失败保留状态，续租后重复可恢复，旧epoch不复活 |
| 60个认证session | 保留16且活跃owner有效，淘汰者stale_session，认证失败无淘汰 |
| 1500个有序触摸 | 回执256，高水位递增，乱序/冷却重试不触发，异内容/模式绕过拒绝，uint64最大值不回绕 |
| 无序兼容入口 | 256后明确capacity_exceeded，原ID仍去重，不不安全地丢历史 |
| 诊断历史 | 5000次时间推进/10000事件仍仅保留所设窗口，队列1024及安全整数溢出约束不变 |
| PET4缓冲 | 随机seek/默认独立快照/复用输出/像素转移后再读一致，错误输出长度拒绝 |
| 完整帧检查 | 重算文件SHA仍无法掩盖最后一帧CRC损坏，诊断/worker验证模式都拒绝 |
| 文件读取 | 跨64KiB边界准确、大小/链接违规拒绝、空文件处理一致 |
| 模拟装配 | 650次手动命令+时间推进继续播放，淘汰的旧意图不重放 |
| 耐久探针回归 | 短参数运行仍保留256窗口，换lease后清命令窗口、保留一条acquire回执与actual |

生产transport没有上线；计数来自参考模型，不等于设备持久exactly-once保证。

## 同参数资源对照

Node24.14.1/npm11.11.0、独立新进程、原创240/360几何PET4各13帧，使用同一扩展测量版stress-role-resources脚本：50次角色替换/500次取像素，5ms准备期采样及逐帧采样。未启用--expose-gc或调整运行服务。测量版只增加ArrayBuffer/耗时/收尾RSS观测。

| 指标 | 优化前 | 最终回归 | 解释 |
| --- | --- | --- | --- |
| 进程RSS采样峰值 | 350306304B / 334.08MiB | 242319360B / 231.09MiB | 本轮单组下降30.8%，不是硬上限 |
| 活跃worker最近ArrayBuffer样本和峰值 | 190904765B / 182.06MiB | 55388358B / 52.82MiB | 下降约71%；为各worker最新回包样本和，不是同步精确峰值 |
| 关闭后进程RSS | 333889536B / 318.42MiB | 223887360B / 213.52MiB | 分配器/主进程仍占内存，没有强制GC |
| 探针墙钟耗时 | 5346.74ms | 4819.26ms | 单机单轮，不能称FPS或吞吐保证 |
| worker峰值/退出 | 4 / 0 | 4 / 0 | 基础导入+A/B+候选；无本次stage残留 |

本轮早期不带新指标的优化前进程曾约398.9MiB，优化第一轮约204MiB；历史报告约345MiB。波动说明不能只选最低样本，也不能将回执/线程有界解释为总RAM≤32MiB。此处采用同测量版的一组完整结果，RSS仍需长时间、更多规格与独立应用/宿主共存测量。原报告：.cache/pet4-audit/resource-before-instrumented.json、resource-after-memory.json、resource-after.json。

## 三天虚拟核心耐久

新增scripts/stress-core-replay.mjs与仓库专用simulator/replay-endurance，完全无socket/worker/动画素材。两个独立device actor、参考Registry/Scheduler/MemoryStore及可信认证fixture，共用一个可控虚拟时钟。

- 推进259200000ms，恰好3天；共17280条命令、17280意图和17280个有序触摸，最后再1200次acquire。
- 每设备命令高水位8640，命令阶段回执256、意图/触摸各256；旧命令不能因淘汰再次执行。最后换lease清命令窗口，acquire回执维持1，actual和两槽缓存仍保留。
- 每设备最终持久写601次（初始acquire+600次新获取）；同操作重试没有额外写。续租不写持久层。
- 时钟推进历史记录51840条、仅保留1024、丢弃50816；不保留逐步完整日志。各设备session1。

结果在.cache/pet4-audit/core-replay-endurance.json；墙钟约2秒，不能扩大为3天实物/真实播放/RSS耐久，也没有独立host/device时钟或Flash掉电模型。

## 真实360格式回归与边界

只读已审核非商用源，manifest SHA a6a2ddae50a8fe4ddf15ff07a3a228dccf865bb91a037693ce0a72232204c39e，许可仍dsh-pet-nc-86181ce及形象CC BY-NC-SA，详见[原许可核对](2026-10-29-pet4-offline.md)。未执行外部Python、复制上游代码或把动画加入Git。

完整46动作225509627B/11086帧经worker校验、激活和实际frame2的259200B RGB565摘要核对通过（9a3c519ff2662ccbd5bb7ba5888a3ea8f31e9c471a2edb7e7459ae36d124cfa6）；保持/回idle/取消/保护回归通过。1108次status最大约7.70ms，非性能承诺。另默认诊断hash开启、player=false的全库审计通过46动作11086帧，与源每动作index_sha256交叉一致。

原始报告在.cache/pet4-audit/resource-real360.json和resource-audit360.json；临时副本/CAS/worker已清理，仅保留忽略目录元数据与摘要。本轮界面契约未改，没有重新安装DSH或重做浏览器；上一轮画布证据仍适用。

## 后续入口与回退

已解除当前命令/意图/acquire的终生256上限，有序触摸和诊断历史已可有界回收；无seq旧触摸仍需迁移方案，发现/绑定容量不应当作普通缓存自动删除。还需墙钟长期RSS、独立双时钟/断连收敛、真实认证与v5迁移/Flash故障验证；当前约231MiB样本仍非产品内存包络。

下一轮先补独立双时钟和消息延迟/断线收敛Spec/Diff，并规划墙钟内存测量窗口；真实接入仍需具体方案及回退，资源认证门槛不变。停止独立探针即可撤销本轮运行效果；代码回退只撤回本轮改动，不自动清空用户角色指针、素材库或绑定状态。
