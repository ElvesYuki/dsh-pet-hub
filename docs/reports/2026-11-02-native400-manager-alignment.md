# 管理端400×400／78动作规划对齐核对

2026-11-02。先补[Spec](../context/plans/native400-manager-alignment-spec.md)/[Diff](../context/plans/native400-manager-alignment-diff.md)，本轮只读素材/固件并更新规划。**当前管理端开发目标改为400/78；360兼容回退与分层360保留，代码没有因此完成400设备适配。** [当前基线](../context/native400-baseline.md)、[共同G0交接](../context/plans/round-pet-g0-handoff.md)、[证据摘要](../protocol/vectors/native400-manager-alignment-v1.json)。

## 素材身份与二进制核对

输入为已批准compact78平铺库、library78与role8的index/provenance/文件，以及既有host-verification。只读每套逐文件SHA/长度，未复制媒体、重编码、运行生成器或真实A2导入。用本仓库Pet4Decoder构造校验头/表，并独立遍历所有帧/tile长度/tag，不重跑LZ4/CRC/全RGB解码或源视频读取；既有18675帧CRC/index/RGB/seek证据因文件SHA和证明匹配而沿用，不能改写为本轮重复完成。

| 身份域 | 本轮复核值 |
| --- | --- |
| 新源manifest原字节SHA | a1c7c2a6a6a5ffeb113e403262252739271afc18db0a6d53ab40f1ebbab94ae5 |
| 视觉审阅manifest SHA | 21142a93f4d4b15e137a931ceb2082d33cf9af3c9d72dde1657b92693fe3dd7e |
| 全78宿主index I | 5bd657d47a288b055c4806e4245c07c470ad9057edf37338c75d8450fe19df29 |
| 全78运行时M_host | 0102c312b51347530c3ac221fcbe8d53b697498fbb95ad83f53e4e7dd0817304 |
| role8宿主index I | afdda0e87d05ebad3117a25100ad330f58c6b6564adaf10c881b060ce2b92f99 |
| role8运行时M_host | 655d84299cb287daefbdce2ccc3b271039b2611f15ab1896e9a1446736fa60c4 |
| provenance原字节SHA | library78=740fade4b526a1e72dc1f768d7ed3755ef7b091acd11c261066ec918c516845f；role8=9c8719e116b2205f00ae6ff51e72220e4d2b732f522d5ed14fcc6065cb788213 |
| 未产生的设备身份 | M_device/P400/正式N400：未冻结/未生成；不能将上述index、M_host或旧360 P/M/N换名填入 |

manifest内catalog_sha256=99e85e4b…是继承的来源目录SHA，parent_manifest_sha256=db185f30…是旧合并父库；二者不是新package P。真实400来源包含有损预处理/减色，recipe、源SHA、父F和新F/索引/RGB分开保留，不继承旧压缩候选的无损标签。视觉批准已绑定新审阅manifest/全部78，不伪造用途审阅人或G0 approval。许可沿既有dsh-pet非商业/署名/SA证据，本轮不联网复核或新增授权；代码MIT不覆盖素材。

78原ID0–77、总348737057B/18675帧保持；42头确为118帧、其他241帧，全部400²/24fps/key12/flag1。额外tag0总1019，单tile压缩最大4907B≤8047；强制key12帧为tag0，其他允许tag0。实际每24帧payload窗口最大688702B＜1MiB，不含元数据和解码缓冲。该上界只对当前78版本及24帧窗口成立；新文件/预缓冲数变化须重算。最大文件67号5569645B，距旧cap余295827B；role8的31877424B仍超28MiB。新库/role8/全库身份均匹配，不重做已批准画质。

## 管理端适配缺口与具体规划

1. [通用400 profile](../../packages/core/material-profile.mjs)、[PET4](../../packages/core/pet4.mjs)及streaming/角色包支持已实现；sim_A下激活/78动作/IPC像素/恢复是宿主模拟证据。[native360-profile](../../packages/core/native360-profile.mjs)、[A2身份](../../packages/core/round-pet-identity.mjs)、[wire revision2](../../packages/core/round-pet-wire-contract.json)仍固定360/46/241帧/旧N。不能直接扩const或将现有940测试当400新设备模型验收。
2. 当前[能力schema2](../../packages/core/protocol.mjs:43)要求max_asset_bytes≤playback_bytes，选择器也按完整文件占用RAM；400窗口是1MiB压缩池、文件可达5.57MB，需要新的显式能力版本与execution_model。完整文件、窗口/三RGB/history、永久槽各自描述；不填假的5865472B playback RAM或仅增加扩展让旧推荐通过。
3. 旧R6 verified后首帧的顺序不能直接套到[400 FrameSource](/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio/apps/round-pet/devices/esp32s3-touch-amoled-175c/candidates/native400-window/frame_source.h)。固件窗口可以先帧CRC/呈现、末尾才整文件SHA。共同G0必须选渐进播放的显式完整性状态，或先全验/重读/暂存及额外成本；未选前新hub未缓存路径继续关闭。verified仍表示全F/媒体完成，首帧独立，saved须持久提交，不能将USB Done/首帧当上述所有事实。
4. 保存/淘汰与新N不能借旧V2的360根开放。保留28MiB几何、4活跃＋1暂存和保护0/4作为目标，不在本轮改分区/格式/缓存。正式400N/geometry/validator和版本/恢复策略待固件共同确认；早期只读fixture N=5dd9df30…不代表新compact安装，最新报告namespace=null。

下一按Spec的400-01身份/recipe、400-02能力/执行与时序、400-03新wire及字节对照、400-04默认OFF装配逐片实施。现360合同/80正62反和R7不变量保留为兼容测试；HTTP/session/guard/A8/有界调度复用，不重做承载优化。目录78不等于首窗口全开放，0/11远端＋physical4仍需在合法400库存和新profile下另验。共同G0是待答复文档，未发送消息/代签。

## 固件证据与资源预算

只读固件HEAD9816317…的dirty工作区与22份选定规则/代码/报告SHA；不是重建、设备探测或全部源冻结。期间codec/decoder/window入口/CMake四文件及矩阵并发变化，已重读PACKED_RGB选项/decoder栈内palette及memory_plan，证据分列前后SHA。收尾前新增0dcdf6be执行清单，251源快照/宿主/构建通过、静态PSRAM仍2322168B；外部最高性能窗口正在应用部署/保护核对，读取时设备下载模式且无新FPS。不把旧e6fe/410报告套给新源码，也不把新构建当新性能/动态证据。400候选codec/head检查、三RGB/Source/BufferPolicy/旧生产Store实际代码已核；默认360 Store只接受旧geometry/N，不把id<78当支持400。此前矩阵记原cbdf与360缓存恢复/串口释放，已被上方执行中新窗口引用限定；4bae compact实测4动作841帧、12.395–15.057fps/24未过，随后ACK门禁停。e6fe66d7/410e23e4可靠ACK/短锁候选仅宿主/构建，不当新的动态资源/性能证据。

| 工作集 | 字节与范围 |
| --- | --- |
| 400一RGB/三RGB/history | 320000／960000／160000B，三RGB已含前瞻，不再加第四帧 |
| 已报告窗口显式PSRAM | 2322168B＝1120000 RGB/history＋1048576压缩环＋5112 Source＋4096 I/O＋12288 trace＋66560 Flash ingress＋65536 USB FIFO |
| 内部scratch/任务栈 | scratch20160B（tile8000/input8064/CRC4096），worker16KiB、I/O8KiB另计；SDK/LVGL/DMA/main/网络/TLS/系统峰值不能从本表省略 |
| 旧完整encoded方案对照 | 仅5865472 encoded＋1120000新RGB/history＋65536 read-ahead已7051008B，尚缺metadata/系统/网络；不能用2322168和6916777旧值互相替代/重复相加 |
| Flash几何目标 | 29360128B；payload5865472、stride5869568，双根8192＋5物理对象=29356032B/余4096B。几何可容纳文件不证明新400Store/新N持久化已实现 |

保留内部≥49152B、PSRAM≥1048576B/最大块≥524288B、main剩余≥1024B、app≤2MiB且余量目标≥256KiB。TLS连续内部块/新任务栈、可信时间/持久凭据/撤销与重绑定、单TLS/HTTP owner、I/O退出/最坏消息延迟待400专用Spec/冻结阈值/实测。无Wi-Fi400动态内部197375B等样本不作联网准入；旧360 fc55的46527B低位失败也不能假装400重测已做。窗口16MiB宿主包络不提升设备cap，USB ACK V2不是hub JSON revision2。

## 验证、保护和回退

| 检查 | 实际结果 |
| --- | --- |
| npm run check | 退出0；现有.mjs语法检查 |
| npm test | 含构建940/940通过，0失败/取消/跳过，129761.873584ms；未新增测试，不将只读审计计为新增专项 |
| 素材审计 | 78全F/头/表/tag/tile与两个角色目录原字节身份一致；42实际帧数/1019额外key/688702B窗口及引用证明通过；未重解全帧/读源视频 |
| 实现保护 | packages/apps/scripts/tests/native既有285文件SHA保持，360合同/向量保持；无A2真实批准/导入或设备操作 |
| 外部快照 | 22份选定SHA，期间四个源码及矩阵变化已重读/记录，并补读新执行清单，未将旧构建绑定新源码，不声称全仓库冻结 |
| 文档检查 | 24份Markdown/669本地链接、JSON/空白与新旧scope核对通过，不是已实现的自动准入门禁 |

忽略审计证据在.cache/native400-manager-alignment：audit.json、audit.log、check.log、test.log、source-before-sha.json、firmware-before-sha.json、firmware-reviewed-sha.json；公开JSON只含摘要/预算/状态，不含媒体或配置。

本轮仅文档/去敏证据，未修改既有实现/固定协议/依赖；没有固件导入器/构建/测试、外部网络或设备操作。当前摘要/待办/共同G0已对齐，旧“下一360主线”[归档](../context/history/native400-manager-alignment-evolution.md)，历史测试结果不追写成400通过。回退仅本轮文档，无生产数据/批准迁移；360媒体/代码/合同、67/a7及原cbdf现场保护，未来回退按当时app/配置语义/epoch/N/完整缓存分别核验，不能以规划自动烧录或格式化。
