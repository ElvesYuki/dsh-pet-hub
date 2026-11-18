# 400-01 离线身份与严格导入

2026-11-02。[Spec](../context/plans/native400-01-spec.md)/[Diff](../context/plans/native400-01-diff.md)、[报告](../reports/2026-11-02-native400-01.md)。400是后续主线；旧尺寸入口只保留备份回退，不再扩展。本文实现到离线来源/metadata/仓库/预览，未实现400设备能力、wire、持久Flash或正式listener。

## 分域与闭合recipe

| 域 | 确切含义 |
| --- | --- |
| F | 完整PET4原字节SHA；长度、全部LZ4/CRC/索引/RGB与实际frames仍须核 |
| source | manifest.json原字节SHA；包含原有浮点误差/时长，不重排后冒认原身份 |
| source_index | source-index.json原字节SHA，即所选宿主all78 index；不等于新I/M |
| M_host | 原package_schema=2宿主manifest canonical SHA，含loop/语义；仅是输入身份 |
| M_device_candidate | 新最小catalog canonical SHA；含pet4_profile/400显示/78 F/bytes/license，不含PC循环策略 |
| P_candidate | 新package.content canonical SHA；包含M的内容、78实际timing/index/RGB/extra、来源两SHA、语义及候选N/scope/profile |
| I_device | 新生成index原字节SHA；C(index)＋一个LF，不能与source_index/M互换 |
| N_offline | SHA(UTF8(round-pet/whale/native400/pet4/tile20/key12/offline-v1))＝dd0f19bfdc4bed608ddf18baf095fd6c8b53217bbb59d8f0238e51460e2c0ff8；仅离线候选 |

身份profile=round-pet-native400-offline/1、namespace_scope=offline-candidate，hash_recipe=pet-package-native400-v1-canonical-json。源媒体profile仍native400-candidate-v1；它们不是未来设备wire或能力schema。共同字段firmware_package_sha256此处存**管理端候选P**，不是固件已导出的包/已认可身份。正式N/Store geometry/validator仍待固件确认；不复用360 dfc829e1…或早期fixture 5dd9df30…，不写设备缓存。

content字段闭合：schema_version、profile、namespace_scope、namespace、catalog、media_profile、timing、semantics、source_manifest_sha256、source_index_sha256。catalog字段闭合：character_id/variant_id/codec/pet4_profile/display/actions/license_ref；action仅id/bytes/sha256。media_profile固定PET4/flag1/key12/tile20/fps24/frame_limit241/extra_keyframes=true；timing按ID0–77原序，含id/width/height/fps/frames/index_sha256/rgb565_sha256/extra_keyframes，42必须118/其余241，不能自动补帧或重排。语义0/4/1/11/43/58/7/55保留。

C复用A2受限UTF8 canonical：ASCII对象键排序、数组保序、安全整数、无BOM/尾LF，拒绝重复解码键/孤立surrogate/浮点别名。原source可包含有限浮点，由有界重复键拒绝parser读入，只抽取整数规范字段；原始source SHA进入P。source字段未知扩展亦改变原字节SHA/P，不忽略来源变化。catalog.json的sha256与360相同沿用导出**P**约定，hub manifest.sha256才是新M。

## 主入口和独立用途输入

- `reviewNative400Source(sourceBytes,indexBytes)`：只返回候选package/catalog/identity及M_host，不产生approval、文件或CAS。只接受完整compact-approved/1及对应all78目录，核对几何/视觉引用/78逐项F、长度和实际时序，不接受role8代全库；视觉引用在这里只是来源约束。
- `createNative400Import(runtime,{sourceDirectory,approval})`：400主入口。来源目录只读包含manifest.json（原compact）、source-index.json（原宿主）、package.json/catalog.json（候选转换结果）、0.pet–77.pet。调用者负责准备独立快照，不能向已批准原素材目录自动写生成物。
- `createNative400Import(runtime,{cachedOnly:true,indexSha256,approval})`：重开依旧需要独立受信approval，不能采用ledger自带批准；原source可不存在，但CAS内容/新record/批准/索引都重新验证。

approval闭合14字段：schema_version/profile/namespace_scope/namespace、firmware_package_sha256/hub_manifest_sha256/source_manifest_sha256/source_index_sha256、action_ids/license_ref/approval_id/credits/source_kind/usage。只支持offline-validation、精确78 IDs及匹配候选N；source_kind为original-test或reviewed-upstream。真实角色的审阅责任/日期/传播范围放独立审阅记录，不能伪填用户或向闭合schema塞字段。本轮仅原创fixture创建original-test批准，真实compact仅算候选，没有reviewed-upstream批准/导入。

视觉批准、来源provenance、哈希相符、MIT代码和文件存在均不能替代该用途输入。商业/生产scope拒绝；内部审阅不要求作者逐次另行授权，也不扩大非商业/署名/SA范围。旧360 API缺省仍360，只作备份；传400批准/记录给旧入口会拒绝，新的主线使用明确400入口。

## worker、恢复与实际退出

复用原A2一个worker、流式配额/保护/临时阶段/CAS、每blob fd指纹证明。主线程先验证显式profile/用途/来源，worker再次按同一profile重推来源，结束前再读来源；不从包/账本自行猜profile。新record recipe=round-pet-native400-provenance/1，与360 record区分。blob去重只省重复解码，每个源文件仍读核F；同F后续动作仍核frames/index/RGB/extra全部承诺，不能凭旧proof跳过。每个资产全帧解码CRC和拼接index/RGB SHA，允许额外tag0，按需frame/pixels支持117末帧。

ready在完整worker验证、CAS发布和非覆盖provenance后才完成。CAS/ledger仍两次提交；ledger失败可能留下普通未批准CAS，不可用于可信重开。相同I不同provenance/approval拒绝覆盖，未提供跨批准自动迁移。close可重复调用，等待worker实际退出并释放阶段/预留/catalog pin；缓存与已发布ledger不因关闭删除。离线预览帧不是设备playing/saved证据。

## 验证与后续

30专项/固定原创golden见报告，包括360/400和摘要换域/未知字段/源变更/损坏最后帧、RGB/extra去重复验、quota/关闭/坏blob与账本自批准拒绝。执行：

```sh
node scripts/verify-native400-01.mjs --output .cache/native400-01/results.json
npm run check
npm test
```

下一400-02窗口能力/执行与渐进完整性选择；400-03新wire和400-04装配不在本轮。全库真实导入须对应独立用途输入，不从本报告生成批准。回退关闭自有worker/临时根，撤回显式400策略；旧尺寸源码/旧CAS/原批准/媒体保留备份，不改N/分区/设备/外部配置。
