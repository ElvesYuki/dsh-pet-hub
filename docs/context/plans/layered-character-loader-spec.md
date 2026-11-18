# L2 独立加载 Spec/Diff

2026-10-30。状态：已实现，见[报告](../../reports/2026-10-30-layered-character-loader.md)与[API](../../protocol/layered-character-loader.md)。用户授权继续独立加载；只使用导出package与本仓库可信播放器，不访问制作目录、设备/固件/pet或既有服务。

## 交付与结构

- 生成不含角色PNG/包数据的独立HTML，提供文件夹选择、期望manifest SHA和许可ref（制作CLI可显式预填后两项）。只读取用户所选package文件夹，拒绝选择包含receipt的外壳目录。校验/候选准备期间当前角色仍运行。
- 浏览器适配使用File.arrayBuffer/WebCrypto/DecompressionStream及ImageBitmap；JSON/字段/rig/profile/资源约束复用L1。PNG分块/CRC/行滤波抽为core纯逻辑，Node inflate与浏览器解压适配共用；不依靠原生图片显示绕过完整检查。无远程依赖或包内代码，缺必要平台能力明确拒绝。
- 独立准备器从通过验证的私有快照映射rig/表情/臂图到现有自然预览，共享唯一渲染实现。每个不同PNG只创建一个Bitmap，多槽复用；离屏root完成首帧才提交。自然预览增加root/lifecycle/预载图片与返回API，旧用法保持。
- 通用候选控制器不依赖DOM/DSH；generation在选择时递增，最多一个正在准备的候选＋一个最新待选意图（后者不分配图片）。新选择取消当前候选并等待清理，合并中间待选；旧结果复核代数后只能释放，不得提交。旧角色到候选提交成功才释放。
- read/prepare/commit失败保留旧角色；commit为可信同步适配，候选已准备，不能边清空旧画面边等待。abort后读/解码可能仍需短暂结算，cancel等待资源回收，不谎称平台I/O可硬中断。close幂等，停止RAF/监听/候选并关闭所有Bitmap。

## 验证与范围

合成fixture/异步门闩测试完整浏览器文件快照校验、坏摘要/文件/PNG/配额、慢A→新B、取消、合并C、首帧失败/提交失败、close与迟到结果释放。真实导出包文件夹实际浏览器选择并跑四态/触摸/挥手/无音频嘴型；与原扫描比较，保存截图/记录，确认HTML不内嵌图像且不回读母版路径。命令只生成新.cache工具页，不启动现有服务。

PNG共用拆分保持Node L1/导出行为；运行npm run check/npm test。真实包及360大小/原点/11发束/46动作不改，新代码MIT、素材许可不变。完整L3跨环境像素等效、墙钟资源、设备分层/音频/生产仓库仍后续。
