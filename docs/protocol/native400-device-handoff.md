# 400素材交付与设备侧验证交接

2026-11-02管理端目标对齐：用户已确认以本页compact78作为400×400／78动作管理端主线输入，见[400基线](../context/native400-baseline.md)、[Spec/Diff](../context/plans/native400-manager-alignment-spec.md)及[共同G0](../context/plans/round-pet-g0-handoff.md)。素材/宿主已批准不代表专用设备协议/持久化/TLS已实现；360留兼容回退、分层360不迁移，既有目录/文件/批准均不改。本次没有设备或服务操作。

2026-11-02；全量压缩版获用户确认并已合并，通过宿主验证；设备侧需按新身份继续验证。给设备侧线程的开发依据，不是启用、烧录或改变运行服务的授权。正式360素材和可恢复固件继续保留。

## 当前交付：全78压缩优先批准版（2026-11-02）

用户已审阅全量对照并授权合并，见[最新合并报告](../reports/2026-11-02-native400-compact-merge.md)。后续设备验证使用以下新输入；下方旧库作为历史／回退保留。本次不重新编码，与已审阅压缩候选逐字节一致。

- 规范平铺文件及逐项manifest：`.cache/native400-compact78-v1/`，文件`0.pet`–`77.pet`；manifest SHA256 **`a1c7c2a6a6a5ffeb113e403262252739271afc18db0a6d53ab40f1ebbab94ae5`**。
- 完整宿主角色目录：`.cache/native400-compact-library78-v1/`；index SHA256 **`5bd657d47a288b055c4806e4245c07c470ad9057edf37338c75d8450fe19df29`**；provenance SHA256 `740fade4b526a1e72dc1f768d7ed3755ef7b091acd11c261066ec918c516845f`。
- 八语义宿主目录：`.cache/native400-compact-role8-v1/`；index SHA256 **`afdda0e87d05ebad3117a25100ad330f58c6b6564adaf10c881b060ce2b92f99`**；本次这8个文件也全部更新，不能复用旧role8摘要。provenance SHA256 `9c8719e116b2205f00ae6ff51e72220e4d2b732f522d5ed14fcc6065cb788213`。
- 已审阅对照manifest：`.cache/native400-compact78-review-v1/manifest.json`，SHA256 `21142a93f4d4b15e137a931ceb2082d33cf9af3c9d72dde1657b92693fe3dd7e`；新库视觉批准绑定该SHA及全部0–77动作。
- 新交付recipe：`native400-compact-approved-v1`。预处理保持空间18／时间5／至多128色及旧去重色数75%，不再调整画面；逐项新文件SHA、索引／RGB565 SHA、源视频SHA、实际帧数／最大压缩tile／额外key数在manifest。
- 总348737057B（332.58MiB），比旧合并少14.71%；所有完整PET4≤5865472B，最大67号5569645B，余295827B。八语义总31877424B仍＞28MiB，按既有4活跃＋1暂存／保护0/4管理，不一次装全库。
- 新平铺库全部78／18675帧CRC／索引SHA／RGB565 SHA／seek通过，证明host-verification.json；完整角色目录在旧sim_A cap下整包导入／激活／78动作／IPC代理／缓存恢复通过，证明management-verification.json。用户视觉批准和宿主验证均不能替代设备侧资源／显示／执行证据。

400几何／24fps／42号118帧／其他241帧保持；头仍256个RGB565调色板项，索引仍8位。key12／flag1／tile20／8000B独立LZ4HC12与非12倍数额外tag0保持，必须按tag选择完整索引／XOR。源和新文件／索引／像素身份分开，设备目录摘要与宿主index按既有合同转换；不能套旧批准或混合版本。

请沿用设备侧已完成的400适配与既有验证窗口／回退安排继续，先核对新摘要再换验证输入；本仓库未写固件／设备／现有服务。旧`.cache/native400-merged78-v1`及其角色目录保持，可整套回退。

## 历史交付：12项优化合并版（2026-10-30）



用户已确认7项颜色变化并授权合并，见[合并报告](../reports/2026-10-30-native400-merge.md)。以下为上一版目录和摘要；已由顶部全量压缩版替代为后续验证输入，旧文件保留。

- 文件及逐项manifest：`.cache/native400-merged78-v1/`，manifest SHA256 `db185f3020000b1bea6d1bd380ba39bfc8f0ab24e9fd3d1a6a29b87160769ca8`；全部78／18675帧宿主CRC／index／RGB565／seek通过，42号仍118帧，其他241帧／24fps。
- 完整宿主角色目录：`.cache/native400-merged-library78-v1/`，index SHA256 `195224a9d55b46569341b393f8f9b51d22959d327364802ac5c2a8d2163246a3`；provenance SHA256 `344acaad55ddf1f1000d8c19d0a989b68fd0a40c05eefb75b65ecc89cb85c078`，绑定原M2、候选manifest与用户颜色批准范围，recipe为`native400-merged-approved-compression-v1`。
- 新八语义目录：`.cache/native400-merged-role8-v1/`；这8项不在替换列表内，index与旧role8保持`72e306080ff7427a76ba6c0f011fa17767bc7d91521a8a7325d76afd670fa597`，来源provenance已更新。
- 仅替换5/17/19/20/23/35/40/48/66/67/70/76，其余66项文件SHA保持。5项RGB565无损，7项已批准颜色合并，明细及误差见manifest和压缩报告；不把新增误差当源视频总误差。
- 全库408869792B；所有文件≤旧5865472B，最大66号5863164B，余2308B。旧cap下完整78包宿主导入／激活、全部动作、IPC／代理及缓存恢复通过，证明在library78的management-verification.json；这不是设备回执或Flash安装，不能一次把390MiB全库存入28MiB缓存。

**额外完整帧必须支持**：保留key interval12，0/12/24…强制tag0；非12倍数帧也可tag0，必须按每帧tag决定完整索引或XOR，不能把非12倍数帧一律当delta。tile仍20行／8000B独立LZ4HC12。400缓冲／显示／真实时序和资源门槛见下文，仍待设备侧Spec、字节测试与授权真机窗口。本轮没有修改固件、设备、正式360或服务，没有替换旧CAS／Flash／root，不能复用旧M2 index批准。

## 历史M1六动作交付

- 最终HC12文件及manifest：`.cache/native400-m1-hc12-v1/`；文件为`0.pet`、`2.pet`、`15.pet`、`42.pet`、`56.pet`、`65.pet`。
- 最终逐帧宿主复验：同目录`host-verification.json`，含manifest SHA、文件SHA、索引/RGB565 SHA及实际帧数。
- 编码前后完整动画／PNG：`.cache/native400-m1-samples-v1/index.html`。该页先由原创greedy参考包实际解码生成；HC12包逐帧索引与RGB565摘要相同，因此像素对照也适用于最终HC12包。最终字节以hc12目录为准，不混用两个manifest的文件摘要。
- 素材沿用上善无形／ZipZipPipe／PC2005-cloud/dsh-pet非商业许可；代码MIT不覆盖素材许可，不放入公开仓库或插件dist。

这些是六动作格式小样，**不是完整八语义角色包或可直接安装的生产目录**。没有补齐受保护动作4，不能据此更换生产root或覆盖保护槽。78完整视觉候选另见M0；M1阶段只编码6个，当前完整交付见顶部。

## 几何与颜色

原视频640×360，alpha在源坐标直接合成黑底，取整数裁区(124,-6,400,400)；上补6、下补34；无空间缩放／逐动作平移／额外安全圆。设备466×466，1:1居中左上(33,33)。最终显示取400方形与物理圆屏交集；黑边不是透明，也不能按黑色猜测alpha。

源像素位置保持。当前批准版recipe为`native400-compact-approved-v1`，包括弱平滑／有界帧间保持和减色，视觉已获用户确认，属于有损处理。头部仍256项调色板，实际使用色数≤128、RGB565、无抖动、黑色索引0精确黑；不要因有效色数降低而缩短PET4头或改为7位索引。旧M1基础recipe为`native400-rgb8-black-median-cut256-nearest-lz4hc12-v1`，仅历史参考。源与新增误差按各动作记录，不混用。

## 二进制合同

- profile（包外声明）：`native400-candidate-v1`，PET4 magic不变；候选宿主仅显式开启此profile。
- 头532字节：magic[0:4]；宽高u16LE在4/6，均400；fps u16LE在8，24；帧数u16LE在10；256个RGB565 u16LE调色板从12开始。
- key interval在524，值12；flags在526，值1；头CRC32 u32LE在528，覆盖[4,528)。CRC算法IEEE CRC32，与现有PET4一致。
- offset表：从532开始，frames+1个u32LE，首项0、严格递增、末项等于payload长度；随后frames个索引帧CRC32 u32LE。payload起点532＋4×(2×frames＋1)。
- 每帧1字节tag：0为keyframe、1为相对上一索引帧XOR差分；第0、12、24…帧必须tag0。
- 每帧20个tile，每tile为20行×400索引＝8000原始字节；u16LE压缩长度＋LZ4独立block。先LZ4解码，再在tag1时XOR前一帧索引；最终160000索引字节重算整帧CRC，之后映射RGB565LE，共320000B。
- 除42外其余77项：241帧，约10.041667秒；42：118帧，约4.916667秒。保留24fps与原帧数，不补到241、不改速。索引范围0至frames−1。循环／once_hold／once_idle仍需完整角色语义合同确认，HTML循环预览不是设备循环策略。
- 宿主候选允许1–241帧、文件≤16MiB，仅离线审查包络；**不能把16MiB套到设备**。本批实际均低于旧5865472B单文件上限，具体大小、最大压缩tile及SHA以manifest为准。

## 设备侧必须评审的改动

1. 严格400 profile、8000B tile缓冲、160000索引／320000B RGB帧和可变实际帧数；不能仅放宽头宽高校验。
2. 三RGB＋history若保持布局为1120000B，比360多212800B；连同encoded、read-ahead、LVGL、内部RAM、栈、TLS／网络并发余量重新核算。
3. LVGL图像宽高、(33,33)定位、damage坐标／跨帧参考、整帧回退、切换清屏、圆屏裁切与退出回收；稳定黑边不能保证没有扫描或传输成本。
4. 单文件／4活跃＋1暂存Flash容量、注册和摘要、保存事务／取消／恢复、保护0/4及合法初始库存；不能把6动作或78库全放入现有缓存。
5. 118帧的播放截止、循环与keyframe随机访问、最后一帧；加载／首帧／切换耗时、漏帧、重复源帧、取消上界和失败保旧画面。
6. 与管理端M2及G0互认profile／文件与包摘要／能力，不套用旧360批准或namespace。真实pull／TLS等承载不得因样本已生成而自动启用。

建议先写设备侧Spec/Diff和离线C++字节向量测试，再准备明确的真机测试窗口及回退；设备测试和烧录须由用户另行授权。本线程未修改固件、未联系其他线程、未启动设备listener。


## 历史原M2宿主进展与容量事项

[400 M2报告](../reports/2026-10-30-native400-m2.md)已交付八语义宿主包和完整78候选。最终78文件／manifest及全帧证明在.cache/native400-m2-hc12-v1，M1六文件SHA保持不变；八语义role8与完整library78的index／provenance另存对应目录。宿主正式导入增加pet4_profile与operator approvedPet4Profiles双重显式批准，不是设备wire自动扩展。

完整库中5/17/19/20/23/35/40/48/66/67/70/76共12项超过旧5865472B单动作cap，最大67号6727882B；未自动提高cap或降画质。八语义每文件在旧cap内，但八文件总量也超过28MiB，不能全部同时缓存。设备侧需将这份真实体积清单纳入资源与存储Spec，不把先前六样本都低于旧cap推广到全部78。


## 历史压缩候选阶段（原M2保持，新合并库见顶部）

[12项压缩候选报告](../reports/2026-10-30-native400-compression.md)已提供新目录.cache/native400-compressed-candidates-v1，完整PET4都≤5865472B；5项画面完全无损，7项轻度颜色合并在当时待复核，现已确认并另建顶部新78库。旧M2的12超限数据仍对应旧文件，不能混用其摘要。新方案可在非12倍数帧增加完整key/tag0，保留强制key12、flag1、tile20与24fps／帧数；设备需核对此既有合同，不可假定每个非12倍数必是delta。未经确认不直接覆盖CAS／Flash／生产root；后续合并应重新冻结index/provenance与SHA。
