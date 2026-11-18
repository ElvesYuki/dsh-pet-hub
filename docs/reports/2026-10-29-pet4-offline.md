# 真实PET4离线导入/解码/播放验证

2026-10-29。先补[Spec](../context/plans/pet4-offline-spec.md)/[Diff](../context/plans/pet4-offline-diff.md)，实现[严格契约](../protocol/pet4-offline.md)。全程无设备/串口、无固件构建/刷写/写入、无外部Python导入/执行，无pet/桥接/现有DSH配置变更，无子智能体/提交推送。

## 来源与许可

直接取回[固定上游README](https://github.com/PC2005-cloud/dsh-pet/blob/86181ce1660a57ab27336630bab5b344de71b28c/README.md#许可)核对许可段：代码MIT，动画/提示词/源视频禁止商用，公开二创须附原作者地址；形象CC BY-NC-SA 4.0，原型@上善无形、女仆鲸鱼娘设计@ZipZipPipe。web缓存读取失败后，通过HTTPS只读取固定提交原文成功；不执行上游脚本。本次只有本地非商业校验及诊断图，不再分发动画。

独立JS实现只参考PET4布局与[LZ4官方块格式v1.10.0](https://github.com/lz4/lz4/blob/v1.10.0/doc/lz4_Block_format.md)，未复制Apache/BSD源码、无新依赖。来源登记THIRD_PARTY.md；只读文件/规范摘要见忽略目录.cache/pet4-audit/sources.json。

## 验证结果

npm run check、npm test含候选构建：93/93通过，新增5项覆盖CRC已知向量、LZ4重叠及坏输入、240/360不同长度全帧/随机关键帧跳转、头/offset/tag/tile/CRC负例、有效SHA但无效格式、PET4导入/设备独立帧时钟/循环及首帧失败不覆盖actual。

真实库由原创JS逐帧审计，没有调用外部解码器：

| 只读素材库 | 动作/帧数 | 压缩总字节 | 校核 |
| --- | --- | --- | --- |
| round-pet/assets-lossless（240） | 46 / 11086 | 106592468 | 全文件SHA/长度、头/帧CRC、重建index_sha256均与源manifest一致 |
| native360-production/assets（360） | 46 / 11086 | 225509627 | 同上，全部通过 |

源manifest SHA256分别为eb52861be5b4c1fc16bda76c8f69b5bf883ff4143a009dd6560c8be539341472与a6a2ddae50a8fe4ddf15ff07a3a228dccf865bb91a037693ce0a72232204c39e。报告明细.cache/pet4-audit/real240.json、real360.json只含摘要与解析结果，不进Git。索引摘要匹配是与既有转换结果的独立交叉检查，不声称与原始视频像素无损。

真实IPC集成：只将两段待机240/360复制到本仓库忽略目录（共7733795B，不进Git），建立受index摘要约束的目录，临时服务测试profile required_actions=[0]，不冒充完整8动作角色装配。A选360、B选240，各自verified→首个真实RGB解码帧→虚拟推进100ms到frame2，尺寸与decoder独立通过；证据integration.json。服务已关闭，临时runtime已删除，保留忽略目录供复核。未测试该profile其它动作。

本地将两段待机首帧从解码RGB565生成诊断PNG，目视角色/颜色/尺寸合理：左240、右360，文件.cache/pet4-audit/decoded-idle.png。它不表示浏览器动画播放器已实现，也不作为可再分发MIT素材。

## 限制与下一入口

真实360完整8语义动作35701591B超过32MiB快照预算，本轮没有绕过限制；完整46动作逐文件审计通过不等于全库导入/同时常驻通过。真实首帧仍为宿主模拟提交，无显示硬件、无线协议、Flash、认证/蓝牙/真机FPS或稳定性验收。未覆盖随机fuzz、大库后台调度及UI动画渲染。

下一阶段先补流式内容仓库/worker与全角色语义包契约Spec/Diff，避免同步校验阻塞服务；再接浏览器帧预览和Flash激活/掉电模型、v5迁移及认证负例。真实接入仍需单独具体方案与恢复步骤。
