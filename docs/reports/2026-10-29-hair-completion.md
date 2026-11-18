# 十二层头发补画静态母版首稿

2026-10-29。在[可见面分层](2026-10-29-hair-static-master.md)基础上按[Spec/Diff](../context/plans/hair-static-master-spec.md)继续补齐隐藏区域。本轮交付为静态母版候选，不是动态、设备资源或所有语义边界/支点已确认。

## 当前交付

本地.cache/layered-character/hair-master-v4为当前补画候选；v2保留为零误差可见面基线，v1/v3为中间草稿。

- 12张原位360发束PNG，保留各自原可见RGBA，增加独立补画源填充的隐藏区域；rest.png保留其余原像素，head_underpainting.png仅填前发下面的头部底色，共14个真实图层。
- master.svg与hair-master.ora提供独立图层；composite.png由实际PNG按draw_order作alpha合成，不是再次生成的完整角色。layout.json及manifest.json冻结布局、源/补画SHA、矩阵、绘制顺序及逐层补画像素量。
- index.html有真实逐层开关；browser-check.png为实际浏览器检查。annotation-visible-regions.png/svg沿用v2的可见面像素归属与试标支点，不代表隐藏面边界或运动已验收。
- rear-underpainting-source.png、head-underpainting-source.png为内置imagegen生成的连续后发/遮挡下头部参考；provenance.json保存两条原提示词、来源与限制。可见脸部仍由原像素保留，未用新眼口替换。

只读 source 标准底稿SHA仍为20b98d397a0ee7a52a688c49a2b8808b80e07c119969b08846d39a0d3f64f653，原人物大小/位置、发型和46动作不变。补画场的源边界、目标边界与等比矩阵均记录于manifest，不对角色本身重新fit。

## 检查结果

- v2可见面基线独立PNG重解码与Pillow真实alpha合成均0可见像素差异；不能把该0误差挪用到v4。
- v4实际合成的可见RGB最大差2/255、alpha最大差3/255，预乘RGB最大差约2.953/255；外轮廓非透明覆盖未增加。源底稿内部alpha主要为252–254，隐藏层叠加后部分到255，所以存在微小合成差异。Pillow独立14层alpha合成得到相同RGB最大差2、alpha最大差3。
- 每层原可见像素不变；补画限于原角色alpha>=252的密实覆盖区和对应部件多边形，不扩展外部轮廓。首次错误叠放曾让头部底色遮住原后发，差异守卫拒绝发布；随后限制皮肤补画只在前发/侧发/头顶下方，保持既有后发像素。
- 已目视标准图/实际合成及后发、头顶、侧发独立图。补画使隐藏区更连续，但仍存在需要人工修边的切口/局部孔隙；没有用静态一致掩盖这些问题，不能保证移动后不露缝。
- 浏览器30个图像元素全部加载；“仅看完整头发”显示12层，“全部显示”恢复14层；各层自然尺寸360×360，已截图检查。临时只读白名单loopback已停止，无现有服务变更。
- OpenRaster实际打包14个独立PNG、stack.xml及mergedimage；未实开桌面编辑器验证其兼容性。
- npm run check及npm test含构建164/164通过。本切片共新增4项分层/补画测试，覆盖12层完整性、父级环、唯一归属、颜色/排除区、源可见像素保留、密实区补画与重叠拒绝。

## 下一步与边界

先复核静态首稿边界与补画、修正残留头发/配件分配和试标支点，继续拆分rest中的身体/头/眼眉嘴，随后写P1实施Spec/Diff做完整11处头发动态。大角度根部/末梢运动、正确动态遮挡及安全区仍待验证；本轮未加动态或性能删减。

所有美术只在忽略目录，不进Git/dist；补画素材仍属现有形象的非商业改编，不属代码MIT，来源见THIRD_PARTY。没有改固件、设备、pet/bridge或运行配置，没有安装、提交推送。
