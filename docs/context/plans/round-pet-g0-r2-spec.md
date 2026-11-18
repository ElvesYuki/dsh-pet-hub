# G0-R2 首窗口策略、取消 gate 与未知保存恢复 Spec（实现前）

2026-10-30。已读AGENTS/README/当前摘要/待办/规范、G0-R1交接和A1/A5/A6实际代码。保留已有与并行修改，不用子智能体。只原创模拟媒体、虚拟时钟、自有临时存储/PKI/loopback，不访问设备或固件/pet/bridge/DSH，不启生产listener/插件，不提交推送。

## 范围及选择

1. 新增纯core首窗口策略：远端仅0/11且命中同N/id/F/bytes的可信当前OFFLINE_READY库存；remote4标触摸专用，其余未开放。首窗口拒绝所有保存/下载准备，不以UI隐藏代替入队/派发门禁。A5内部显式executionProfile=first-window-review/1启用，缺省通用46候选保持；该选择进入选主身份，不新增CLI/IPC/生产开关。提供内部manualChoices供后续UI消费，不声称本轮已接可操作管理UI。
2. 有界离线策略模型：当前完整context/control、一个latest base、一个本地token/序列/首帧起点。physical4优先、重复触摸新token/寿命，首帧匹配ACK后计241/24秒；base更新不重置本地时间，结束回最新且session/lease/库存仍有效的base，否则idle0。旧context/低revision/旧token/乱序触摸、租约边界、回退时钟拒绝或失败关闭。没有真实触摸监听/认证来源或新wire。
3. 复用A1唯一Flash模型，增加显式gateCommit/actor gateSave：完整payload后进入不可取消提交区。gate前取消清暂存、不发root；gate后取消不回滚事务，只使旧播放任务失效，允许原保存最终saved或outcome_unknown。保留legacy同步commit入口及A1–A10行为，新增门禁禁止gate后append/替换任务/伪造gate；无第二存储实现或字节格式迁移。
4. 增加actor受信recoverStorage：清瞬态/旧frame/load票据后，在唯一owner、无pending/read lease时用既有完整根/对象验证恢复。marker尝试/读回错误保unknown；候选I/O失败不当作坏根而降级。恢复只给完整库存，不补历史saved、不恢复控制/旧播放；A7/A8 authority仍拒绝低root/同seq冲突，不清floor。缓存命中通过库存说明已有可用，不制造“本操作新提交”；R2离线适配显式选择该行为，旧A6通用fixture不作生产语义迁移。

## 验证与失败边界

- core：0/11允许/4及其余拒绝、缺库存/错F/缺默认保护对象/超期拒绝；manualChoices副本。context变更/旧grant、重复与乱序revision、触摸首ACK/重复/迟到/精确到期/latest/失效回idle，状态有界且不发remote4。
- gate：未写完拒绝且可续写，gate前取消/已入gate后取消但marker前完成/marker后取消/读回未知，旧frame不复活；旧/伪造gate、重入、gate后append/替换/恢复拒绝，commit失败不推进投影。
- 恢复：before/after marker与读回故障、恢复读错/确证坏候选、同/低root与floor、丢saved仅库存、缓存命中无新saved、退出不擦介质、读租约保护。模型故障不冒充物理掉电或固件Store结果分类已实现。
- A5显式profile下通过临时UDS/真实loopback TLS验证门禁、dispatch前重新核库存、0/11缓存首帧、未知库存/失败关闭、不同profile attach拒绝；通用A5/A6既有回归保持。离线本地触摸/取消对照可用小合成模型，真实TLS不证明RTOS互斥/退出硬上界。
- npm run check（仅.mjs语法）、npm test（含构建），新增独立专项监督CLI正常/SIGTERM清自有环境，无部分成功。数量以实跑为准；不扩大到真实素材/长期内存/浏览器或设备。

## 输出与回退

API/报告/C01–C12/基线/当前摘要和待办同步；归档被替代的R1“R2未实现”记录，保留R1身份/许可及并行400候选。下一G0-R3仍须完整字段/错误/Node-C++golden、用途批准和固件G1/G2，联合G0未关闭。

关闭自有peer/server/worker/owner后删除临时根；撤回显式profile/局部门禁即可，无持久配置/文件格式/媒体/N/TTL迁移。生产通道持续关闭，不能自动切到通用候选绕过限制或恢复外部A/B中断现场。物理提交gate原子同步、可信时间/凭据、维护让出/硬时延和正式UI/wire仍待另行实施/验证。

实施状态（2026-10-30）：按本Spec/Diff完成，35专项/784全套、check与独立CLI正常/SIGTERM清理通过；[报告](../../reports/2026-10-30-round-pet-g0-r2.md)列实现/未覆盖/源码SHA。原R1未实现摘要与R2待办已[归档](../history/round-pet-g0-r2-evolution.md)。真实UI/wire/固件适配、独立许可批准/G1/G2/设备窗口保持待验；无外部配置/设备变更。
