# 400-08 N_boot只读来源映射

2026-11-03。[Spec](../context/plans/native400-08-spec.md)/[Diff](../context/plans/native400-08-diff.md)、[报告](../reports/2026-11-03-native400-08.md)。只读审阅调用方明确选中的PC文件；没有设备、listener、IPC/插件装配或Flash写入。N_boot已在固件报告安装与hub正式N是否共同采纳是两件事，400-01/03原profile/scope/字节保持。

## 输入与独立批准

`createNative400BootstrapInspector({package,catalog,approval,mappingApproval,hash})`是pure core工厂，先复用native400Metadata重推候选P/M/原N_offline/源SHA并核独立400-01用途批准，再核新的mappingApproval。包/文件/账本不能自行批准其内容；没有从源文件搜批准、自动迁移scope或真实角色用途生成器。

mappingApproval闭合15字段：schema_version=1、profile=native400-bootstrap-source-review/1、usage=offline-source-review、namespace_boot、namespace_offline、firmware_package_sha256、hub_manifest_sha256、source_manifest_sha256、source_index_sha256、action_ids=[0,4,1,11]、approval_id、candidate_approval_id、license_ref、credits、source_kind。后四项来源许可/审阅关联须精确对应独立candidate approval；production用途、空credits、未知字段、P/M/N或源SHA换域拒绝。这里的firmware_package_sha256仍是管理端候选P，不改成固件cache镜像SHA。

| 身份 | 本片含义 |
| --- | --- |
| N_boot | SHA256(UTF8(round-pet/whale/native400/pet4/tile20/key12/v1))＝a34d0c7ba6e7ede9fb9973977dd31fb8a7eb7dc92158cff0308da2640c226e2a；格式家族 |
| N_offline/P/M | 原400-01候选，review scope仍offline-candidate；P/M按既有recipe重推，不从root生成 |
| F | 批准的完整PET4文件SHA；对象头声明与逐payload实际SHA分别核对 |
| cache SHA | 整个29360128B文件的原字节SHA，包含未引用槽/空洞；不是P/M/N/根revision或实时库存 |
| 映射SHA | SHA(C(content))；recipe=native400-bootstrap-source-map-v1-canonical-json，C无末尾LF |

映射SHA绑定来源审阅内容，不是签名/持久信任锚或新的设备许可。真实源仍须对应独立用途决定，本轮只构造original-test/MIT输入。

## V2严格解析与选根

调用`inspector.inspect({roots,objects,bytes,minimumSequence='0'})`，roots精确2个256B Uint8Array、objects精确5个256B，bytes必须28MiB。布局固定sector4096、stride0x599000/5869568、两根后5槽，每槽4KiB元数据区＋最多5865472B payload；整个32MiB/前缀偏移抽取不提供。

| 范围 | 字节要求（小端） |
| --- | --- |
| common | magic8B；N_boot@24..55；geometry@112..135为(2,400,24,20,12,1)，136..247全0；CRC32@248覆盖0..247，commit@252=0x36434d54 |
| root PET4ROT2 | seq@8为非零uint64，state@16=2、20..23全0，idle@56=0/touch@60=4；64起4组slot(uint32)/gen(uint64)，slot<5且不重复、gen非零 |
| object PET4OBJ2 | gen@8匹配root；ID@16仅0/4/1/11且引用中不重复；bytes@20/F@56..87精确匹配批准metadata，88..111全0；容量不越槽 |

seq/gen输出十进制字符串、用BigInt比较，不转Number。四引用唯一且属于固定四ID隐含完整集合；物理slot4可变为活跃slot，并不增加第五个活跃资产。未引用头无论坏/暂存/非零均不作为对象成功事实；其字节仍改变整cache SHA。

每根需其metadata与所有引用对象成立才valid；取较大valid seq。两根都valid且seq相等拒绝，两根都无效拒绝；单根可回退但selection保留degraded_roots/逐根安全error，CRC/格式有效而对象无效的新根会标fallback_from_newer。读取错误不进这条回退分支，直接失败，不能将未知I/O说成坏根/已知空。

minimumSequence是调用方显式局部下限，低于即bootstrap_below_floor；不是设备/跨进程可信floor，也不写回根。诊断sequence仅在common元数据有效后读取，坏CRC里的任意大seq不作为“新根”证据。没有修复/格式化/提交/缓存迁移或激活动作。

## 文件review、资源与实际退出

`createNative400BootstrapReview({file,package,catalog,approval,mappingApproval,minimumSequence?,signal?,timeoutMs=10000,beforeRead?})`拥有一次审阅任务，ready返回完整映射；snapshot返回phase/error/reads/streamed_bytes与完成后的result，resources返回实际open_files及流式缓冲上限。beforeRead是可信故障/取消测试钩子，不由文件内容/插件配置选择。

只开明确私有普通文件，要求当前用户、无组/其他权限、nlink=1、精确28MiB；O_RDONLY/NOFOLLOW/NONBLOCK，最终路径不得是符号链接。单fd/一个≤64KiB流式缓冲，先读有界头/选根，再hash整cache与每个物理引用payload；同F也逐槽读，不因去重跳过。原source文件不复制入CAS/不产生输出文件，没有固件脚本或Flash写CLI。测试模拟器只生成临时.original fixture，绝不作为真实角色可安装镜像。

每次读取前后核同fd的dev/ino/size/uid/mode/nlink/mtimeNs/ctimeNs及路径lstat身份；改字节、改权限、截断、替换路径/链接即失败，即使恢复mtime仍不能用它替代内容/ctime校验。这是宿主文件稳定性检查，不构成抵抗恶意OS/磁盘回滚或物理Flash变化的证明。

ready只在全部摘要/身份/一致性完成且fd.close后发布。signal/timeout/close先失效；忽略abort的实际read/hook未退出时fd保持、close等待，资源open_files未归0就不能假称清理结束。timeoutMs为有界任务失效timer，不是抢占同步CPU/未知IO的硬退出上界。close幂等，只关闭自有fd，不删/修复源；文件/摘要/许可错误均不输出部分可信映射、不自动重试。

## 输出recipe与证据等级

content闭合当前版本：schema_version/scope/identity/approval/selection/objects/cache/checks/device_evidence。identity逐域保N_boot/N_offline/P/M/源两SHA，approval只保显式批准标识/usage/license/credits/source_kind；selection保选根及局部floor/诊断，objects保slot/gen/ID/bytes/F/frames/payload_offset；cache保bytes/整SHA。结果不含文件路径、inode、原始头/状态或凭据。

checks.catalog_metadata=true和payload_sha256=true只表示本PC文件经过对应检查；media_validation=not-performed，本片没有逐帧CRC/LZ4/index/RGB/extra验证，不能借候选timing承诺填完整verified proof。device_evidence=false，不输出actual/saved/offline_available/库存成功字段，不把合法root或ROM部署报告变成当前session回执。[400-09持久保存/重开与UI](native400-source-review-storage.md)已离线实现，只显示来源审阅等级，不能拿自哈希代独立批准/实际源复验。原reader和recipe输出保持。

## 复现与回退

`node scripts/verify-native400-08.mjs --output .cache/native400-08/results.json`只使用原创临时稀疏28MiB.fixture和本仓库原创PET4，不接网络/设备、真实cache/NVS/媒体。外部Apache-2.0固件只参考布局事实，不复制/执行其实现；本仓库新增代码/fixture MIT，真实素材仍独立遵守既有非商业/署名/SA和用途批准。

回退先close并等实际read退出→删除调用方自有临时fixture根→撤回新增独立模块/测试/CLI/文档，原N/profile/固定wire/400-07、旧尺寸备份保持；源文件无需恢复，没有现有服务/配置或分区副作用。正式策略/能力/生产N映射、真实用途、设备库存/Flash写/TLS时间凭据/G1-G2/24fps仍待共同确认，当前外部部署/预取状态仍400-06报告快照。
