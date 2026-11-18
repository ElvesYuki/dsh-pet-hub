# 分层角色包 v1：L1 数据契约

2026-10-30。**L1已实现纯数据/字节/目录校验及原创合成fixture；L2行为参数接入与真实导出已实现，[独立加载/首帧切换](layered-character-loader.md)已实现；[L3同Canvas等效及显式重选恢复](../reports/2026-10-30-layered-character-l3.md)已验证，设备运行仍待验。** [Spec](../context/plans/layered-character-package-spec.md) / [Diff](../context/plans/layered-character-package-diff.md) 的当前L1–L3宿主工具范围已完成，生产接入/跨浏览器和设备仍待实施/验证；不改变[PET4角色包](role-package.md)。

## API与验证层次

| 入口 | 输入/输出与边界 |
| --- | --- |
| core/parseLayeredJson(bytes, limit=262144) | Uint8Array→JSON；fatal UTF-8，拒绝重复解码键、BOM、非有限数值、垃圾尾部；嵌套≤16、节点≤20000，超限拒绝 |
| core/validateLayeredManifest(manifest, options) | 仅元数据/限额/必需能力/许可allowlist；返回声明数量，不验证字节 |
| core/validateLayeredDocuments(manifest, rig, behavior, provenance, options) | 引用闭合、骨架、全部槽位/固定参数与来源；返回统计，无代码执行 |
| runtime/verifyLayeredBundle({manifestBytes, files, expectedManifestSha256, allowedArtworkLicenses, supportedProfiles?}) | files为Map<包内path, Uint8Array>；核对摘要/文件集合/实际长度、解析JSON、校验文档、逐图完整解码后丢弃；返回验证摘要，不返回活跃角色 |
| runtime/verifyLayeredDirectory({directory, expectedManifestSha256, allowedArtworkLicenses, supportedProfiles?}) | 显式只读目录审计；同上，拒绝路径本身及祖先/子目录/文件符号链接，不启动服务或播放器 |

core入口无Node/DOM/DSH依赖。runtime使用Node内置crypto/fs/zlib和本仓库CRC32，没有第三方依赖。传入的expected摘要和许可allowlist必须由调用方明确选择，包不能自授信任；默认许可列表为空，整包拒绝。supportedProfiles默认表示本校验器认识的8种数据合同，不代表存在可用播放器。

通过输出status固定为`validated_data_only_not_loaded`，含format/version、manifest_sha256、character_id/variant_id/version、texture_count、declared_bytes（不含manifest）、decoded_rgba_bytes、profile_count、parts、total_bytes（含manifest）。不含原始PNG、本机路径或运行状态。

## manifest.json完整字段表

所有表格中的键都必需且封闭；不允许额外键或隐式缺省。JSON对象键顺序不影响字段校验，但原manifest字节变化会改变期望摘要。

| 键 | 类型与取值 |
| --- | --- |
| format | 字符串，固定dsh-layered-character |
| format_version | 数值整数，固定1；无package_schema字段 |
| character_id / variant_id / version | ASCII字母/数字/下划线/连字符，1–64字符 |
| canvas | 固定对象：width=360,height=360,origin=top_left,pixel_center=[0.5,0.5],center=[180,180],safe_circle_radius=166.5,root_translation=[0,0],root_scale=[1,1] |
| entrypoints | 固定对象{rig:"rig",behavior:"behavior",provenance:"provenance"}，值是files.id，不是外部路径 |
| files | 4–72项；JSON恰为rig/behavior/provenance三项，另有1–64个不同PNG；id/path唯一，PNG SHA也唯一，逻辑槽位可共享资源 |
| files[].id | 上述ASCII标识；JSON id固定等于其入口名 |
| files[].kind | json或png |
| files[].path | JSON严格等于id.json；PNG严格等于textures/<sha256>.png；无其他文件路径语法 |
| files[].bytes | 正安全整数；PNG≤4194304，JSON每份≤262144、三份合计≤524288 |
| files[].sha256 | 64位小写十六进制，核对原文件字节 |
| files[].width / height | 仅PNG存在，均固定360；JSON不允许该键 |
| requires | 恰好8个不重复已知profile ID，且全部在调用方supportedProfiles中；顺序不限 |
| license | 恰有code_license="MIT"、artwork_license_ref（ASCII id且在调用方allowlist）、credits、modifications |
| license.credits | 1–16条互异非空字符串，每条≤128字符；不得据此推导许可真实性 |
| license.modifications | 非空修改说明，≤2048字符；明确代码MIT与图像许可分开 |

manifest≤262144字节；包实际总字节（含manifest）≤67108864；解码RGBA总和≤33554432，按每个不同PNG资源360×360×4计算。共享贴图不重复计，主图层仍为21个、11发束仍分别求值。以上是校验门槛，不是进程RSS或ESP32内存保证。

## rig.json完整字段表

顶层仅parts、draw_order、texture_bindings、face_slots、pose_overrides、touch、reference_texture。

| 键 | 类型与取值 |
| --- | --- |
| parts | 恰好21项；每项恰含id,parent,pivot,rest_translation,rest_scale,texture_id；id唯一，parent/pivot为下表固定值；rest_translation=[0,0]，rest_scale=[1,1] |
| parts[].texture_id | 引用files中png的id，是最终有效图层（由后续导出器选择清洁/修补后的资源）；L1不识别画风或像素语义 |
| texture_bindings | 恰好21个part id键，每个值必须等于对应parts[].texture_id，拒绝不一致绑定 |
| draw_order | 严格等于下述固定顺序，每层一次；循环/缺失/未知父级拒绝 |
| face_slots | 恰有eyes、brows、mouth三个对象，子键见下；所有值均引用PNG资源id |
| face_slots.eyes | open,half,closed,smile,open_edge；open须与主eyes层绑定一致 |
| face_slots.brows | neutral,relaxed,raised；neutral须与主brows层绑定一致 |
| face_slots.mouth | closed,smile,small,open,round；closed须与主mouth层绑定一致 |
| pose_overrides | 仅wave，其对象恰有part="arm_right",shoulder=[195,216],wrist_down=[217,251],wrist_up=[229,200],draw_rule="right_arm_foreground_during_wave",down_texture_id,up_texture_id；down须等于arm_right主层 |
| touch | 固定bounds=[70,50,281,315],head_y_lt=204,reference_alpha_min=16,cooldown_seconds=0.15；只是命中数据，L1不执行命中 |
| reference_texture | PNG资源id；包内每张PNG必须被上述任一槽位实际引用，不允许夹带无引用资源 |

| part id | parent | pivot（画布像素） |
| --- | --- | --- |
| body | null | [169,235] |
| head | body | [169,202] |
| arm_left / arm_right | body | [143,216] / [195,216] |
| tail | body | [228,269] |
| head_accessories / hair_cap | head | [174,119] / [174,119] |
| eyes / brows / mouth | head | [166,174] / [166,145] / [164,193] |
| ahoge | head | [165,77] |
| back_left / back_right / back_center | head | [100,145] / [240,145] / [174,150] |
| back_left_tip / back_right_tip | back_left / back_right | [94,258] / [258,248] |
| fringe_left / fringe_center / fringe_right | head | [136,102] / [166,101] / [202,106] |
| side_left / side_right | head | [107,142] / [231,143] |

固定顺序：back_center, back_right_tip, back_left_tip, back_right, back_left, tail, body, arm_left, arm_right, head, side_right, side_left, hair_cap, brows, eyes, mouth, fringe_right, fringe_left, fringe_center, ahoge, head_accessories。

21个部件是当前rig profile的限制，不是通用骨架数量上限。头顶固定、其余11发束动态的完整身份/顺序在natural profile中固定；删掉发束或改变节点身份/层级不能通过校验。L1不分析图像语义，无法识别将整片发图错误绑定到多个合法节点的内容问题；视觉一致性留待L2/L3。

## behavior.json完整字段与数值基线

完整逐字段/逐数组数值在[固定参数JSON](layered-character-profiles-v1.json)，与core/layered-character-profiles.mjs一致。**该JSON就是behavior.json的完整基线示例**：顶层只能profiles和rules，嵌套键/数组长度与顺序、数值、字符串都必须相等；对象键顺序不限。首版所有数值可接受范围均为[min=基线值,max=基线值]，不是任意可调区间；删键、增键、NaN、其他字符串/数值均拒绝。校验不执行这些profile。

| profiles键 | 完整子字段组（具体值/每个通道键以参数JSON为准） | 单位/语义 |
| --- | --- | --- |
| rig_21_v1 | coordinate,root_translation,root_scale,rotation,pixel_center | 像素、无量纲缩放、顺时针角度 |
| rgba_png_v1 | width,height,bit_depth,color_type,interlace,alpha,blend | 像素、RGBA8、straight alpha/source-over |
| natural_120hz_v1 | integration_hz,tick_epsilon,channels,moving_hair,breath,head,head_y,arms,tail,hair,touch | channels每项omega/zeta/limit/speed；角度通道为度/度每秒，head_y为像素/像素每秒；omega每秒、zeta无量纲；时间秒/tick，其他为当前算法系数 |
| character_states_v1 | base_states,blend_seconds,completion_seconds,completion_history,id_max_length,expression_entry,expression_exit_start,expression_exit_duration,success_eye_thresholds,thinking_half_threshold,motion | 秒、计数、权重/当前目标系数；thinking半闭眼阈值0.5 |
| expression_v1 | max_seconds,blink,touch | 秒；blink包含固定32位LCG、间隔/眼态门槛；touch包含保持/进入/释放门槛 |
| silent_speech_v1 | id_max_length,duration_default,duration_min,duration_max,start_seconds,end_seconds,period,gap_start,cues,paused_mouth | 秒/嘴态；cue数组按顺序冻结，暂停闭口；没有音频/音素接口 |
| wave_v1 | entry_seconds,wave_seconds,exit_start,total_seconds,cancel_seconds,amplitude_degrees,cycles,angular_frequency_pi,shoulder,wrist_down,wrist_up,draw_rule,busy,cancel | 秒/度/画布像素；busy拒绝，取消按代数；频率项按π乘数 |
| arm_contour_distance_v1 | mask_alpha,roi_alpha,margin_px,propagation_round_trips,edge_offset,edge_slope,fill,transform,endpoints | alpha0–255、像素/传播轮数；对应v4预览distance_field_v1，不能静默改成双图淡化 |

rules完整键：max_replay_seconds=60,max_step_seconds=60,events_per_channel=400,same_time=caller_order,face_priority=[head_touch,success,blink],mouth_owner=speech,wave_owner=arm_right,return_base=latest,root=identity。

自然profile含16个通道：head/head_y、左右臂、tail及11发束。spring为现有半隐式固定步长求值与限幅/碰边清速度；breath为现有分段余弦；状态目标、眼态选择、波形、初始idle/零物理状态、同时间输入顺序及通道所有权的求值语义由profile版本冻结，不作为包内可执行表达式。L1验证器不执行动画；当前共享求值器已接入完整冻结参数并保留旧脚本入口，API和等效范围见[行为参数接入](character-behavior-parameters.md)，仍无独立角色包加载器。

## provenance.json完整字段表

恰有artwork_license_ref、credits、modifications、method、sources。前三项与manifest.license对应值完全一致；method为synthetic/manual/ai_assisted之一。sources为1–16项，每项只含id（互异ASCII标识）和sha256（64位小写十六进制）；不能放源目录/URL/JS/绝对路径。图像原作者信息允许Unicode，来源摘要仅做追溯。非商业形象包未来须由调用方明确指定已复核许可ref，不默认允许发布。

## PNG、路径及完整性

- v1接受完整360×360、非交错RGBA8；核对签名、全部CRC、IHDR、非空连续IDAT、最后唯一IEND及zlib实际消费字节/输出长度518760。逐行还原0–4滤波得到518400字节RGBA，不只看头部尺寸。
- 允许IHDR前置后的独立sRGB/pHYs固定长度元数据（sRGB intent为0–3，pHYs单位为0或1），不允许重复/IDAT后元数据、PLTE、APNG、gAMA/cHRM、ICC/压缩文本及其他块；元数据不在L1展开。解码主要验证像素字节，色彩管理/跨Canvas一致性属于L2/L3。当前导出器对不符合子集的输入明确拒绝，没有自动转换；若未来规范化需显式无损证明，L1不改写文件。
- 解析前限制字节/嵌套/节点；解压限制最大输出，拒绝多余压缩流、超大IHDR、过滤器/CRC错误。PNG每次解码后丢弃，审计不保留全库RGBA。
- 目录必须与manifest列出的固定文件集合相同；manifest本身为唯一不自列SHA的已知文件。拒绝未声明文件、非普通文件和任一符号链接；传入目录祖先也拒绝链接，使用系统临时目录时应先取得其规范路径。
- 文件open时NOFOLLOW/NONBLOCK，核对lstat/fstat身份、实际长度与声明，再分配；读完复查大小/mtime/ctime，最终核对SHA。读取快照不被用来激活或显示。此同步只读审计针对调用方拥有的稳定目录，不是针对恶意并发改名进程的OS级openat隔离沙箱。
- 包摘要=原manifest字节SHA；manifest内绑定全部文件长度/SHA。fixture为固定排序/换行生成，规范JSON示例不是外部身份认证。

稳定错误code为invalid_format、invalid_reference、resource_limit、integrity_failed、invalid_texture、invalid_rig、unsupported_profile、license_unresolved；JSON/PNG失败可附逻辑resource_id。CLI只输出code/id，不打印本机路径。底层非契约I/O失败在API包装cause供内部诊断，CLI不序列化cause。

## 原创fixture、命令与未实现项

packages/simulator/layered-character-fixture.mjs构造一张原创几何矩形RGBA图，21层/全部表情和替换槽共享同一资源以验证去重；它不演示真实角色外观或动画。测试在私有规范临时目录写入/清理，无用户素材、网络或设备。fixture不进入插件候选dist。

显式只读审计命令（实现已存在）：

```sh
node scripts/validate-layered-character-package.mjs \
  --directory '<包的规范绝对路径>' \
  --manifest-sha256 '<调用方明确选择的manifest摘要>' \
  --artwork-license-ref '<已复核许可ref>'
```

此命令不导出/修复/加载角色，不启动现有服务。不传入参数直接失败，审计失败退出1；成功退出0。L2[真实包导出](layered-character-export.md)已实现；独立渲染候选/代数取消/首帧交换、L3一致性与恢复尚未实现，不能将本契约写成设备或生产仓库已支持。
