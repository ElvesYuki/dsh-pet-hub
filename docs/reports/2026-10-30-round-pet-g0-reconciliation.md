# G0-R1 共同契约与真实素材复核报告

历史范围说明（2026-11-02）：本报告保留R1当时的A/B中断现场及原声明503事实；[后续证据核定](2026-11-02-round-pet-g0-closure-review.md)已只读更新为400窗口恢复原cbdf、补齐原作者声明/CC官方原文，并确认正式360身份保持。其余宿主模型/承载进展以当前摘要为准；内部用途批准、联合G0与G1/G2仍不能由此报告推导完成。

2026-10-30。先补[Spec](../context/plans/round-pet-g0-reconciliation-spec.md)/[Diff](../context/plans/round-pet-g0-reconciliation-diff.md)，再只读核对固件最新资料/代码/来源及真实媒体。更新后的[差异表](../context/round-pet-hub-baseline-alignment.md)、[C01–C12交接](../context/plans/round-pet-g0-handoff.md)和[复核向量](../protocol/vectors/round-pet-g0-real360-review-v1.json)是交付入口。**身份核定完成，许可/用途批准与联合G0未关闭。**

保留已有/并行修改，不用子智能体；无生产代码更改、固件脚本导入/执行/构建、真实设备/串口/烧录、生产listener/插件安装、服务调整或Git提交推送。不读取运行凭据/网络配置；只读已安装pet的46源素材字节，不调用pet状态或写接口。

## 最新外部事实与冲突处理

读取固件HEAD9816317ae5ac6f86c982ef773461de595f407747和24份选定文档/源码/导出文件SHA，前后重核均保持；含指定baseline/单设备Spec/Diff/current-status、新G0 reply/输入、G1-lite/内存报告、实际设备目录Store/播放器/策略/HTTP、媒体recipe/来源。旧固件G0 SHA多指迁移前路径；本轮按实际新路径/内容核对，不将旧HEAD/报告内hub469或385项当本工作区现状。完整路径/摘要在复核向量，未修改固件仓库。

最新current-status顶部和缓冲A/B Spec说明：A/B被400离线任务中断，最后核对cbdf3169…维护候选及临时端点，未恢复67；A已做准入/联网待机，缓存切换/点击及B未执行，串口owner关闭。矩阵下方和其他旧入口仍称“当前67”，与顶部不一致；本轮按该矩阵自身的最新中断说明限定引用，**不再把67写成当前驻留**，也没有新读设备。67仍为P3播放性能基线/恢复目标，a7精确回退及窗口前完整7680…归档受保护。当前现场恢复/服务收尾属于另外的授权窗口，本任务不触碰。

fc55 G1-lite曾联网60秒准入通过，缓存挥手后SDK历史内部低水位46527B＜49152B而停，下载/保存尝试0；后续A/B中断不能补成完整G1通过。SDK区域历史低位之和不是同刻全局最低/泄漏证明。G2 TLS最大块/峰值/新栈、可信时间、持久秘密/epoch/撤销和有限清理仍未知；旧P3内部59035B或loopback样本均不准入。设备和运行服务的实时状态仍需未来授权窗口重新冻结。

## 真实素材身份：独立读取结果

输入为既有native360-production/assets/manifest.json及全部46个.pet，platform-evolution/hub360/{package,catalog}.json；只读，不运行固件导入器/解码器。源视频来自已安装pet公开assets/webm，未复制视频或PET4到本轮输出。固定上游86181ce提交的[webm目录元数据](https://github.com/PC2005-cloud/dsh-pet/tree/86181ce1660a57ab27336630bab5b344de71b28c/dsh-pet/assets/webm)由GitHub只读连接取得，匹配所选46个文件的git blob身份。

| 域 | 本轮独立结果 |
| --- | --- |
| P=SHA256(C(package.content)) | 3afe4578cba08cd036c70483befaca1324e1d62e76649ace5557a758e0aef754 |
| M=SHA256(C(content.catalog)) | 9045bd6b99b365a86e3adf3762bebb635984d4839f6c203c7a9cf7c13b05299d |
| N=SHA256(固定identity UTF8) | dfc829e13e7c25d732ae0c0afd011f1232419e603ba06c225104645ea668bdf6 |
| 源manifest原字节SHA | a6a2ddae50a8fe4ddf15ff07a3a228dccf865bb91a037693ce0a72232204c39e |
| package.json原文件SHA（不是P） | c76f476c25d70bba9d4600ed0b38ac788ed688ad437a86dba7313dceb7d6fbbd |
| catalog.json原文件SHA（不是M） | 73e4c86132737819fdb3ee1faf160d6e751b8ae14859a2688a2f8d0564313771 |
| F/时序/索引 | 46文件225509627B，最小3653610B/最大5742845B；全部360²/24fps/241帧/flag1/key12，11086帧CRC及index SHA匹配导出/manifest/固件快照 |
| 源视频身份 | 46源共20443172B；SHA256逐项匹配manifest，git SHA1(blob header+原视频字节)及长度逐项匹配固定提交目录；不把git SHA1当PET4的F |

原ID清单（固件既有编号，不新编序号）：

```text
0,1,4,5,6,7,9,10,11,13,16,17,19,21,24,25,26,27,28,29,30,31,32,34,
36,38,39,43,44,47,49,50,51,52,55,58,59,62,63,64,70,71,73,74,76,77
```

C沿用A2受限JSON规则：UTF8无BOM、对象ASCII键排序、紧凑无尾LF、数组保序/整数/合法Unicode，不额外trim/NFC。package/canonical/catalog逐项一致，catalog.sha256原意为P，不是M；语义0/4/1/11/43/58/7/55保持。原始source SHA与C摘要分开；I仅在实际index生成/导入时有意义，本轮不造I/批准记录。V2 root只用原N/对象身份，不改格式/分区。

独立媒体验证复用管理端verifyRoundPetAsset/Pet4Decoder，每文件只保一个decoder/工作缓冲，不保全库帧；SHA/长度/头与全241帧LZ4/XOR/CRC/index均重验。视频只核原字节/固定git对象，未重跑FFmpeg、未重新编码或比较源视频到PET4的逐像素转换；“无损”仅对应既有量化索引链，不能扩成源视频无损。原360 recipe的365裁区/Lanczos/333遮罩未改；400/78和分层素材不替代本库。

只读审计成功约6.84秒，之后又读核46 PET4/46源视频及三份元数据摘要保持；不复制媒体到Git/dist/CAS。9项负例/域关系检查：缺独立approval拒绝、重复JSON键/浮点别名/孤立surrogate拒绝、动作数组反序改变P、改license_ref改变M/P、改语义改变P但M不变、源空白改变source SHA、伪造F匹配坏帧仍被CRC/格式拒绝。它们是本轮临时审计检查，不冒充新增npm专项或Node/C++wire测试。

固件输入capability_values_candidate只给资源数值，没有protocols/firmware_version/board_profile，不能直接作为完整hello。审计明确验证其不能直接通过capabilities；为核几何时仅补虚构audit_only身份/协议封套，**不是实际设备能力报告**。固件输入快照含路径键，不属于包canonical受限域；按文档JSON读而非当可导入package。全程没有为真实包生成synthetic approval或调用roundPetMetadata批准成功路径。

## 许可证据与待核验

- 本仓库新代码MIT、固件仓库Apache-2.0、固件现用LZ4 BSD-2-Clause仍分别成立；本轮只读原许可，没有复制上游实现/引入依赖。
- 固定提交的[README许可段](https://github.com/PC2005-cloud/dsh-pet/blob/86181ce1660a57ab27336630bab5b344de71b28c/README.md#许可)及[代码LICENSE](https://github.com/PC2005-cloud/dsh-pet/blob/86181ce1660a57ab27336630bab5b344de71b28c/LICENSE)已重新读到：发布者区分代码与动画/提示词/源视频，后者限制商业用途；公开衍生需标源仓库，形象引用CC BY-NC-SA 4.0及上善无形/ZipZipPipe。固定README UTF8 SHA20bfd7f6d1b588fe34048bbb7a4379e8a8bfaa9b2651b29639d8195a0115a3a0，与旧审计一致。
- 原始形象[B站声明](https://www.bilibili.com/opus/1247156596114456581)和[CC官方条款页](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans)本次只读网页工具返回503，未直接读到；上面形象授权只按固定上游README的转引注明，不能写成已独立取得原作者声明/新法律授权。相关页面内容与具体设备使用/传播范围需补原文证据；不自动扩成商业或再分发许可。
- 当前包license_ref是upstream-reference-only，来源/字节真实性可复核不等于用途批准。**本轮不创建A2独立approval、不真实导入或分发全包**，也不把复核JSON当批准。后续应记录审阅人/日期、用途offline-validation、原文证据、署名/变更/传播约束和精确(P,M,N,source,IDs)；若改license_ref必须重新算M/P再审。商用/公开分发/新角色范围另审，不凭本仓库MIT覆盖。

## 契约决定与实施缺口

C01资源/几何/保护与C02真实字节身份确认，C03信任边界/有界metadata、C04状态轴、C06首帧/维护、C09单owner/有界调度及C12新旧互斥方向一致。管理端本轮选固件C05保守方案：首窗口远端0/11、physical4本地优先单次，remote4暂禁。该选择不是已经实现的gate/UI；A4/A5当前仍允许46目录。

C08采用“取消准入gate”和“持久root marker”两个点；现commit内部不可取消，marker可能写入或后续确认失败须unknown，recover bool不能证明未知消除。写预算纠正为启动内固定易失窗而非滑动/跨重启限额，5秒从load完成起且需已呈现/非local，不是首帧后严格5秒。这些是后续适配需求，本轮未改A1/A6模型、固件Store或现有回执。

C07仍有明确字段差异：A4路径/profile为/offline-round-pet/v1和round-pet-pull-candidate/1；提案正式/hub-device/v1及native360子profile不是换名即可兼容。候选playback.set无mode/asset_descriptor，report无deferred_local字段/touch流，storage取消独立事实尚缺，exchange用request_seq而非提案heartbeat payload。错误码/HTTP映射、可重试分类、完整能力扩展/序列/最大报文与Node/C++正反字节golden待共同选择。

[交接表](../context/plans/round-pet-g0-handoff.md)已逐项标明设计一致、已实现/未实现及责任，没有将部分答复升级为联合G0关闭。下一：离线G0-R2首窗口policy/触摸/latest/失效及取消gate/unknown恢复对照；G0-R3正式字段/错误与双端golden；真实库独立许可/用途批准后再A2导入/恢复。必须等待固件G1/G2资源证据与另行设备窗口，才可准备G3/4。不发送消息或修改固件交接文件。

## 验证、保护与回退

npm run check通过（仅.mjs语法）；npm test含构建**746/746**通过，0失败/取消/跳过，约89.56秒。数量包含当前工作区并行400/78素材切片，不将A10的730项历史报告改写为本轮新增16项。没有新增生产/测试实现；本轮9项审计、46全媒体/源blob检查单列。没有重跑长时内存/浏览器/设备/固件构建或C++互操作，不把本机速度当端侧最坏延迟。

临时审计脚本、公开README/目录元数据和去敏结果只在忽略.cache/round-pet-g0-r1；媒体仍在原只读目录。无本轮新增listener/worker/常驻子进程/凭证或未完成I/O。check/test自有临时服务由现有fixture清理；既有A/B服务/端点不碰。回退仅撤回本轮文档/复核向量或删除自有忽略输出，无外部运行/格式/批准迁移，不能为文档回退操作设备。

## 定位与上下文

复核向量保留46动作F/源SHA/git blob/索引、P/M/N/源/导出原文件SHA、24份证据SHA，无素材/配置/凭据/本机端口。当前系统/待办/基线/提案/第三方边界同步更新，旧G0快照与完成待办[归档](../context/history/round-pet-g0-reconciliation-evolution.md)。主要实现仍未跟踪，HEAD不能复现完整工作区；本报告不改变该Git状态。上游代码/动画许可与本仓库MIT分开。
