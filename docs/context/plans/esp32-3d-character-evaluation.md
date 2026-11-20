# ESP32 实时 3D 路线首轮素材评估

2026-11-19。评估木子恶魔的《蓝色小肥鱼 Deepseek 鲸鱼娘》，以现有插件动作 0 待机帧为外观基线。此轮交付为本机离线对照与模型资源盘点。

- 来源固定为 [VRM Pet 3D 模型说明](https://github.com/drliuhuan/dsh-plugin-vrmpet3d/blob/462bda9bcdcd4d0d14a4c33ab675bffbfadbcffc/assets/models/README.md) 所列 `BlueFatFish.vrm.br`，原始配布为[木子恶魔的模之屋页面](https://www.aplaybox.com/details/model/ayXkRzVflmnd)。原配布页列出允许修改、允许视频之外的用途、完整署名、禁止商用和二次配布。插件说明另列该插件自身的随包分发许可。本轮仅在私有 `.cache` 读取公开快照与制作本机预览，不随项目打包或再分发。模型作者为木子恶魔，形象对照保留上善无形、ZipZipPipe 与 PC2005-cloud/dsh-pet 的来源署名。
- 核对实际 VRM 容器、三角面、蒙皮、表情、材质与贴图规格。使用本机已有 Blender 读入网格，制作同屏居中的正面及多角度静态对照，说明展示材质与原渲染差异。
- 与现有 466 圆屏的待机构图比较身份特征及侧面轮廓，基于同板软件渲染基准给出减面、贴图和骨骼取舍。ESP32 性能留待独立真机原型验证。现有插件、固件和运行服务保持原状。

实际 VRM 文件内的许可元数据与模之屋网页条款有差异，本轮仅做原文件读取和静态渲染。若 Blender 的本机图形后端不可用，则用 Three.js `0.180.0` 与 `@pixiv/three-vrm` `3.4.4`（[Three.js MIT](https://github.com/mrdoob/three.js/blob/r180/LICENSE) · [three-vrm MIT](https://github.com/pixiv/three-vrm/blob/v3.4.4/LICENSE)）在私有 `.cache` 做临时 WebGL 预览。两库仅供本地评估，不进项目依赖或交付包。
