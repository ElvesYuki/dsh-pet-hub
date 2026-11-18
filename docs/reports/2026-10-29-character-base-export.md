# 第一版源稿固定与360标准底稿导出

2026-10-29。[Spec/Diff](../context/plans/character-base-export-spec.md)。用户确认按“第一版＋固定注册→标准360 PNG→检查→拆层”实施，本轮完成源选定、固定注册栅格化与导出检查；独立拆层/内部细节/设备播放尚未验收。

## 固定文件与工具

- 源稿：.cache/layered-character/neutral-review-v1/neutral-v1.png，1254×1254，第二版仅备份。
- 注册：.cache/layered-character/registration-v1/registration.json及registered.svg；不自动裁边、fit、居中或拉伸。
- **标准底稿：.cache/layered-character/authoring-base-v1/neutral-360.png**。同目录manifest.json保存源/SVG/输出SHA、矩阵和工具版本，index.html提供原参考、标准稿黑底/浅底对照。[指南](../art/character-production-guide.md)记录路径和复现命令。
- 源SHA256：89941940b5b6f1a731c148006dc941ffe8eb7cf0f5aa4e16049c6254be6f3c47；标准PNG SHA256：20b98d397a0ee7a52a688c49a2b8808b80e07c119969b08846d39a0d3f64f653。

原创scripts/export-character-base.mjs验证冻结源、矩阵、SVG内嵌图完全一致后，显式调用预装工具Sharp 0.35.5/librsvg 2.63.2栅格化，校验PNG后创建新目录。项目package.json零依赖保持，工具依赖不进dist；无安装或imagegen重绘。

## 验证

实际PNG为360×360 RGBA8，CRC/行过滤校验通过；alpha范围0–254，alpha>=16的边界[70,50,281,315]，目标像素边界误差0。Pillow独立只读复核获得相同尺寸/透明度/边界；图像已目视核对。本轮不启动服务或重复浏览器截图，对照HTML仅结构检查。

首次验证要求alpha最大值255，SVG连续采样实际为254，因此拒绝发布；复核Sharp统计后改为透明背景且主体alpha>=250，并增加254回归。不修改源/输出alpha或放松边界要求；失败时未创建输出目录。

npm run check及npm test含构建160/160通过，新增4项覆盖PNG过滤0–4、CRC/尺寸/透明度/边界；冻结源/SVG/矩阵改变拒绝；渲染失败不发布；输出防覆盖和路径/符号链接隔离。

## 后续与边界

标准PNG是完整合成底稿，不是分层工程、PET4或安装包。外框不能证明眼口/纹样内部像素一致。现有九部件图集仍为待验首稿；下一步按本底稿标定部件位置、补画遮挡，做静态合成及眼眉嘴插槽，再进最小动画；按需补多视图。

现有360/46动作、固件、设备、pet/bridge与运行配置未改。美术仅本地忽略目录，不进入Git；无提交推送。
