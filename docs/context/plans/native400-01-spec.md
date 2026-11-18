# 400-01 素材身份、recipe与profile Spec（实现前）

2026-11-02。已读AGENTS、README、当前上下文、开发/维护规则、400规划及A2 core/import/worker/reader。用户授权实施400-01，仅离线元数据/导入适配；不接设备/生产listener，不改固件/pet/bridge/DSH或360协议/执行模型，不使用子智能体，保留已有修改。

执行中用户再次明确400是后续最终方向，旧尺寸暂作备份。故以专用createNative400Import为本轮主入口，360默认入口/旧记录只保持可回退，不增加旧尺寸功能、不以多尺寸并行维护为本轮目标；不会因该选择自动改设备或越过400-02/03/04边界。

## 问题与选择

通用400宿主目录为package_schema=2/78动作/循环策略，其I/M_host不等于设备catalog M或package P；现A2仅360/46/241/旧N。400-01复用原canonical、流式仓库、配额/保护/逐blob证明/worker/退出路径，增加显式400离线身份策略，不放宽360校验或装配新设备执行。

1. 新身份profile为round-pet-native400-offline/1，recipe为pet-package-native400-v1-canonical-json，namespace_scope固定offline-candidate；N_offline=SHA256(UTF8(round-pet/whale/native400/pet4/tile20/key12/offline-v1))。这是管理端离线候选N，**不是固件正式N/已安装缓存**，也不同于旧360和早期fixture N。生产N/Store geometry/validator仍待双方确认，不写分区或迁移缓存。
2. 规范化的content闭合包含schema_version/profile/namespace_scope/namespace、catalog、media_profile、timing、semantics、source_manifest_sha256/source_index_sha256。M_device_candidate=SHA(C(catalog))，P_candidate=SHA(C(content))，I_device=SHA(生成index原字节)。catalog含pet4_profile、400显示、78个id/bytes/F、character/variant和license_ref；不带PC package_schema/loop。timing逐动作固定400/24fps、42=118其余241、index/RGB SHA与extra_keyframes；media固定key12/flag1/tile20/extra支持。P绑定来源原字节、N和时序，不用M_host/I/继承catalog SHA代P。
3. 来源转换只接受compact-approved/1、recipe native400-compact-approved-v1、0–77全目录及对应宿主index（all78而非role8）；核几何/源F/bytes/时序/源与host对应、语义及既有视觉批准绑定。原manifest含浮点误差/时长，只按原字节SHA留来源，使用有界UTF8/重复键拒绝parser读取，再抽取受限整数canonical字段，不将float normalize后冒充原源SHA。转换只产候选，无批准/写入/导入副作用。
4. 真实来源用途批准由受信调用方独立提供：profile/scope/N/P/M/source及source-index SHA、精确78 IDs、license_ref、approval_id/credits/source_kind与usage=offline-validation；原视觉批准/provenance/自带哈希不能自动生成它。原始测试素材仅original-test；真实compact只读核P/M/N候选而不创建approval/真实CAS。内部审阅并非要求原作者逐次另行授权，不改变非商业/署名/SA边界。

## 实现范围

- 新pure core native400-identity：独立常量/闭合schema、来源规范化/候选、严格metadata与approval验证。复用原roundPetCanonical/parseRoundPetJson，不依赖Node/DOM/DSH。
- 新runtime native400-material：来源布局manifest.json（原源）、source-index.json（原宿主index）、package.json/catalog.json（新候选）和0.pet–77.pet；独立profile显式读取/重新推导候选。record使用新recipe，cachedOnly须再次独立approval；不接受账本自批准。全部400/24/实际frames、全F/LZ4/CRC/拼接index/RGB SHA及额外tag0都核，按需播放器支持118末帧，不给设备首帧/saved背书。
- 既有A2 import新增受信profile选项，默认360不变；内部策略复用同CAS/provenance（非覆盖）与worker，worker再次校验显式profile/来源，初读及结束重读防变化，400显式approvedPet4Profiles。原360 API/record字节、guard/reader/配额/固定wire/能力/actor不改变。CAS与ledger仍两提交，失败不造approved。
- 原创400 fixture/固定golden/专项及独立临时验证入口；禁止复制真实动画、固件或上游实现。fixture使用两种常量索引PET4（241/118）及额外tag0，78描述/文件均经真实校验，不绕过授权。

## 验收与回退

计划30专项：P/M/N/I/source域及固定golden；数组/对象/重复键/未知字段/Unicode与整数recipe；78完整IDs/role8/错42/补帧；360批准/N/profile混用、M_host/I/源catalog换域；缺用途/credits/商用/视觉自批准拒绝；真实PET4完整CRC/index/RGB/额外tag0及末帧；显式import/去重后逐源文件复验/新worker来源变化；cachedOnly独立批准/坏账本/坏blob、配额/关闭/资源退出。真实素材只读复核来源与新候选数学身份，不复制/导入/批准；没有完整性异常不重复解码18675帧。

运行独立临时CLI、npm run check和npm test（含构建），必要的来源/合同SHA与文档链接核对。更新当前摘要/C表/待办并归档400-01未实现记录；下一400-02能力/执行/渐进完整性，400-03 wire和400-04装配不并入。

回退关闭自有worker并等待实际退出，再删除临时根；撤回显式400策略即可，默认360、旧CAS/批准/媒体不迁移。重复index对应不同provenance仍拒绝覆盖，ledger失败可能留下未批准普通CAS，不能据其存在恢复授权。本轮无生产/设备配置变更、安装、提交推送或固件脚本/构建/测试，正式N/用途批准及G1/G2不由宿主通过放行。

实施状态（2026-11-02）：本轮离线身份/recipe/400主入口已实现，30专项、独立临时CLI与check/全套970通过；真实候选P/M/N已只读核定，无真实批准/导入，正式N/设备仍待共同确认。见[报告](../../reports/2026-11-02-native400-01.md)，当前摘要/C表已更新，旧缺口已归档。
