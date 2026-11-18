# L2 真实分层角色包导出

2026-10-30。用户授权实施导出；按[切片Spec/Diff](../context/plans/layered-character-export-spec.md)、[使用合同](../protocol/layered-character-export.md)执行。**真实纯数据包已导出/完整复验；独立加载与L3恢复仍未实现。**

## 实现与验证

新增runtime/layered-character-export.mjs和显式CLI scripts/prepare-layered-character-package.mjs；复用L1严格JSON/PNG/目录审计以及固定参数基线，低层安全读取复用到validator的layeredDirectoryRoot/readLayeredFile。没有项目依赖、图像转码、新美术或源目录脚本执行。

输入为当前character-master-v5、character-speech-assets-v1与character-raised-arm-v1/final，三个manifest/独立抬手PNG期望SHA在命令中明确固定。核对四个JSON及42个PNG共46份输入、母版/表情/抬手相互引用和许可署名；全部源PNG符合L1，直接保留原字节。主层选清洁覆盖，含open_edge与全部五嘴型；纹理按字节SHA去重，不减少21层/11处发束或改变360人物大小/原点。

在同级私有stage内组装、完整复验并重查输入后，以新output壳独占发布：先外部回执、后最终package rename。已有/晚到输出不覆盖；写盘/回执/rename失败和输入变化只回收本次未发布输出，不动旧目录。

## 真实产物

当前入口：`.cache/layered-character/character-package-export-v1/package/`；同级receipt.json为包外回执，binding-verification.json为对照证据。重复导出到character-package-export-v1-repeat，未覆盖原目录。

| 指标 | 实测 |
| --- | --- |
| 身份 | character_id=mingyue-maid-layered，variant_id=native360，version=v1 |
| 主层 / profile | 21 / 8 |
| 去重PNG / 包文件总数 | 33 / 37（4份JSON＋33 PNG） |
| 包实际字节 | 390634B，约381.48KiB，不含回执/诊断文件 |
| 逻辑解码RGBA | 17107200B，约16.31MiB；不是运行RAM或设备峰值 |
| manifest SHA | 7b872e12706ad7eff261e7bde6c0f878eec9ee0172a7c2ce05b33f4a8415e0f8 |
| 校验状态 | validated_data_only_not_loaded |

两次导出的manifest与回执字节一致；对照v4的21个有效主层SHA、全部脸槽/嘴型、抬手、参考图、父子/支点、绘制顺序和behavior均一致，原PNG未改字节。原46个PET4动作仍独立保留，本包仅包含当前分层候选。

独立运行L1命令重新通过：

```sh
node scripts/validate-layered-character-package.mjs \
  --directory .cache/layered-character/character-package-export-v1/package \
  --manifest-sha256 7b872e12706ad7eff261e7bde6c0f878eec9ee0172a7c2ce05b33f4a8415e0f8 \
  --artwork-license-ref dsh-pet-nc-86181ce
```

## 测试证据与范围

npm run check通过；最终npm test全套286/286通过，本轮新增16项导出测试。工作区其他切片也在该全套中，本轮未修改认证/租约/固件代码。

- 原创authoring fixture验证清洁覆盖/原眼睛/所有槽绑定、原PNG字节、去重、源只读、两次manifest/回执稳定；删除全部合成制作源后，产物仍能通过独立L1审计。
- 错manifest/抬手SHA、关联/眼睛证明/许可署名不一致、缺表情、路径/符号链接、重算SHA后的坏PNG、畸形源JSON及未知method均拒绝。
- 原文件/空目录/已发布包/链接输出、越出.cache、输入树内输出（包括..candidate这种普通点前缀名字）均拒绝，不写输入树。
- 注入stage写失败、回执失败、最终rename失败、输入在staging中变化和晚到的其他输出创建，验证无半成品package、私有stage清理、现有输出及其他创建者sentinel保留。
- 包/回执不包含源提示词、绝对路径、data URI或脚本，CLI空参数/未知参数返回稳定错误。fixture只有原创几何图，不含真实角色素材，且不进入dist。

本轮不改渲染代码，未重新进行全套浏览器像素/4046场景扫描。有效PNG字节/绑定保持是本次证据，不能替代后续独立加载、完整像素等效或真机验收。合成源删除测试只证明包独立校验，不声称真实角色播放恢复已实现。

本地tests.log保存最终全套输出。真实图包/重复包/回执均在忽略目录，不进入Git或dist；代码MIT，素材许可/署名沿用原已登记本地非商业改编范围，见[THIRD_PARTY](../../THIRD_PARTY.md)。没有发布、安装插件、服务调整或设备/固件操作。

## 复现导出

下例选新的v2目录以避免覆盖v1（这只是新输出目录名，包version仍为v1）：

```sh
node scripts/prepare-layered-character-package.mjs \
  --master .cache/layered-character/character-master-v5 \
  --master-sha256 efa75f80229eb9bf0fcd06f1ad9c3d6901d2e9f0993435206dbde07070d87fe1 \
  --expressions .cache/layered-character/character-speech-assets-v1 \
  --expressions-sha256 a50f182a44f02195390d1a69ee2f99d84ac929ddb032fb00b8d07063a24561fc \
  --raised-arm .cache/layered-character/character-raised-arm-v1/final \
  --raised-arm-manifest-sha256 618d2826b15790bb103bb97fad5c85202634aca526e5a022892cd2f155e23d14 \
  --raised-arm-sha256 9184dae424397a6400be30b5022a6cd4cc99632f638424e1a87e54cea31b4b93 \
  --character-id mingyue-maid-layered --variant-id native360 --version v1 \
  --license-ref dsh-pet-nc-86181ce --method ai_assisted \
  --output .cache/layered-character/character-package-export-v2
```

下一项为独立加载：只读取package和受信任core引擎，候选完整解码/首帧准备后再替换，失败/取消保留当前角色，旧异步结果不能覆盖最新选择。生产仓库/IPC、PET4切换、设备、音频和性能优化仍按原顺序后置。
