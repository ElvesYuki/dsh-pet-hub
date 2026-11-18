# A2 round-pet 严格离线导入

2026-10-30。管理端候选recipe的离线实现，非wire互操作或设备准入。参见[实现前Spec](../context/plans/round-pet-a2-spec.md)/[Diff](../context/plans/round-pet-a2-diff.md)、[验证报告](../reports/2026-10-30-round-pet-a2.md)。不自动发现/导入真实目录，不执行固件工具，不启用服务、UI或插件。

## 显式API与输入

```js
import {createRoundPetImport} from './packages/runtime/round-pet-import.mjs';
const handle = createRoundPetImport(privateTemporaryRuntime, {
  sourceDirectory: stableReviewedSnapshot,
  approval: independentlyReviewedApproval,
});
try {
  const bundle = await handle.ready;
  // bundle.manifests: 最小manifest；bundle.identity/provenance: 独立身份与来源记录。
  // A5内部bundle.blobProofs: worker同fd全验后的临时证据，不持久或向IPC暴露。
  // bundle.prepare/release只是宿主离线解码，不是设备播放/安装确认。
} finally {
  await handle.close();
}
```

目录选读package.json、catalog.json、manifest.json及{id}.pet。前两份是固件media_contract.py既有导出形状；本仓库只独立实现数据合同，没有复制或执行其代码。manifest.json只验证原始SHA与批准/包内声明一致，不宣称审查其全部业务字段。路径祖先/叶symlink拒绝，固定数字文件名不接受URL/穿越；调用方须提供稳定受控本地快照，现有Node文件读取不是抗恶意并发目录替换的OS沙箱。

approval严格要求schema_version=1、profile=round-pet-native360/1、namespace、firmware_package_sha256、hub_manifest_sha256、source_manifest_sha256、action_ids、license_ref、approval_id、credits、source_kind、usage。action_ids必须独立批准的46个0–77升序原ID，含固定8语义；source_kind为original-test或reviewed-upstream，usage仅offline-validation。没有默认批准，不从文件自行生成信任，不把license_ref当许可证本身。真实形象仍按THIRD_PARTY非商业/署名边界，批准不自动授权分发或商业使用。

## 身份及严格验证

F=SHA(完整文件)，P=SHA(C(package.content))，导出catalog.sha256必须是P；M=SHA(C(content.catalog))，只把M填入hub manifest.sha256。N固定既有V2 namespace；I=生成的canonical index JSON加LF之原始SHA。I是本适配器的仓库版本，不是G0向量中示意pretty index的I。

C复用有界fatal UTF8/重复decoded key解析，再拒绝浮点/指数词法、-0、非安全整数、孤立surrogate/未知字段；ASCII字段键排序，Unicode值不做NFC/trim，数组保持输入顺序。对象重排/输入JSON空白不改变P/M，动作或timing数组不能排序后冒认原P。G0两假文件数学向量保持原值；它不是生产素材。

包schema1、hash_recipe=pet-package-v1-canonical-json；catalog严格等于content.catalog加P，46 ID与批准逐项相等。timing逐项同ID，媒体固定360²/24fps/241帧/flag1/key12/tile20；media_profile.frame_limit=360仅通用上限。semantics固定idle0/touch4/thinking1/working11/result43/success58/waiting7/error55。最小manifest没有package_schema、PC once_hold/once_idle或额外许可字段。

worker重复预审批准/包/来源，逐个源文件SHA/长度，逐个CAS文件SHA/长度；即使F重复或CAS已存在也不跳过选中源文件。每个唯一F用既有Pet4Decoder验所有帧CRC，累计indices SHA对照P内timing.index_sha256，不做RGB转换或保留帧数组。本次同F可复用完整验证元数据，但各动作timing仍独立匹配。validated_frames是已验证描述的引用帧数之和，不能当成不同画面数量或实际重复解码次数。

复用既有worker、配额预留、私有CAS、version/index闭合schema和超时/关闭。prepare再次全验对应CAS，再提供宿主解码器，最多两player与8 RPC、原120秒验证/2秒RPC期限保持。严格适配的内部roundPet选项不由现有CLI/IPC/UI装配，旧snapshot/streaming/角色导入语义保持。

## provenance、重开与失败

CAS内仅原index.json/version.json/blobs。来源记录在私有round-pet-provenance/I.json，schema1、recipe=round-pet-provenance/1，内容为受限package、exported catalog、批准和identity(F在catalog中)。不记录源manifest原文、绝对源路径、设备/网络配置。最多32份、每份256KiB，CAS外最多8MiB元数据另计；当前没有自动清理/淘汰或扩大上限的入口，满/未知/超大条目失败保留。

CAS先完成，记录用私有临时文件写入/fsync，再hard-link原子不可覆盖发布，删除本次临时文件；已有同名记录仅允许字节相同。没有目录fsync或物理断电持久保证，也不是跨文件事务。记录失败时关闭worker/释放pin，专用ready失败；已发布CAS保留为普通未完成A2批准的版本，不自动删除或反向撤销。已有损坏记录不能覆盖重建。

```js
const reopened = createRoundPetImport(privateTemporaryRuntime, {
  cachedOnly: true,
  indexSha256: previouslyReviewedIndex,
  approval: independentlyReviewedApproval,
});
```

重开不需要原来源目录，但必须重新提供批准；严格核记录recipe/P/M/N/I/批准，再cachedOnly复验CAS全部媒体。source SHA此时表示此前导入选择的来源身份，与重新批准一致，不声称再次读过原文件。没有记录、批准不同、坏缓存均失败。外部获得bundle.identity/provenance和snapshot都是副本，不改变内部身份。

handle活动期复用lifecycle catalog pin；close可重复、拒绝未完成ready、实际终止worker/清stage/释放pin，保留已完成数据。provenance本身不是设备选择，不永久pin CAS；现有持久选择/actual/任务保护继续由lifecycle处理。未选版本以后可经既有明确清理删除，留下的来源记录不自动让缺失CAS重新出现。

常见拒绝包括invalid_round_pet_json、package_integrity_failed、manifest_integrity_failed、export_catalog_mismatch、source_manifest_changed、round_pet_approval_required、license_not_approved、round_pet_action_set、timing_mismatch、incompatible_asset、PET4 CRC错误、quota_exceeded、round_pet_provenance_conflict/limit，以及既有路径/worker/关闭错误。对外状态只记错误码，不保存原始诊断/路径。

## 验证与回退

```sh
node scripts/verify-round-pet-a2.mjs --output .cache/round-pet-a2/results.json
npm run check
npm test
```

35项专项使用原创恒定索引真实241帧PET4及46合成描述；同F文件用于验证去重与逐源文件校验，不代表真实46种动作或当前真实包批准。没有新网络listener、证书或上游素材。取消CLI明确失败、进程组与自有临时根清理。

回退关闭专用handle或撤回该入口，旧CAS/schema、旧选择、A1和设备N/Flash无迁移。A3/A4/A5宿主候选已另行完成；G0-R1已核真实P/源SHA/ID/媒体字节，独立许可/用途approval、真实A2完整导入与Node/C++wire及G1/G2仍待完成，不能按宿主prepare或provenance报实体playing/saved。

## A5装配补充

[A5](round-pet-a5.md)显式默认OFF owner使用本导入器和同一lifecycle pin，worker内部ready附加同一全验fd指纹，磁盘reader逐4KiB核对并及时关fd。指纹不写索引/来源记录或状态，不替代P/M/F与独立批准；没有改变A2磁盘格式或真实包批准结论。pin须等实际HTTP/会话/reader退出后才释放。

G0-R1的[真实身份复核](../reports/2026-10-30-round-pet-g0-reconciliation.md)没有调用本导入入口/创建真实库approval；复核向量不是validateRoundPetApproval输入。现有catalog.sha=P和license_ref原样保持，若修改许可引用/目录元数据须重算M/P并重新批准。
