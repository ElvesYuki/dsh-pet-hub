# 分层角色P0预期 Diff

实施结果见[P0参考准备报告](../../reports/2026-10-29-layered-character-p0.md)，以下保留原预期范围；静态分层成品、播放器和真机验收仍未实现。

2026-10-29，实施前范围。

- 新增scripts/prepare-character-reference.mjs：使用本仓库PET4解码器及Node内置压缩生成原尺寸参考PNG、HTML与摘要，不引入依赖。
- 新增docs/art/character-production-guide.md、character-authoring-template.json：制作规范与待填清单，不是已支持的运行包格式。
- 新增tests/character-reference.test.mjs：仅原创合成PET4和临时目录验证，不依赖外部素材。
- 更新THIRD_PARTY及上下文索引/事实/待办/报告，真实角色图仅存在.cache，不进入dist。
- 不改现有360/46动作、runtime/UI/固件、配置、服务或插件，不生成分层角色成品。后续P1待独立Spec/Diff与美术样本确认。
