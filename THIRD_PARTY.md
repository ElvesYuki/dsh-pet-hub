## 四态桌面制作控制（2026-10-30）

scripts/character-states.mjs及相关自然动作/预览改动为本仓库原创MIT代码，不含外部运行库。沿用现有22个绘制层及19张表情/遮挡贴图，本轮无新增生成图或复制外部素材。贴图/内嵌HTML/WebP仍属既有形象非商业改编资料，保留上善无形、ZipZipPipe、PC2005-cloud/dsh-pet署名；仅在忽略目录.cache，不并入MIT或dist。

# 第三方与素材边界

## dsh-pet 0.4.9 的 400 复查与补录

只读来源为 PC2005-cloud/dsh-pet `v0.4.9`（`4e589f6dacabbd3170e91e7a213b2a7afff1a09b`）内置 WebM，使用本机已安装同版副本并与上游 Git 树摘要对照。原型「溟月」署名上善无形，女仆鲸鱼娘设计署名 ZipZipPipe，动画来源署名 PC2005-cloud/dsh-pet。仅作本地非商业裁切、黑底合成、预览和编码，原素材与派生媒体均适用上游公布的 CC BY-NC-SA 4.0 形象边界，媒体仅存忽略目录。复查与编码代码为本仓库原创 MIT，仅使用本机 FFmpeg/libvpx。 [固定许可说明](https://github.com/PC2005-cloud/dsh-pet/blob/4e589f6dacabbd3170e91e7a213b2a7afff1a09b/README.md#许可) · [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)

## 无音频说话嘴型（2026-10-29）

内置imagegen基于现有中性角色与微笑嘴制作透明微张/张口/圆口图集，工作副本和提示词保存.cache/layered-character/character-speech-assets-v1/speech-atlas-source.png、speech-provenance.json，原生输出另保留。既有16张表情贴图不改，新嘴型/内嵌HTML/WebP仍沿用现有形象非商业改编边界及上善无形、ZipZipPipe、PC2005-cloud/dsh-pet署名，不属代码MIT。character-speech.mjs与prepare-character-speech-assets.mjs为原创MIT离线控制/装配工具，无第三方语音或音素SDK，不进入dist。

## 面部表情候选（2026-10-29）

内置imagegen以既有中性源图/眼层为参考生成局部表情图集，当前副本及原提示词在.cache/layered-character/character-expressions-v6/atlas-source.png、provenance.json，原输出另保留。素材仍沿用上善无形、ZipZipPipe、PC2005-cloud/dsh-pet署名与既有非商业改编边界，不属代码MIT，不代表原作者认可。半闭眼采用原虹膜像素裁剪加新眼睑，闭眼/笑眼/首批眉嘴按局部配准；无整个人物重生成。character-expression.mjs与prepare-character-expressions.mjs为原创MIT离线逻辑/装配；贴图/内嵌HTML/WebP不进入Git或dist。

## 自然呼吸与桌面触摸（2026-10-29）

character-natural-motion.mjs、character-natural-preview.mjs、character-natural-preview-page.mjs为原创MIT纯逻辑/DOM制作适配/页面模板；未引入第三方物理或骨骼SDK，不进入现有插件dist。使用既有v5纹理作几何变换，本轮未新调用imagegen。离线HTML内嵌纹理、截图、WebP均沿用原形象非商业改编许可/署名，非代码MIT；仅存.cache/layered-character/character-natural-motion-v3，制作预览压缩不替换母版。

## 小角度桌面检查与技术重叠修订（2026-10-29）

character-motion-probe.mjs、character-motion-preview.mjs与prepare-character-motion-probe.mjs为原创MIT离线检查工具，不含第三方骨骼运行库，不进入插件dist。v5母版仅对既有原生贴图做被遮挡的3px边缘延展；预览用真实图层矩阵绘制，8秒WebP来自浏览器Canvas帧，经既有Sharp工具无损编码。没有新调用生成服务或改变可见形象许可。所有PNG/SVG/OpenRaster/WebP/内嵌贴图HTML仍沿用原形象非商业改编边界与署名，只存.cache；不能按代码MIT发布素材。

## 21层角色静态母版（2026-10-29）

scripts/character-master.mjs、prepare-character-master.mjs及character-layout-v1.json为原创MIT离线制作工具/布局，不进入dist。沿用冻结候选与已登记连续后发补画，另用内置imagegen编辑旧头部参考为无五官皮肤底层，仅作遮挡补画；不替换已确认的可见形象。21层PNG/SVG/OpenRaster、原提示词与源SHA仅存.cache/layered-character/character-master-v4；署名上善无形、ZipZipPipe、PC2005-cloud/dsh-pet，仍按既有非商业改编边界使用，美术不属代码MIT。该记录不代表原作者认可或取得新的授权。

## 十二层头发静态首稿（2026-10-29）

补画候选另存hair-master-v4，内置imagegen另生成连续后发填色源，与遮挡下头部底色源一起只用于隐藏面。complete-hair-static-master.mjs为原创MIT静态补画装配工具，保留每层原可见像素、记录真实alpha合成差异，独立归档原提示词与素材SHA；不将候选配准或微小像素差异称作原作者认可/已完成动态验收。补画PNG/SVG/OpenRaster仍沿用原形象署名及非商业许可，不属代码MIT。

scripts/hair-static-master.mjs、prepare-hair-static-master.mjs及分割布局为原创MIT离线制作/校验代码。使用冻结360底稿原像素按布局分离12个可见发束及rest，不创造新的美术许可，PNG/SVG/OpenRaster与标注资料仅存.cache/layered-character/hair-master-v2，不进Git/dist。独立图层仍是既有形象的非商业改编参考，署名上善无形、ZipZipPipe、PC2005-cloud/dsh-pet。

遮挡下头部补画参考另用内置imagegen制作，原提示词与透明原图保存在同目录；它不替换已确认的可见脸部，也不自动视为已配准/已验收。可见面分离、隐藏补画及动态验收分别记录。离线纹理渲染/PNG编解码复用预装Sharp，不安装或打包新的项目依赖。

## 360标准底稿导出（2026-10-29）

scripts/export-character-base.mjs为原创MIT离线校验/导出协调工具，实际导出只显式使用已有工具环境的Sharp 0.35.5（Apache-2.0）及其SVG渲染依赖librsvg 2.63.2（LGPL-2.1-or-later），未安装、复制或打包这些工具依赖到项目/插件/固件。测试用原创几何PNG，不依赖外部美术或渲染库。注册SVG栅格化得到的360 PNG仍是现有候选美术的非商业改编，不属代码MIT；仅保存.cache/layered-character/authoring-base-v1，不改变原形象许可或署名。此步骤不调用图像生成服务。

## 部件草稿与注册包装（2026-10-29）

用户认可整体方向后，内置imagegen另生成一张九部件透明图集首稿，仍待精确位置、边缘和叠放验收；只保存在.cache，当前按用户要求优先校准，不继续扩大部件制作。scripts/character-registration.mjs为原创MIT等比坐标计算与SVG包装工具；SVG嵌入既有候选PNG，不改栅格内容、不构成新增MIT美术或可编辑骨骼。来源和非商业边界沿用中性候选记录。

## 中性静态美术候选（2026-10-29）

内置imagegen基于P0动作0/frame0生成两版透明背景完整角色候选，属于现有形象的本地非商业改编参考；来源署名沿用上善无形、ZipZipPipe、PC2005-cloud/dsh-pet，素材不属代码MIT。原图、提示词和本地对照资料仅存.cache/layered-character/neutral-review-v1，不进入Git或候选包；不复制其他Live2D模型或声称已取得分层源工程。生成候选尚未获用户形象确认，亦非可编辑分层成品或设备可播放资源。

## 分层角色P0本地制作参考（2026-10-29）

scripts/prepare-character-reference.mjs为本仓库原创MIT离线导出工具，复用本仓库PET4解码/RGB565转换及Node内置zlib，无新增第三方依赖、无复制或执行外部固件源码。输入为既有审核原生360库（上游86181ce1660a57ab27336630bab5b344de71b28c，manifest SHA256 a6a2ddae50a8fe4ddf15ff07a3a228dccf865bb91a037693ce0a72232204c39e）。导出的原尺寸PNG、HTML和摘要仅在忽略目录.cache内作本地非商业制作参考，不属于MIT素材，不进入Git或候选包；署名上善无形、ZipZipPipe及动画来源PC2005-cloud/dsh-pet。后续拆层/补画/AI辅助仍独立核验素材许可，不把公开Live2D运行模型的转载说明当作本轮已取得可编辑工程或通用授权。

本仓库新增代码使用根目录MIT LICENSE；P0无第三方运行/开发依赖，没有在版本化文件中复制固件或pet源码、动画。

- dsh-pet（PC2005-cloud）：代码MIT，接口调查使用本机0.3.8；素材基线引用提交86181ce1660a57ab27336630bab5b344de71b28c。
- 动画/提示词/源视频及形象不由本仓库MIT授权。固件记录其非商用限制及形象CC BY-NC-SA 4.0；二创署名、传播与商业用途必须重新核对上游原许可。形象原型“溟月”来自@上善无形，女仆鲸鱼娘设计来自@ZipZipPipe。
- 固件仓库ai-embedded-studio为Apache-2.0，未来复制代码需保留许可证/署名并审查NOTICE要求；本轮只引用事实，没有迁入代码。
- 固件PET4用LZ4 1.10.0（BSD-2-Clause），本仓库未包含官方LZ4源码或版本化动画；后续独立JS格式解码实现见下节。

来源：https://github.com/PC2005-cloud/dsh-pet/blob/86181ce1660a57ab27336630bab5b344de71b28c/README.md#许可

## PET4离线解析（2026-10-29）

- 来源/许可复核：直接读取固定提交86181ce1660a57ab27336630bab5b344de71b28c的README许可段，与外部tools/round-pet/THIRD_PARTY.md一致。只做本地非商业校验，不把动画/形象并入MIT或打包发布，署名仍为上游及@上善无形/@ZipZipPipe。
- PET4布局参考：只读外部compress_lossless.py、native360_assets.py、media_contract.py和components/pet_media/pet_media.cpp；它们受外部仓库Apache-2.0约束，本次未复制/执行其代码，独立重写JS解析器。新解析器为本仓库原创MIT。
- LZ4块格式参考：https://github.com/lz4/lz4/blob/v1.10.0/doc/lz4_Block_format.md 。独立实现块格式解码，无LZ4官方源码/二进制移入、无第三方依赖；原固件的LZ4 1.10.0仍是BSD-2-Clause，不能称JS实现为官方库。

## 离线帧预览（2026-10-29）

packages/simulator/pet4-sample.mjs为本仓库原创MIT几何动画/PET4生成器，仅合成测试与独立预览使用；不包含上游角色图。真实角色帧仍仅对既有审核来源做本地非商业解码核对，像素/动画不进入Git或候选包。新增RGB565画布转换与运行层无第三方依赖。

## 单侧抬手素材制作（2026-10-30）

本轮内置imagegen以冻结360底稿与原arm_right层为参考补画独立袖臂掌候选；原脸/身体/头发不重生成。生成源图、提示词与注册产物仅存.cache，沿用上善无形、ZipZipPipe、PC2005-cloud/dsh-pet署名和现有非商业改编边界，不构成新授权或原作者认可，不纳入MIT或dist。新增装配脚本为原创MIT代码，未复制外部工具或增加项目依赖。

## 短挥手制作控制（2026-10-30）

character-wave.mjs及预览/导出器可选挥手装配为本仓库原创MIT代码，无外部动画SDK。复用原arm_right与已登记的单侧抬手生成图，本轮没有新生成或复制素材；肩腕注册/图层混合及WebP为本地制作派生产物，仍沿用原非商业改编边界和上善无形、ZipZipPipe、PC2005-cloud/dsh-pet署名，均留.cache，不纳入MIT或dist。

## 挥手轮廓插值（2026-10-30）

character-arm-morph.mjs为本仓库原创MIT局部RGBA轮廓/颜色插值实现，未复制外部距离场/形变库，无新增依赖或生成图；只在桌面制作中重用既有两张手臂。派生PNG/HTML/WebP仍仅.cache本地非商业，保留原形象署名，不进入MIT素材范围或dist。

## 分层角色包 L1（2026-10-30）

新增layered-character-*核心字段/JSON/固定profile合同、Node只读字节/目录审计与受限PNG解码器为本仓库原创MIT实现，复用既有CRC32及Node内置fs/crypto/zlib，无复制上游实现或新增依赖。参数和支点来自本仓库既有制作代码/制作规范，只作为当前基线数据，不构成图像授权。simulator/layered-character-fixture.mjs生成原创几何矩形PNG供测试，未复制真实角色图，fixture按既有构建规则排除在插件dist之外。真实形象素材许可维持独立边界，本轮未导出/打包原素材。

## 共享角色行为参数（2026-10-30）

本仓库原创MIT character-*纯求值模块迁入core，scripts保留兼容转导；新增固定behavior快照入口及合成事件/数值golden回归，无复制外部引擎或新增依赖。既有角色图/非商业改编许可与署名保持，本轮未新生成或修改素材。core代码可进入候选dist，不携带原PNG；本地原代码对照副本只在.cache，不作为第二套运行实现。

## 分层角色包导出（2026-10-30）

layered-character-export.mjs与prepare-layered-character-package.mjs为本仓库原创MIT离线装配/发布代码，复用现有严格JSON、PNG、SHA与安全读取，无新增依赖或外部实现。实际包只复用已登记master-v5、speech-assets-v1与raised-arm候选的原PNG，SHA/署名/许可相互核对，未新生成或转码。图包/回执只存.cache，沿用上善无形、ZipZipPipe、PC2005-cloud/dsh-pet署名及非商业改编范围，不纳入代码MIT或dist，不代表原作者认可。测试authoring fixture仅为原创几何图与合成元数据，未复制真实形象。

## 分层角色包独立加载（2026-10-30）

共享CRC32/PNG纯逻辑、浏览器File/WebCrypto/DecompressionStream校验、候选生命周期、Bitmap准备器与HTML装配为本仓库原创MIT代码，无第三方动画SDK、安装依赖或外部代码复制。原自然预览迁入ui共享，scripts保留兼容入口。未生成或改变任何美术字节；实际载入的33张PNG仍为现有非商业改编素材，沿用上善无形、ZipZipPipe、PC2005-cloud/dsh-pet署名，只保存在.cache，不纳入代码MIT或提交。HTML内置的仅为可信代码，不内嵌人物素材。

## 分层角色L3宿主验收（2026-10-30）

simulator内精确RGBA/姿态比较器、资源观察器和scripts内隔离QA装配/临时白名单HTTP工具为本仓库原创MIT代码，使用Node及浏览器内置API，没有外部SDK/新依赖或素材生成。真实包仅复制到.cache作非商业验证；冻结v4 HTML含既有非商业改编图，只显式用作可信基线，许可/署名不变。simulator和QA脚本不进入生产dist；仅自然预览的预期关闭报错处理进入共享UI。

## 高分屏预览（2026-10-30）

character-display.mjs及自然预览的规范/显示画布分离、矩阵采样、监听回收为本仓库原创MIT实现，使用浏览器内置Canvas/MediaQuery API，无新依赖或外部渲染SDK。包、360原PNG及人物布局未修改；显示截图和GPU读回证据仅在.cache，本轮未生成/锐化/重采样导出新素材，原非商业素材许可与署名保持。

## round-pet A2离线身份适配（2026-10-30）

新增canonical/包/批准适配、runtime来源记录、worker严格分支及原创PET4 fixture为本仓库原创MIT代码，复用既有JSON/PET4/Node内置API，零新依赖。只读核对外部media_contract.py导出数据形状（SHA e311a51498c34b8347cf99420f7941221b690602590de08dcebecc354da7d729），未复制/执行上游实现，没有访问或导入真实角色大库。46测试描述和恒定索引241帧PET4全部原创，不含上游画面。现有形象非商业/署名/CC BY-NC-SA边界保持，source_kind/独立批准字段不是新许可或作者认可；真实P/ID/来源许可仍待联合核定。

## round-pet A3观察候选（2026-10-30）

新增观察reducer/严格对象合同/公共白名单、内部review与只读UI、原创状态golden和WeakMap合成proof为本仓库原创MIT，零第三方依赖。未读取/复制固件实现或素材、无真实媒体导入，原形象非商业/署名边界保持；候选对象不是固件回执或真实认证证据。

## round-pet A4主动pull候选（2026-10-30）

新增有界queue/canonical候选codec、显式handler/实际HTTP退出owner及原创Node mock/golden为本仓库原创MIT，复用既有Node HTTPS/crypto、session/scoped、PET4与临时OpenSSL测试工具，零新依赖。46合成描述共享原创恒定索引241帧PET4，A2 recipe核独立test批准/P/M/N，不含真实人物素材。未读取/复制固件或pet实现，真实素材非商业/署名与代码许可边界保持。

## round-pet A5默认OFF装配（2026-10-30）

新增共享owner、同fd校验证据/磁盘reader、公共装配白名单、只读UI及隔离集成fixture/监督CLI均为本仓库原创MIT代码，复用既有Node内置API、A2/A3/A4及临时OpenSSL工具，无外部代码复制/新依赖。测试仍为原创360恒定索引241帧PET4和46合成描述，未读取真实人物素材/固件/pet实现或更改动画许可；真实形象非商业/署名边界不变。临时PKI不进入Git或dist。

## round-pet A6模型执行对照（2026-10-30）

simulator执行适配器、独立时钟/模型事务/故障注入fixture、专项及CLI为本仓库原创MIT，复用A1/A2/A3/A4/A5和Node内置测试/临时OpenSSL工具，无外部代码复制或新依赖。媒体仍为原创恒定索引241帧PET4/46合成描述，未读取或导入真实角色、固件或pet实现。内存Flash不是固件V2代码/二进制布局，模型帧不是物理面板；真实素材非商业/署名边界保持。临时PKI/数据不进入Git或dist，simulator沿用构建过滤。

## round-pet A7会话/检查点候选（2026-10-30）

A1受信会话边界、根检查点验证/维护评审、A3/A4/A5显式装配与临时专项为本仓库原创MIT，复用既有Node/crypto/临时OpenSSL测试路径，无外部实现复制或新依赖。模型故障移除使用原创测试字节，未读取真实素材/固件/pet。原动画非商业/署名边界不变；临时JSON检查点/PKI不进入Git或dist，不是新许可或绑定批准。

## round-pet A8根权威持久化（2026-10-30）

同文件根CAS/新profile、A3私有候选、A4分阶段提交、显式装配及临时SIGKILL/TLS专项为本仓库原创MIT，复用现有Node fs/crypto/临时OpenSSL工具，零新依赖/外部实现复制。仅原创测试媒体/合成元数据，未访问真实人物素材/固件/pet。新JSON格式不是绑定批准、动画授权或固件V2二进制布局；临时PKI/权威文件不进入Git或dist，真实动画许可/署名保持。

## round-pet A9持久成本计量（2026-10-30）

固定root数值metrics、假设预算、同负载/容量及严格证据校验为本仓库原创MIT，使用现有Node fs/crypto、TLS与临时OpenSSL工具，无第三方代码/新依赖。媒体仍为原创恒定索引241帧PET4/46描述，未访问真实形象、固件或pet；新计量不改变素材许可/署名。证据只含固定数值/控制kind编号，不保存真实元数据/端口/凭证，测量和supervisor模块不进入插件候选。

## round-pet A10局部减量（2026-10-30）

私有同次校验/编码摘要复用、noop锁内减量、固定数值计数与对照/负例/supervisor为本仓库原创MIT，复用现有Node内置API/OpenSSL临时工具，无复制上游实现/新依赖。仍仅原创恒定索引241帧PET4/46合成描述，未访问真实角色/固件/pet；原动画许可与署名要求保持。临时权威数据/PKI和忽略目录去敏证据不进入Git/插件候选，策略不构成固件绑定或素材批准。

## 400原像素 M0 审阅（2026-10-30）

scripts/prepare-native400-review.mjs、native400-review-page.mjs及合成测试为本仓库原创MIT。真实78份WebM仅从本机已安装pet只读复制到忽略的独立预览目录，每份SHA与固定86181ce来源catalog的source_sha256一致；没有执行上游脚本或调用pet接口。视频、PNG缩略图和完整HTML评审目录沿用上善无形／ZipZipPipe／PC2005-cloud/dsh-pet既有非商业许可，不进入Git或插件dist；不代表新动作批准或设备播放授权。使用本机已有ffmpeg/ffprobe，不安装或打包它们。

## 400第二轮边缘筛选（2026-10-30）

scripts/audit-native400-edges.mjs及合成测试为原创MIT离线测量工具；使用已有ffmpeg/libvpx读取M0已批准副本的alpha，不复制上游实现。红色诊断图、真实逐帧指标和筛选HTML仍含既有角色素材，仅进忽略目录，沿用上善无形／ZipZipPipe／PC2005-cloud/dsh-pet非商业署名，不随代码MIT或插件发布。

## 400 M1六动作编码小样（2026-10-30）

pet4-encode.mjs、prepare-native400-samples.mjs、repack-native400-lz4.py及verify-native400-samples.mjs为本仓库原创MIT；没有复制固件、上游或LZ4实现。离线HC12重打包／独立解码显式调用本机已安装liblz4（库目录BSD-2-Clause，本地LICENSE已核对），不复制或随项目分发动态库；ffmpeg/libvpx同样只使用本机已装工具，不新增npm依赖。实际角色源、PET4、PNG/APNG及内嵌预览沿用既有上善无形／ZipZipPipe／PC2005-cloud/dsh-pet非商业素材许可，仅存忽略目录，不因编码器MIT变为可商用素材。


## 400 M2宿主候选库（2026-10-30）

新增material-profile.mjs、管理测试及catalog/验证工具为原创MIT；78候选延续M1原创量化／LZ4参考与显式本机liblz4 HC12路线，不新增包依赖或复制库源码。PET4、来源与生成证明、原像素PNG/APNG仅存忽略目录，沿用既有非商业素材许可，不随插件dist或代码MIT发布。

## G0-R1真实素材来源复核（2026-10-30）

固定86181ce提交README/代码LICENSE经GitHub只读连接复核；46本地源视频SHA256与固件manifest一致，git blob SHA1/长度与该固定提交公开目录一致；46既有PET4由本仓库解码器全F/CRC/index重核。媒体仅原目录只读，无复制/导入CAS/新授权。公开[复核向量](docs/protocol/vectors/round-pet-g0-real360-review-v1.json)仅无秘密摘要/编号，代码MIT、固件Apache-2.0与LZ4 BSD边界保持，无复制上游实现或新依赖。

许可依据已于2026-11-02[证据核定](docs/reports/2026-11-02-round-pet-g0-closure-review.md)刷新：[固定README](https://github.com/PC2005-cloud/dsh-pet/blob/86181ce1660a57ab27336630bab5b344de71b28c/README.md#许可)原SHA保持，明确代码MIT、素材非商业及公开衍生标源；[ZipZipPipe原声明](https://www.bilibili.com/opus/1247156596114456581)及[CC官方法律文本](https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.zh-hans)本次已直接取得，替代旧503未读到的状态。署名/来源与许可链接、转换改动说明及非商业/分享演绎时SA须分别落实，上善无形/ZipZipPipe/PC2005-cloud来源保留。声明支持个人定制，不构成全部衍生视频的独立权属保证或商用许可。license_ref=upstream-reference-only仍不自证A2批准；本轮不生成真实360用途approval/导入/分发。内部审阅不是要求作者逐次额外授权，记录用途/范围及精确P/M/N/source后由受信调用方提供；保留license_ref可保持M/P，实际改字段则重算再审。旧状态已[归档](docs/context/history/round-pet-g0-closure-review-evolution.md)。

## G0-R2首窗口与提交边界（2026-10-30）

新增纯core策略/行为模型、A5显式门禁、A1逻辑gate/恢复与A6显式模拟命中结果、专项/监督入口为本仓库原创MIT，复用现有Node内置工具及临时OpenSSL，无复制外部固件/pet实现或新增依赖。本轮未访问真实素材/固件，测试仅原创逻辑字节与恒定索引241帧PET4/临时PKI；原非商业素材/署名及独立approval缺口保持。新profile不构成新素材批准、实体能力或固件V2字节格式。


## 400压缩候选（2026-10-30）

optimize-native400-lossless.py、quantize-native400-to-limit.py、verify-native400-compression.mjs及合成测试为原创MIT；仅显式调用已装liblz4和ffmpeg，未复制其源码。重排／颜色合并后的PET4、对照PNG/APNG、HTML仍沿用上善无形／ZipZipPipe／PC2005-cloud/dsh-pet非商业素材边界，全部仅.cache；不覆盖既有素材或随插件发布。

## 400批准候选合并（2026-10-30）

merge-native400-candidates.mjs与合成身份／批准／拒绝覆盖测试为原创MIT，仅复用Node内置库；目录工具增加明确合并recipe及来源链。新库是既有非商业素材的选择性复制，不引入新外部代码、依赖或许可批准；全部PET4与证明仅.cache，不进入Git／插件dist。用户颜色确认不消除原始形象许可证据及设备准入边界。


## G0-R3协议与独立宿主oracle（2026-11-02）

round-pet-wire.mjs、闭合契约表、native/round-pet-wire-check.cpp、固定向量及专项/监督入口均为本仓库原创MIT。C++17使用已有系统clang与标准库，不复制固件/上游实现或引入JSON库/第三方包。向量仅虚构身份/摘要占位与原创descriptor，不含动画；固定媒体namespace仅为兼容标识，不授予素材许可。没有新读取/复制真实素材或固件、没有新approval；真实360素材既有非商业署名/原始声明与用途审阅缺口保持。C++是宿主数据oracle，非ESP固件/资源验证产物，不随插件运行入口启用。

## 400四动作图像预处理实验（2026-11-02）

新增native400-preprocess、prepare／encode工具、HTML包装与合成测试为原创MIT；复用本仓库裁切／量化／独立decoder及原创HC12封装，仅显式使用已有ffmpeg／libvpx-vp9／liblz4，无新包安装或外部源码复制。实际视频／PET4／截图／本地加载包装只.cache，保留上善无形／ZipZipPipe／PC2005-cloud/dsh-pet非商业素材边界，不随插件发布。量化可选色数默认保持256；实验批准不等于素材许可或设备安装批准。


## G0-R4临时宿主 adapter（2026-11-02）

round-pet-wire-review.mjs、A3显式wire规范化/一次来源校验、session按socket挑战清理、ledger初始高水位、合同修订2与新增向量、原创fixture/专项/监督入口为本仓库原创MIT。仅复用既有Node、临时OpenSSL/PKI、A2原创恒定PET4与现有C++宿主oracle，无新增第三方依赖/实现复制。R3原始合同/向量归档亦为原创数据，无真实动画/凭据/网络配置。未读取固件或真实素材、未生成真实库approval；代码MIT不改变现有角色非商业/署名及独立许可缺口。

## 400全78动作压缩优先扩展（2026-11-02）

复用前述原创预处理／编码／实际PET4预览；新增实际帧数适配、汇总CSV及动态动作／档位页面和边界测试均为原创MIT。无新外部算法、包依赖或安装；重新从既有同SHA源视频生成的78候选继续沿用上善无形／ZipZipPipe／PC2005-cloud/dsh-pet非商业素材边界，只放.cache。用户选择压缩档授权批量制作，不等于新许可、全动作人工验收或设备安装批准；旧素材及交接身份保留。


## G0-R5临时GET/分段（2026-11-02）

round-pet-read-lane.mjs、asset-stream.mjs从本仓库MIT的A4实现提取，临时GET装配/fixture/30专项/监督入口及固定路径前缀扩展亦为原创MIT。仅Node内置库及既有OpenSSL临时PKI，无外部实现复制或依赖安装。完整PET4仅原创恒定index测试字节，运行时临时生成/全F/CRC/index校验；没有读取/复制真实角色素材、固件或运行配置，没有新真实许可批准。R3合同/80正62反向量保持；代码MIT不覆盖既有动画非商业/署名许可。

## 400全量压缩版批准归档（2026-11-02）

finalize-native400-compact.mjs、批准绑定／身份／参数／容量与拒绝覆盖测试及目录来源链扩展为原创MIT，复用Node内置库及本仓库独立decoder；没有重新编码、外部代码复制、依赖安装或许可升级。78素材字节沿用已审阅压缩候选，只在新.cache平铺库／角色目录复制，旧库与对照保留；仍为上善无形／ZipZipPipe／PC2005-cloud/dsh-pet非商业素材，不随插件dist或代码MIT发布。用户视觉批准只确认本版画面与合并范围，不是设备资源／固件／素材用途的新批准。


## G0-R6 A1 actor新wire执行（2026-11-02）

既有MIT模拟executor的显式wire模式、fixture/30专项/监督入口与loading/EMPTY窄修正均为本仓库原创；直接复用本仓库A1模型/Memory medium、PET4校验及R4/R5临时TLS/A2/A8，无复制固件/上游代码或新增第三方依赖。所有媒体仅原创恒定index PET4/46合成ID，运行时临时生成，无真实角色读取/复制/独立许可批准。模型首帧/内存Flash不等于硬件刷新/持久格式，代码MIT不覆盖既有真实动画非商业署名边界。


## G0-R7 gate失联恢复（2026-11-02）

显式新wire模拟executor的单个本地完成任务/opaque token、暂停/过期注入/关闭等待、fixture清理钩子及30专项/监督入口均为本仓库原创MIT，复用原A1/Flash/Memory medium和既有临时PKI/TLS；无外部实现复制或新增依赖。素材仍原创恒定index PET4，没有读取真实角色/固件或创建真实素材许可批准。内部模型token/诊断不进入协议或插件产物，代码MIT不覆盖真实动画既有非商业/署名边界。

## 共同G0只读证据核定（2026-11-02）

新增Spec/Diff、报告及去敏证据JSON为原创文档；只读正式46 PET4/三元数据和固件许可/实现/报告，无复制实现、素材、凭据或新依赖。公众README/代码LICENSE仅存自有忽略审计目录；新许可原文是证据补齐，400画质批准/原创测试批准不继承为正式360用途批准。本仓库MIT、固件Apache-2.0及LZ4 BSD-2-Clause继续分开。

## 管理端400目标对齐（2026-11-02）

本轮只读已批准compact78媒体/元数据和22份固件文件/报告，规划与去敏证据为原创文档，无复制实现/新依赖/媒体入Git或固件脚本执行。新400库license_ref=dsh-pet-nc-86181ce，来源/父文件/视觉批准与未来A2独立用途输入分别处理；旧360 upstream-reference-only/P-M-N不迁移给400，代码MIT不覆盖素材非商业/署名/SA。许可原文沿[既有核定](docs/reports/2026-11-02-round-pet-g0-closure-review.md)，本轮保持离线、未重新联网或创建批准。400成为开发目标不构成商业分发、设备安装或生产通道授权。

## 400-01离线身份与profile（2026-11-02）

新core身份/候选转换、runtime策略、原创黑色索引PET4 fixture、固定golden/专项/CLI为本仓库原创MIT，仅Node内置crypto/fs/worker及既有独立PET4/canonical。无第三方实现复制、新依赖或媒体入Git。fixture许可/用途只覆盖原创测试字节，不迁移为真实角色批准。

真实compact78保留dsh-pet-nc-86181ce及非商业/署名/SA来源；本轮仅只读源/index/78 F与新recipe候选P/M/N计算，无真实用途审阅人/approval、CAS导入或分发。N_offline只是管理端兼容标识，不授予素材或设备使用权，不更改既有形象/动画许可。旧尺寸素材/源码只作备份回退，不把代码MIT扩大为素材许可。

## 400-02离线帧窗口（2026-11-02）

新纯core actor/能力review、PET4显式tile导出、原创确定性索引/XOR/extra-key测试媒体生成器、48专项/监督CLI及review JSON均为本仓库原创MIT；复用既有独立LZ4/CRC/canonical和Node内置crypto，无复制固件/第三方实现或新增依赖。本轮未读取或复制真实动画/固件，原创fixture批准不适用于真实角色；现有真实素材非商业/署名/SA边界保持。逐帧SHA收据与本地session token不进入生产协议，不构成素材用途或设备准入批准。

## 400-03独立review协议与宿主字节（2026-11-02）

新合同表/纯core编解码/素材引用与HTTP元数据核对、原创fixture/94正116反JSON、生成/监督脚本与36专项为本仓库原创MIT，无第三方依赖。native/native400-wire-check.cpp复用本仓库既有MIT round-pet-wire-check.cpp的通用JSON parser/canonical/matcher代码并独立实现400语义；旧文件原字节保持，没有复制固件或外部JSON库。UTF8/canonical规则和fixture复用本仓库已有原创实现，不读取/分发真实动画或产生真实用途批准。

向量中的描述/哈希/ID均为原创测试输入，不是本机运行配置、原始设备响应或凭据。测试临时C++产物退出清理；此宿主oracle不是ESP代码/资源或TLS互操作证据。本仓库MIT继续不覆盖真实400素材既有非商业/署名/SA许可，review N/profile/verification字段也不授予设备或素材使用权。

## 400-04默认OFF临时宿主（2026-11-02）

受信profile校验、400观察投影/adapter/handler、原创模拟peer/临时lab、37专项与监督CLI为本仓库原创MIT；复用本仓库既有Registry/session/MTLS/guard/A2 CAS/read lane/writer/queue，未复制外部实现/固件或增加依赖。媒体只为原创恒定索引与确定性非零XOR PET4，源/批准/临时CA和密钥只在独立测试环境生成，不是实际角色用途授权或设备凭据。

local4源是显式原创fixture，不表示真实设备ROM/Flash库存或触摸已具备；测试软件首帧、JSON验证、TLS peer不替代实体刷新/生产资源证据。本仓库MIT继续与真实动画非商业/署名/SA及固件许可分离，不提交媒体大文件、原始状态、密钥、端口或本机配置。

## 400-05离线调度（2026-11-03）

新纯core仲裁、显式模拟pump/本地源reader、既有候选的opt-in调度/观察适配、35专项/监督CLI均为本仓库原创MIT，复用既有原创PET4 fixture/session/guard/CAS/lane，不复制外部代码/固件/动画，无新增依赖。local4文件只在自有临时环境生成、逐段读取并清理，不是设备ROM/Flash或真实用途授权；全程未读取真实素材/固件。真实动画非商业/署名/SA边界与代码MIT继续分开，旧尺寸备份保持，不保存PKI/原始响应/本机配置到Git。

## 400-06共同G0只读评审（2026-11-03）

本轮新增Spec/Diff、管理端决定/时间算术、报告与去敏摘要为本仓库原创MIT文档；只读参考固件Catalog/窗口/prefetch/显示/旧Store及其报告，未复制上游代码或运行其脚本/测试/构建。未读取实际动画、整片/NVS备份、凭据/网络配置，未创建真实用途批准/素材导入或新运行依赖。外部固件/真实素材许可继续分别遵循原边界；固件已装N_boot与管理端候选N/P/M对应关系尚未授予生产/素材用途准入。

## 400-07周期预算与原创长负载（2026-11-03）

新pure预算、临时候选/模拟driver适配、24专项/监督CLI及文档为本仓库原创MIT，复用原owner/session/guard/CAS/lane，无新第三方依赖。新增denseAction仅生成原创241帧PET4、5564915B/170段、非零XOR与extra，未读取或重编码真实动画/固件；原small/large fixture字节/metadata保持。临时PKI/原始素材/CAS/故障成本只在自有测试根/忽略.cache，不入Git。新检查是离线成本声明，不赋予真实素材用途/设备准入，MIT与既有真实素材非商业/署名/SA边界保持独立。

## 400-08 N_boot只读来源审阅（2026-11-03）

新增JS core parser/独立mapping批准/runtime流式审阅、原创稀疏fixture、44专项/监督CLI/文档均为本仓库原创MIT；复用本仓库CRC/uint64/canonical/native400Metadata与Node内置fs/crypto，无新依赖。只读参考ai-embedded-studio（Apache-2.0）boot_catalog.h、native400_boot_image.py的V2字节布局/格式常量；已核其LICENSE，不复制、翻译迁入或执行上游实现，不引入固件构建/脚本。参考路径/SHA单独登记于本片证据。

.fixture只在自有临时目录生成，payload使用本仓库原创PET4，与固件真实批准sample身份不匹配，不是安装/分发真实角色的镜像；不读真实cache/动画/带NVS整片、凭据或网络配置，不写来源/CAS/设备。映射批准usage仅offline-source-review，真实素材仍保非商业/署名/SA和独立用途边界，代码MIT不授予实际素材/设备权限。

## 400-09 来源审阅保存与展示（2026-11-03）

新增journal/owner/纯公开视图/只读renderer及测试由本仓库MIT代码独立实现；复用400-08的本仓库inspector与实际reader，不复制或运行固件/上游代码。本轮没有读取真实素材、cache、固件或备份，也不授予真实素材新用途；fixture仍为本仓库原创MIT稀疏数据，非设备安装镜像。历史map保批准决定的ID/许可/credits摘要，但重开须调用方重新独立提供批准，账本不自授权；不输出或写入设备确认。见[API](docs/protocol/native400-source-review-storage.md)/[证据](docs/reports/2026-11-03-native400-09.md)。

## 400-10 临时宿主来源审阅（2026-11-03）

新装配/测试代码MIT；仅复用本仓库400-08/09及UDS/代理/UI，无上游代码复制、外部素材或固件读取。双进程fixture的批准输入只对应原创MIT数据并保存在自有临时根，非真实素材许可或运行配置交付；不入Git。只读status的来源证据不构成设备用途批准/安装/库存，见[装配API](docs/protocol/native400-source-review-host.md)/[报告](docs/reports/2026-11-03-native400-10.md)。

## 400-12 内部来源选择（2026-11-03）

新增选择/测试/CLI及旧reader共享指纹抽取由本仓库MIT代码实现；未复制上游代码或读取真实素材/cache/固件。fixture仍为本仓库原创MIT、非真实安装镜像；选择元数据不授予真实素材用途，不代媒体/设备证明。路径、指纹、引用只在自有临时进程内，不入Git，见[API](docs/protocol/native400-source-selection.md)/[报告](docs/reports/2026-11-03-native400-12.md)。

## 400-13 内部审阅控制器（2026-11-03）

新增控制器、纯允许字段投影、测试/CLI及owner可选授权gate由本仓库MIT代码实现，复用原选择/reader/journal，无上游复制或外部素材/固件读取。会话handle、选择引用和请求输入仅在自有临时进程中，不写Git/持久档；来源用途批准仍独立，不能据内部授权生成设备库存/播放/保存。见[API](docs/protocol/native400-review-controller.md)/[报告](docs/reports/2026-11-03-native400-13.md)。


## 400-14 临时交互候选（2026-11-03）

新增私有通道、纯响应校验、共享操作组件与测试/CLI，以及既有service/客户端/宿主代理/构建接线均为本仓库MIT新代码。复用原13 controller/12 selector/reader/journal，未复制上游代码、动画、固件或新依赖；本轮仅原创MIT临时样本。凭据/cookie/私有路径不写证据/Git，临时页面授权不替代真实素材用途或设备批准。见[API](docs/protocol/native400-interactive-host.md)/[报告](docs/reports/2026-11-03-native400-14.md)。


## 400-15 provider评审/浏览器验证（2026-11-03）

新增验证harness/CLI/Node测试由本仓库MIT代码实现，复用既有原创fixture与14链路，不复制DSH安装代码或动画入Git。DSH rc.5源码仅只读核对方法/固定SHA；浏览器显式使用此前本地准备的React18.3.1种子（既有React许可边界保持），只留忽略目录，不把它作为rc.5前端证明。Playwright缓存/可用浏览器工具用于隔离验证，无依赖或浏览器安装。页cookie/路径/端口/运行输入不入公开证据。[报告](docs/reports/2026-11-03-native400-15.md)。

## TCP-01（2026-11-04）

新增JS/C++宿主代码为本仓库原创MIT。合成向量native400-tcp-draft-v0.json原样来自用户指定ai-embedded-studio仓库docs/protocol/vectors/round-pet400-tcp-draft-v0.json，来源SHA见native400-tcp-source-sha.json；适用上游Apache-2.0，完整许可见docs/licenses/round-pet-Apache-2.0.txt（若上游有NOTICE亦保留），不将其重标原创MIT。仅合成fixture，无动画。可选C++对照直接只读include端侧tcp_control_draft.h，由调用方显式传路径；不复制实现，不运行固件脚本，不链接设备应用。其余素材及上游许可不变。


## TCP-02（2026-11-04）

owner、适配回调、测试与监督CLI为本仓库MIT代码，仅复用TCP-01原创模型和既有合成向量；未复制新的上游代码/素材、未读取真实固件/设备或变更上游许可。TCP-01向量Apache-2.0与许可副本继续有效，无依赖安装。[报告](docs/reports/2026-11-04-tcp02.md)。


## TCP-03（2026-11-04）

状态投影、只读renderer与测试/CLI为本仓库MIT新代码；仅复用既有合成identity fixture及v0向量记录。没有复制新的终端源码/素材，端侧文档只读核对；TCP01向量Apache-2.0来源与许可继续有效，无新依赖。[报告](docs/reports/2026-11-04-tcp03.md)。


## TCP-04（2026-11-05）

新增core内部事件审阅器、JS测试/隔离CLI及native C++驱动为本仓库原创MIT；仅复用原合成向量的四资产fixture（TCP01 Apache-2.0及许可副本保持）。端侧control_bridge.h/tcp_control_draft.h/app_main.cpp/control_transport.h仅只读核对，显式C++宿主对照直接include外部Apache-2.0头，不复制实现入Git、不运行固件脚本或ESP构建。JSON行是原创driver对内部Event的宿主展示，不是新网络格式；无动画/真实缓存/配置/凭据导入、无新依赖。[报告](docs/reports/2026-11-05-tcp04.md)。

## TCP-05（2026-11-05）

新runtime绑定、测试/CLI、C++ recipe字节writer与合成向量均本仓库原创MIT，复用本仓库原创400-01/08黑色PET4及私有稀疏fixture；没有复制端侧源码或动画。N_boot与recipe字段是已核协议事实，C++writer不include端侧实现、不独立计算SHA，Node使用内置crypto；固定预期向量由独立Python hashlib/struct生成。外部owner、identity、bridge、app与报告只读核对，未运行固件工具或ESP构建，也未借上游测试自动批准真实用途。TCP01旧向量Apache-2.0与许可副本保持，无新依赖。[报告](docs/reports/2026-11-05-tcp05.md)。


## TCP-06（2026-11-05）

新策略/接线/测试/CLI为本仓库MIT；复用原Apache-2.0合成v0向量及原创PC fixture，既有许可不变。无外部代码/动画复制、固件执行或新依赖。


## TCP-07（2026-11-05）

新增宿主、只读投影、接线/测试/CLI/跨进程fixture均为本仓库MIT。复用原创400 PC源fixture与现有审批/映射模块，不复制端侧代码或动画，不新增依赖。子进程JSON仅自有临时原创输入，非产品配置加载器或真实用途批准，不入Git。固件文档仅只读，既有上游许可不变。[报告](docs/reports/2026-11-05-tcp07.md)。


## TCP-08（2026-11-05）

新LAN profile/owner、门禁接线、测试/CLI均本仓库MIT；合成身份/批准引用原创，不使用真实素材/cache或生成真实许可证决定。复用既有recipe事实和MIT helper，不复制端侧实现。终端接口/报告/C++接点只读，未运行固件脚本/构建或新增依赖，既有许可保持。[报告](docs/reports/2026-11-05-tcp08.md)。


## TCP-09（2026-11-05）

新LAN宿主、core投影、接线、测试/CLI/双进程fixture均为本仓库MIT；只复用原创合成身份/引用和现有MIT模块，不复制固件实现或动画，无新依赖。测试JSON仅临时原创输入，不是真实配置/用途批准或产品导入器，不入Git。固件接口/资料只读，未运行其脚本/构建。[报告](docs/reports/2026-11-05-tcp09.md)。

## TCP-10（2026-11-05）

新私有请求加载、赢家端点门禁、设备JSON适配及测试/验证CLI为本仓库原创MIT代码，复用既有MIT严格JSON/身份校验与Node标准库，零新依赖。终端Apache-2.0代码/接口只读核对字段和行为，未复制其Python/C++实现或运行固件工具。只重读既有compact78 manifest/index元数据，未复制素材/凭据或生成新用途批准；既有角色非商业/署名/SA边界保持。[报告](docs/reports/2026-11-05-tcp10.md)。

## TCP-11（2026-11-05）

新历史来源审计器、原MIT header检查提取、合成专项和验证CLI均为本仓库原创MIT代码，零新依赖。终端预检报告/接口/实现仅只读参考，未复制或执行外部Python/C++。真实compact78元数据与历史备份cache区间仅只读SHA核对，不复制素材/备份/凭据，不产生新用途批准；素材既有非商业/署名/SA证据独立于MIT，未新增许可授予。[报告](docs/reports/2026-11-05-tcp11.md)。

## TCP-12（2026-11-05）

新reviewed request关联校验、审计内部上下文、专项/CLI为本仓库原创MIT代码，零新依赖。仅原创MIT fixture产生测试决定，未生成真实review/窗口批准或复制材料。真实许可材料仅复读已登记副本/元数据，固定上游在线取回失败，不声明新的权利核准；非商业/署名/SA边界及既有来源登记保持。[草案](docs/context/plans/native400-material-purpose-draft.md)/[报告](docs/reports/2026-11-05-tcp12.md)。

## TCP-13（2026-11-05）

新私有配置文件/consumer生命周期、内部handoff guard、专项/CLI为本仓库原创MIT代码，仅Node标准库、零新依赖。配置/凭据均原创合成fixture，临时私有文件实际清理，不是已批准真实配置。终端USB工具/合同只读核对，没有复制/执行其实现，不增加真实素材/许可或操作系统串口库。[报告](docs/reports/2026-11-05-tcp13.md)。

## TCP-14（2026-11-05）

新固定argv子进程consumer、session控制领取/config owner、service退出接线、原创Node子进程fixture/专项/CLI为本仓库MIT代码，零新依赖。只运行本仓库原创fixture，不复制/执行终端Python/固件实现或素材，不读取真实凭据。终端职责合同和真实窗口报告只读引用，历史素材非商业/署名/SA边界保持。[报告](docs/reports/2026-11-05-tcp14.md)。

## TCP-15（2026-11-05）

显式执行清单/私有快照、lease/consumer装配、离线CLI与原创Node依赖fixture由本仓库新写，使用MIT，零新增依赖。合成sample.py只在测试临时目录生成并按字节封存，从未执行；未复制固件USB工具、Python/serial/stdlib或素材。当前hub code-only快照只在临时目录，携带本仓库LICENSE/THIRD_PARTY并在验证后删除；这不改变文件各自原许可，也不授权复制未审阅的上游代码或分发动画。

## TCP-16（2026-11-05）

Node加载审计/bootstrap、真实快照lease借用及原创临时模块测试/CLI由本仓库新写，MIT，零新增依赖。仅参考Node v24.14.1官方module API契约（同步registerHooks为1.2 release candidate），未复制Node实现。当前hub临时副本保留既有LICENSE/THIRD_PARTY后清理；未复制或执行固件USB脚本、Python/serial或动画素材。Node/系统本身许可不因解释器文件SHA而变更，未把其内建源码/动态库分发为MIT。

## TCP-17（2026-11-05）

纯Node控制窗口装配、原创loopback/空PATH进程fixture和专项/CLI为本仓库新代码，MIT，零新增依赖。复用本仓库UDS/TCP实现，不复制固件、serial/Python或素材；没有引入Python运行依赖。既有USB工具适配保留为显式可选开发路径，使用时仍须分别核来源/许可与具体授权；其历史测试不构成正式管理端必须安装该环境的依据。

## TCP-18（2026-11-05）

来源绑定控制通道、纯core请求/view、共享React手动组件、原代理/服务可选接线与原创audit/IPC/HTTP/loopback/hook测试为本仓库新代码，MIT，零新增依赖。仅复用本仓库原创合成400 PET4/稀疏缓存fixture，不复制上游固件/USB/动画，不读取真实素材、凭据或设备库存，不扩大素材用途许可。原HTTP/IPC权限机制和宿主提供React的边界保持。

## TCP-19（2026-11-05）

共享后台状态/页面租约、有界回执、目标身份绑定的剩余TTL恢复、可选shared view/UI与原创loopback专项/测试helper由本仓库新写，MIT，零新依赖。原TCP18原创fixture提取共享，原测试保留回归；未复制/执行上游固件、素材、USB或Python工具。协议字节及素材身份/许可不因共享模式改变，不把模型回执授权为真实素材或设备用途。

## TCP-20（2026-11-05）

Connection精确Fetch候选、闭合client承载策略、原创合同carrier/浏览器harness/宿主测试和CLI均为本仓库新代码，MIT，零新依赖。只读核对已安装DSH/Connection rc.5的公开接口及文件SHA，未复制其认证、cookie secret、上游实现或配置入仓库。独立浏览器复用忽略目录中既有React/ReactDOM18.3.1种子，仍属其原许可，不打包进候选或登记为本仓库MIT；未执行rc.3提取器、联网下载或安装新依赖。所有控制素材/cache为原创fixture，不扩大动画用途批准。

## TCP21（2026-11-06）

pet公开只读reader装配、shared桥接、0.2.2隔离候选构建/入口及宿主测试为本仓库原创MIT，零新增依赖。只读核对安装ASAR及终端交接/报告，不复制上游实现、动画、凭据、profile或真实状态响应；React bundle只登记版本字符串/摘要，未提取或执行其代码。默认旧包许可/peer边界保持。

## TCP22（2026-11-06）

事件/持续状态对照测试与专项CLI为原创MIT；临时DSH shim仅自有隔离目录，不复制上游认证或pet实现。使用已安装宿主执行其公开生命周期，只静态读取pet接口源码及公开HTTP过滤semantic/counter，不复制素材/账号/配置。既有上游许可保持。

## TCP23（2026-11-06）

显式hold-state、HTTP采样收据/有限来源句柄、shared私有limits扩展、只读观察工具和宿主专项均为本仓库原创MIT，零新增依赖。不复制pet/DSH实现、素材或账号凭据；只登记安装代码摘要和过滤状态/必要时序，不把上游许可改为MIT。真实设备/触摸来源未由本切片新增。

## TCP24（2026-11-06）

priority轮询候选payload、连接绑定provider、A/B仲裁/竞态测试和监督CLI为原创MIT，零新增依赖。只读参考终端接口/实现事实，未复制固件实现或修改上游仓库；草案数值待共同冻结，不冒称已部署。原七消息wire/owner及默认event保持。

## TCP25（2026-11-06）

显式endpoint-arbitrated策略、shared取消清理、持续模拟端侧/原创HTTP/真实loopback测试及监督CLI为原创MIT，零新依赖。只读核对端侧Control/Bridge与既有探针结果，未运行固件脚本/构建或复制上游实现；协议事实和摘要独立登记。未读取账号/真实pet响应、复制动画、安装候选或访问ESP；无额外Python/serial运行依赖。

## TCP26（2026-11-06）

新增device/worker纯JS oracle、联合向量回放与loopback验证为本仓库独立编写MIT，未复制C++生产/测试实现，零依赖。`docs/protocol/vectors/native400-preserving-renewal-endpoint-v1.json`逐字节取自只读ai-embedded-studio `docs/protocol/vectors/round-pet400-preserving-renewal-v1.json`（native400-preserving-renewal/1），是上游合成协议测试数据，按该仓库Apache-2.0保留许可，**不适用本仓库MIT重新许可**；许可全文见[上游Apache-2.0](docs/licenses/round-pet-Apache-2.0.txt)。数据来源/字节摘要和读取时的final-manifest摘要纳入TCP26结果；未包含动画、凭据或本机运行配置。新manager-pins为本仓库源码计算的摘要，非上游代码。终端Core/Bridge/合同/报告/独立审查只读核对，不运行其脚本、生成器或构建；未访问设备或真实pet。

## TCP27（2026-11-06）

有限窗口准备CLI、其代码副本/候选import-only正负例及执行方案均为本仓库原创MIT，零依赖；复用现有execution snapshot和Node load audit。只登记既有TCP26源码/候选与终端交接指纹，不复制固件、动画、账号或设备运行配置；未运行终端脚本、Python/serial、真实pet探测或设备操作。候选import不是实际DSH加载或真实设备运行身份。

## TCP28（2026-11-06）

有限A hold运行器、runtime公开导出、原创HTTP/真实UDS/loopback生命周期测试和监督CLI为本仓库独立MIT，零新依赖；复用既有pet只读source/bridge及共享client，不复制上游实现、动画、账号/凭据或本机配置。没有执行终端脚本、Python/serial、真实pet采样或设备操作。合成prepare/display与短墙钟监管不能作为ESP/实际DSH身份或长期资源证明。

## TCP29（2026-11-06）

固定副本实际宿主parent/child、窗口内部brand/本次scoped-client loan、原loader收据校验导出及实际进程/HTTP/UDS/loopback和故障测试为本仓库原创MIT、零依赖。直接复用已有execution snapshot/加载hooks及原授权channel，不复制固件、动画或DSH实现；没有真实pet响应/账号/凭据/运行配置进入Git。只读终端预检与恢复输入摘要，不执行终端脚本或访问ESP/USB。实际Node启动和合成draw对拍不能冒称现有pet加载身份、真实媒体或设备验证。

## 400 TCP 素材维护（2026-11-11）

管理端编解码、发送器、回环适配、PTM1 字节向量和合成测试为本仓库原创 MIT。复用本仓库既有 compact78 元数据解析和原创 PET4 fixture。只读参考固件维护交接、NOR 保存契约与报告，未复制实现或运行固件脚本。测试未读取或复制真实动画，既有素材许可及独立用途审批沿用原范围。[协议](docs/protocol/native400-tcp-media-draft.md) · [报告](docs/reports/2026-11-11-native400-tcp-media.md)

后续宿主 NOR 的 C++ 测试端与 Node 驱动为本仓库原创 MIT。显式指定只读固件目录时，在临时目录直接编译固件 Apache-2.0 头文件、NOR fixture 和其自带 BSD-2-Clause LZ4。外部源码及临时可执行文件均不进入本仓库或候选包。只用原创 MIT 合成 PET4，不读取真实素材或备份。[输入来源和复现](docs/reports/2026-11-11-native400-tcp-media-nor.md)

PMA1 提案、Node 离线模型及合成字节向量为本仓库原创 MIT，使用 Node 内置 SHA-256、HMAC、HKDF 与恒时比较。公开向量只含合成 ID、确定性测试字节和 4 B 正文。无外部实现、真实凭据、素材或运行配置进入交付。[报告](docs/reports/2026-11-11-native400-media-auth.md)

PMA1 正式 sender 装配及回环回归为本仓库原创 MIT，复用 Node 内置密码算法、原 sender、原创合成素材及 PMA1 测试对端。终端实现和报告只读核对，未复制外部实现或导入配对材料。[验证和交接](docs/reports/2026-11-11-native400-media-auth-sender.md)

PBP1 管理端编解码、模拟 USB、RAM 租用及固定向量为本仓库原创 MIT，复用仓库 CRC32 和 Node 内置 HMAC。C++ 结构对拍仅从只读终端仓库 include `media_pairing.h`，生成物位于临时目录，未迁入外部源码、真实 PSK 或配置。[PBP1 报告](docs/reports/2026-11-11-native400-usb-pairing.md)

PBP1 独占串口、人工入口和 PTY 桥为本仓库原创 MIT，使用 POSIX termios 和 Node 内置模块。测试只打开自建 PTY，编译产物留在临时目录。[串口报告](docs/reports/2026-11-12-native400-pbp1-serial.md)

PMA1 单动作 LAN 调用者、type 5 宿主编码及回环测试为本仓库原创 MIT。固件格式和校验只读核对，测试使用合成配对材料及原创 PET4。[联调报告](docs/reports/2026-11-12-native400-pma1-lan.md)
