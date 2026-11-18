# 400原像素 M0 Diff

2026-10-30，实施前，配套[M0 Spec](native400-m0-spec.md)。

- 新增scripts/prepare-native400-review.mjs与页面模板：原创Node离线工具，显式读取已审核catalog与源目录，校验后复制78媒体、提取元数据／原像素缩略图，输出新.cache目录。
- 新增tests/native400-review.test.mjs：合成几何／来源／路径／HTML边界，不加载真实pet或素材。
- 新增报告，同步第三方登记、上下文索引／当前事实／待办；候选数据及视频仅存忽略目录。
- 不修改core/runtime/UI协议、设备能力、正式素材、外部仓库或运行服务；不安装依赖或提交推送。
- 现阶段人工审核尚待用户进行，自动全帧alpha裁切审计另做后续切片。
