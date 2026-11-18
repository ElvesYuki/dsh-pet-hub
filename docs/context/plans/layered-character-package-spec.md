# 分层角色包 v1 Spec

2026-10-30。状态：**L1字段表、固定参数、合成fixture及数据/字节/目录校验已实现；L2行为参数、真实包及[独立加载/首帧切换](../../reports/2026-10-30-layered-character-loader.md)已完成；[L3同Chromium/Canvas等效、重开及资源验收](../../reports/2026-10-30-layered-character-l3.md)已完成；跨浏览器/设备/长期性能仍待验。** 初稿按用户要求先写设计，随后按授权完成L1，见[报告](../../reports/2026-10-30-layered-character-package-l1.md)和[完整字段契约](../../protocol/layered-character-package.md)。配套[Diff](layered-character-package-diff.md)。不启动设备或运行服务。

## 1. 问题、目标与实施范围

现有母版、19张表情/修补贴图、抬手图、参数和程序行为分散于制作目录及scripts；独立HTML通过内嵌图片和受信任代码运行。[v4挥手](../../reports/2026-10-30-character-wave-contour.md)验证了桌面组合，不能证明存在正式分层包。`character-authoring-template.json`是制作清单，不是运行manifest。[现有package_schema=2](../../protocol/role-package.md)仅支持SIM2/PET4动作，不能靠改codec名装入新格式。

下一实施切片目标：把当前候选导出成**纯数据目录包**，由独立桌面加载器只依赖该包及本仓库固定版本引擎，还原当前效果。移走原制作目录后仍可校验/加载；坏包、旧异步结果和加载失败保留当前角色。首版不是泛用动画编辑器。

本切片包含格式/引用/资源校验、离线导出、纯逻辑参数求值适配、隔离Canvas加载预览及回归证据。暂不接既有素材仓库/激活IPC/UI、真实pet来源、设备协议/固件/Flash、PET4与分层实时切换、音频、性能优化或新美术。没有新增服务启动/安装授权。

行为参数子切片已有[Spec/Diff](layered-character-behavior-parameters-spec.md)、[API](../../protocol/character-behavior-parameters.md)及[报告](../../reports/2026-10-30-character-behavior-parameters.md)；工厂/replay/sample已共用冻结快照，旧脚本保留兼容入口。真实导出也已有[切片Spec/Diff](layered-character-export-spec.md)/[报告](../../reports/2026-10-30-layered-character-export.md)；独立加载/候选保护仍待实施，整体L2未完成。

## 2. 必须保留的基准

- 逻辑画布360×360，左上原点，像素中心(i+0.5,j+0.5)，中心(180,180)，根平移(0,0)/缩放(1,1)。不根据透明边界自动居中/缩放。
- 目标屏466×466时内容偏移(53,53)由显示适配层计算，不写进每个部件，不重复偏移。安全圆为逻辑中心(180,180)、半径166.5；不裁掉安全区外数据冒充检查通过。
- 沿用当前21个主图层、12层头发中11处动态、同一绘制顺序/父子关系/支点。抬手是arm_right的替换姿态，不额外叠加一条手臂。
- 保留待机/思考/工作、单次完成、挥手、触摸、眼眉及五嘴态组合；原46个PET4动作无修改，不以分层包替换正式素材。
- 代码MIT；角色图/改编图/上游许可独立。来源SHA用于追溯，不构成原作者授权或签名。

## 3. 格式标识与文件构成

独立标识：`format="dsh-layered-character"`、`format_version=1`。不添加/冒用PET4头，不使用现有`package_schema=2`，不修改其读取逻辑。首版仅接受本机目录，无ZIP解压、远程URL或HTML包。

```text
<package>/
  manifest.json
  rig.json
  behavior.json
  provenance.json
  textures/<sha256>.png
```

manifest顶层字段（首版全部必需，拒绝未知字段）：

| 字段 | 内容与约束 |
| --- | --- |
| format / format_version | 上述固定标识/整数1，不自动升级或猜测 |
| character_id / variant_id / version | 身份、变体与展示版本；非空ASCII标识，1–64字符，字母/数字/下划线/连字符；内容身份以摘要为准 |
| canvas | 固定360×360，坐标约定与根恒等；不包含本机屏幕/端口配置 |
| entrypoints | rig、behavior、provenance三个包内JSON引用 |
| files | 每项id、path、kind、bytes、sha256；PNG另含width/height；引用唯一且全部闭合 |
| requires | 必需的引擎能力ID集合；首版导出的当前角色列出全部使用能力，不可静默降级 |
| license | code_license、artwork_license_ref、credits及修改说明；不能把图像标为代码MIT |

文件id使用同一ASCII规则，最多64字符；SHA256为64位小写十六进制，bytes为正安全整数。PNG按字节SHA去重：同一PNG可被多个逻辑层/表情引用，但不合并图层或改变动态数量。身份ID相同、内容摘要不同视为不同候选，不能原地覆盖。

`manifest.json`不列出自身SHA；包内容摘要为原始manifest UTF-8字节的SHA256，manifest内已固定全部文件长度与SHA。导出使用固定字段顺序、files按id排序、LF与末尾换行保证重复导出稳定。验证首先核对调用方显式提供的expected_manifest_sha256，再逐文件核对原字节；摘要是完整性检查，不是来源认证。导出回执在包目录外，记录摘要/尺寸/文件数，不放自引用摘要；没有受信任摘要来源时只能称自洽性检查，不能称可信安装。

## 4. 数据内容与固定版本行为

### rig.json

包含parts、draw_order、texture_bindings、face_slots、pose_overrides、touch及reference_texture：

- parts明确id、parent、pivot、rest_translation、rest_scale、texture_id；首个受信任rig profile仅支持现有21个已知部件及父子约束，根恒等，其他静态变换与当前候选相同。任意网格、新层级或其他角色骨架另加profile，不以“数量不超限”推导可播放。
- draw_order必须恰好覆盖主图层一次；检查缺失/重复、循环和未知父级。主层覆盖当前清洁头部/修补头发的**有效贴图**；不会把旧脏底与清洁版混用。原始母版SHA只进入来源记录。
- face_slots固定eyes(open/half/closed/smile及open_edge叠层)、brows(neutral/relaxed/raised)、mouth(closed/smile/small/open/round)绑定。开放眼沿用原眼层；无五官底层和边缘补片必须一起打包。
- pose_overrides.wave绑定原臂/抬手纹理、肩点(195,216)、腕点放下(217,251)/抬起(229,200)，以及挥手期间位于侧发前、空闲时原顺序的绘制规则。使用受信任规则ID，不允许包定义任意绘制代码。
- reference_texture保存360基准图，用于来源对照及静态alpha命中。触摸保持当前逻辑包围[70,50,281,315]、y<204为head、其余body；还须命中reference alpha≥16，冷却0.15秒。明确这是当前静态命中模型，不宣称动态手掌精确命中。

### behavior.json

仅包含白名单profile ID、对应版本和严格参数快照；不能包含JS、表达式、模块路径或任意函数名。宿主按固定ID分派到本仓库受信任实现，不从包eval/import。版本首版示例：

| 必需profile/能力 | 需要冻结的行为 |
| --- | --- |
| rig_21_v1 / rgba_png_v1 | 当前21部件、8位PNG、固定逻辑坐标与合成约定 |
| natural_120hz_v1 | 固定1/120秒积分、全部通道弹簧/阻尼/限幅/限速、11发束顺序与错相/风/跟随、触摸冲量及回稳 |
| character_states_v1 | idle/thinking/working目标、0.45秒权重过渡、success 1.4秒、最近32成功ID去重；保留x/v |
| expression_v1 | 独立确定性眨眼时间表、触摸笑眼进入/退出与眼眉组合 |
| silent_speech_v1 | 五嘴态、预设cue时间线、开始/暂停/换句/取消及代数；仅无音频演示 |
| wave_v1 | 0.45/1.5/0.45秒、三次小摆、上限4度、取消0.3秒、busy拒绝/代数、基础右臂衔接 |
| arm_contour_distance_v1 | 肩腕相似变换、alpha128形状阈值、两轮双向向量传播、3像素透明余量、内部最近颜色与单轮廓抗锯齿 |

参数快照须从当前实现完整提取到profile对应结构；L1已在完整字段契约与固定参数JSON中列全允许键、单位、精确基线值与必填项，禁止任意JSON透传给引擎。首版仅接受当前基线参数集；未经测试的调参/其他profile明确拒绝，不把此切片扩成通用编辑器。将来改变求值语义需新profile版本；不能用同名profile静默替换波形或距离算法。

时间在包数据中用显式秒数，积分用整数tick；同时间输入保留调用顺序。首个回放工具继续限制0–60秒、每通道历史最多400条，单步最大60秒，不承诺多日播放。profile默认开启已有自然动态，不用“降低性能”理由删发束。24Hz仅是对照采样率。

通道所有权必须随profile冻结：基础态持续；完成/触摸不覆盖基础态；摸头优先于完成眼眉，眨眼时钟不重置；说话仅占嘴部且暂停闭口；挥手仅占右臂，其他通道继续推进。挥手/触摸结束回最新基础态。既有手动表情检查属于预览UI，不存入包或当前角色恢复指针。

### provenance.json

记录当前母版/表情/抬手来源摘要、形象署名、非商业改编说明、制作方式及已知视觉限制，可记录包内资源id；不包含本机绝对路径、原始对话、网络配置或完整生成源大图。许可信息非空只是格式门槛，不能替代既有来源许可复核；未知许可拒绝“可发布”结论。

## 5. 引用、校验与资源门槛（设计值）

- JSON限制：manifest≤256KiB；其余数据JSON每份≤256KiB、合计≤512KiB，嵌套≤16层，严格UTF-8、无重复键、无非有限数值/未知字段，解析前限制长度。
- 最多64张不同PNG、主层恰为当前21个，files最多72项（含数据JSON），包内文件总字节≤64MiB。PNG每张≤4MiB，仅360×360、非动画、8位RGBA；CRC/实际解压长度/滤波及透明数据完整检查，拒绝APNG、畸形压缩流及超限，不仅看IHDR。
- 按每个**不同资源id/SHA**解码一次计算总RGBA字节，上限32MiB；使用同一图不重复计，调用方不得偷偷复制全量RGBA。此为准入设计值，不是进程RSS/ESP32 RAM保证；实际Canvas/缓冲/距离场峰值另测。若原PNG不满足标准，导出器只能显式、无损转为规范PNG并记录新旧SHA/逐像素一致证明，不改变角色像素。
- paths只允许上列三种JSON文件名与`textures/<sha256>.png`，路径与files.kind一致；禁止绝对路径、..、空片段、反斜线、URL、百分号编码/盘符和符号链接。拒绝目录中未声明文件/重复规范路径，所有引用必须能找到且类型正确。验证大小后再分配，读取到私有候选缓冲并核对SHA，避免预验后换文件；加载只消费通过验证的缓冲。
- required能力不支持时整包拒绝，不静默跳过11发束/轮廓过渡/表情。禁止用两图淡化替代不支持的distance profile。未来预烘焙模式需独立声明数据格式、误差和能力，v1不伪造已支持。
- PNG/JSON/贴图引用/rig/profile/许可任一失败均不发布候选；错误须指出阶段与逻辑资源ID，不输出原始状态或本机路径。建议稳定错误类别：invalid_format、unsupported_profile、invalid_reference、integrity_failed、resource_limit、invalid_texture、invalid_rig、license_unresolved、stale_candidate。

## 6. 导出、加载、失败保留与恢复

**导出**：显式读取已核对master/face/raised-arm及当前参数→解析有效贴图/去重→写本仓库.cache下新的同级临时包→逐项复验并重查输入→mkdir独占认领新output壳、写包外receipt→rename到output/package。只复制数据与所需PNG，不复制源稿/HTML/JS/制作脚本。当前输入全部符合L1，导出原PNG字节，不提供自动规范化分支；回执置于package外。失败清临时文件，旧目录不变；不覆盖目标或写入正式仓库。原输入只读，若来源SHA变化拒绝，不自动接受新母版。

**隔离加载预览**：显式本机目录＋expected摘要→有界校验→解码候选→确认所有required profile→在离屏画布渲染当前基础态首帧→核对load_generation仍为最新→替换单个预览角色引用。候选准备期间旧角色继续显示；新候选失败/取消/过期保留旧角色，晚到异步解码不能覆盖后来的选择。一个活跃角色＋最多一个候选；取消新候选时等解码/任务停止并释放图片/缓冲，后续资源仅由新任务拥有。首版不创建生产worker池或调用角色激活IPC。

纯逻辑解析/校验/时间求值不能依赖DOM或DSH；文件读取/摘要/解码调度属于运行适配，Canvas属于隔离展示适配，制作CLI只负责显式离线装配。包内容不带代码，加载器本身可以用本仓库固定引擎；“仅依赖包”指不回读制作目录，不是PNG自身能执行动画。

**恢复**：首个切片只要求复制包到新的临时位置并重开工具后重新校验、重建角色；显式选择包并从idle/零物理状态开始。不保存旧触摸/挥手/成功事件、嘴部会话代数、弹簧速度或播放进度。尚无自动后台恢复或持久角色激活指针；若后续要接现有仓库与原子激活，另写迁移Spec，不能将页面首帧等同设备首帧确认。

## 7. 与PET4双路线、设备及许可的边界

现有素材仓库与package_schema=2读取/激活逻辑不变。未来同一上层语义可选PET4或分层，但主画面只能由一个播放器拥有；切换、资源交接、取消/回退和新包类型入库另行设计。本包不复制46个PET4动作，也不在任意PET4帧上覆盖嘴部。

ESP32设备格式、RGB565+Alpha转换、透明精度、变化区域刷新及音频同步仍未实现；桌面distance profile不代表板端可实时计算。预烘焙轮廓/设备导出作为后续分支，不在v1删除动态或默认缩小人物。性能优化后置，24FPS/100ms仍是后续参考目标而非保证。

新代码MIT，素材/派生图维持既有许可及上善无形、ZipZipPipe、PC2005-cloud/dsh-pet署名。测试用原创合成小图，实际角色图只在忽略目录本地验证；不提交素材大文件或新许可承诺。

## 8. 分段实施与验收

| 段 | 交付 | 验收条件 |
| --- | --- | --- |
| L1 契约/校验 | profile字段表与合成manifest fixture、严格解析/引用/限制 | 负例覆盖未知版本、未知能力、路径逃逸/链接、坏SHA/CRC、图像炸弹、重复键/循环rig、缺脸槽、缺11发束 |
| L2 导出/独立加载 | 当前候选导出、独立显式加载页、load_generation保护 | 重复导出摘要一致；输入不变；移走原制作目录后可加载；坏包/取消/慢A→快B保留最新有效角色，无瞬间清空 |
| L3 等效/恢复 | 包与v4回放比较、资源和回退报告 | 数值姿态/所有权/时序一致；同一Canvas后端固定脚本逐帧比较、身体覆盖/安全区和过渡观感检查；离开工具重开后重验包、idle重置，旧事件不重播 |

L3至少复用原14场景4046采样并记录同一掩膜定义；另加入不同时间取消、原目录移除、缺图/损坏/超限、未知profile、慢候选覆盖及重复装卸清理。纯逻辑要求同输入同输出；同后端像素应一致，若Canvas或解码路径有差异，先记录数值/差异范围并定位原因，不事后随意放宽容差冒充通过。

停止独立工具即可撤销运行效果；旧v4及原包保留，显式重新加载旧候选回退。实现后运行npm run check/npm test及上述专项，报告区分宿主验证、设计、真机待验，并更新当前上下文；L1实际结果以链接报告为准；L2/L3当前宿主工具范围已完成，后续生产接入另写Spec/Diff。
