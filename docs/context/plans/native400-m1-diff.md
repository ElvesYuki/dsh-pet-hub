# M1预期 Diff

配套[native400-m1-spec.md](native400-m1-spec.md)，2026-10-30实施前。

- packages/core/pet4.mjs：新增显式native400-candidate-v1参数；独立受限8000B内部LZ4路径，默认240/360行为保持。
- 新增packages/core/pet4-encode.mjs：原创受限LZ4和PET4装配、调色板工具，不复制上游／固件实现。
- 新增scripts/prepare-native400-samples.mjs及必要辅助工具：显式源／许可输入，单动作逐帧处理，完整验证6小样，生成独立manifest、像素／编码前后对照及设备侧交接文档。
- 新增scripts/repack-native400-lz4.py（仅显式调用已安装liblz4，不附带库代码）、verify-native400-samples.mjs（最终包全帧／摘要／seek复验）。
- 新增合成测试；更新THIRD_PARTY和上下文／报告。真实PET4、图片和动画仅存.cache，不入dist/Git。
- 不改M2正式导入、IPC、响应预算、worker装配或固件；不自动安装／启动／烧录／提交推送。
