# 分层角色P0：参考与制作规范准备

2026-10-29。[实施Spec](../context/plans/layered-character-p0-spec.md)、[Diff](../context/plans/layered-character-p0-diff.md)。完成P0参考与规范准备；静态分层图尚未制作/确认，P1播放器、音频口型及设备性能未实现。本报告不称整个P0形象验收通过。

## 交付与来源

- [制作指南](../art/character-production-guide.md)：视觉基准、360/466坐标、拆层补画、支点/偏移、眼眉嘴插槽、组合规则和验收表。
- [空白清单](../art/character-authoring-template.json)：十类部件、眼眉嘴变体；实际尺寸/支点/绘制顺序/触摸区域留null，不是运行包格式。
- scripts/prepare-character-reference.mjs：原创MIT离线工具，显式许可与输入摘要校验，本仓库PET4采样解码和原尺寸PNG导出。无新依赖、外部代码执行、网络或设备访问。仅写本仓库.cache下新目录，拒绝覆盖和输出祖先符号链接；输入验证/编码完成后才写输出，写入I/O失败会报错，不宣称多文件事务。
- 既有原生360输入：固定上游86181ce1660a57ab27336630bab5b344de71b28c，manifest SHA256 a6a2ddae50a8fe4ddf15ff07a3a228dccf865bb91a037693ce0a72232204c39e。只读源素材，不运行固件导入脚本。

本地.cache/layered-character/p0-reference含index.html、reference.json和25张PNG，合计约1.2MiB，不进入Git或dist。动作0/1/4/55/58各取frame0/60/120/180/240，帧号0起、24fps。每段先核对长度/SHA，采样解码核对CRC，manifest结束复核。采样不是新增全帧或边界审计。

## 验证与限制

- npm run check通过；npm test含构建153/153通过，新增4项参考工具测试。
- PNG独立解压核对尺寸、行过滤、chunk CRC、RGB565红绿蓝和黑色不透明；颜色转换复用共享预览规则。
- 合成输入验证摘要/许可/尺寸/CRC/源符号链接拒绝，输出隔离、防覆盖、HTML转义和无源绝对路径泄露。
- 实际待机frame0、挥手/生气/开心frame120已目视核对，原尺寸形象合理。生气样本包含侧身，挥手包含双臂抬起，指南已注明补姿态要求；不自动去背景、拆图或猜测五官支点。
- HTML尺寸/定位/转义做结构检查。自动浏览器file协议访问被工具限制，未完成浏览器截图或辅助线交互验收，也未启动HTTP服务。

参考是已有RGB565量化画面，不是原始色稿、alpha遮罩、可编辑骨骼或已确认新美术；没有新角色图、动作成品或语音。24FPS/触摸<100ms仍是实验目标，不是测量结果。

下一步按指南制作同大小/同位置的中性分层静态样本，标定清单并由用户确认，再另写P1实施Spec/Diff。现有360/46动作、pet/bridge、配置、固件及设备未改，无服务启动、插件安装、Git提交/推送。原始素材、参考像素及本机源路径不进入版本化文档或候选。
