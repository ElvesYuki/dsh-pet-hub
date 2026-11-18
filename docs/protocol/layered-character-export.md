# 分层角色包：当前制作候选导出

2026-10-30。L2导出子切片已实现；仅写纯数据包，不实现独立加载/首帧交换。[Spec/Diff](../context/plans/layered-character-export-spec.md)、[实际报告](../reports/2026-10-30-layered-character-export.md)、[L1包合同](layered-character-package.md)。

## API与输入

`packages/runtime/layered-character-export.mjs`导出同步函数`exportLayeredCharacterPackage(options)`。必需字段如下，缺少/不匹配即拒绝，不从本机配置发现路径。

| options字段 | 内容 |
| --- | --- |
| repoRoot | 当前仓库规范目录；写入只允许其.cache子树 |
| masterDirectory / masterManifestSha256 | 已审21层母版目录/manifest原字节期望摘要 |
| expressionDirectory / expressionManifestSha256 | 已审19张表情/修补/嘴型目录/manifest期望摘要 |
| raisedArmDirectory / raisedArmManifestSha256 | 已审抬手静态候选目录/manifest期望摘要 |
| raisedArmSha256 | 已确认的arm-raised.png独立摘要；源抬手manifest本身没有该输出PNG摘要，不能只靠manifest绑定 |
| characterId / variantId / version | 1–64字符ASCII标识，对应包身份字段 |
| licenseRef / method | 已复核素材许可ref；synthetic/manual/ai_assisted之一。必须与三份源manifest的许可/署名一致，不扩展原许可 |
| output | 仓库.cache下尚不存在的新导出目录；父目录须已存在、规范无链接，输出不能与输入树重叠 |

可选io为**显式可信主机**writeFileSync/renameSync适配器，用于同步I/O故障测试，语义与Node原语相同；CLI不接受它，包/源数据不能提供回调。不执行输入目录任何JS/Python/HTML或导入脚本。

## 来源与有效绑定

读取四个JSON（master manifest/layout、expression manifest、raised-arm manifest）和42个源PNG；每份JSON≤256KiB、每PNG≤4MiB、所有输入合计≤64MiB，读取前限制长度，再核对原始SHA/PNG数据。源目录自身及祖先/文件禁止符号链接；调用方应提供稳定规范路径。

母版layout必须匹配已确认摘要、360画布、21部件父子/支点和绘制顺序。表情manifest必须绑定同一母版和标准PNG，原眼睛保持证明为true，eyes_open字节SHA与母版eyes相同；抬手必须绑定同一母版、arm_right、恒等根和肩点(195,216)。

主层应用当前固定9项覆盖：head→head_clean、eyes→eyes_open、brows→brows_neutral、mouth→mouth_closed及fringe_left/right、side_left/right、hair_cap同名修补图。19张表情资源的ID/文件名/360尺寸与零偏移完整检查。所有眼眉嘴槽（含open_edge、五嘴型）、抬手/原臂及reference PNG明确引用。

当前全部PNG符合L1子集，因此**原字节复制**，不裁切、缩放、重画、转码或丢弃透明画布。每个不同SHA是一个64字符资源ID，路径textures/<sha>.png；相同字节由不同逻辑槽共享，部件/动态数量不合并。格式不支持的PNG明确失败，本版本无自动规范化分支。

只带入有效主层、表情/嘴型、抬手和命中参考图；不带未使用原层、高清源稿、atlas、提示词、HTML/JS或本机路径。behavior使用L1固定基线。provenance仅保留六项来源摘要、署名/许可/修改说明，生成方式由调用方明确声明。

## 输出、确定性与发布

```text
<output>/
  package/                   # 交给L1校验/独立加载器的纯数据目录
    manifest.json
    rig.json
    behavior.json
    provenance.json
    textures/<sha>.png
  receipt.json               # 包外回执，不能放入package
```

回执含status=exported_validated_not_loaded、manifest_sha256、L1验证统计、46个输入逻辑ID/摘要、去重贴图原字节保持信息及有效绑定。它不包含绝对路径、源提示词或原始生成大图。包摘要仍为原始manifest SHA，校验时由调用方明确传入；数据JSON固定字段顺序/末尾LF，files按ID字符序排序，无时间戳或随机名进入内容。

1. 输入/绑定/PNG全部通过，在内存组装并做L1字节校验。
2. 在输出父目录内创建私有临时包，写入JSON/PNG并执行L1完整目录审计；再重读46个输入，拒绝中途变化。
3. mkdir独占认领新output目录；先写包外receipt.json，再将已验证临时包rename到output/package。该rename是最后可失败I/O，没有rename后还写文件导致提交结果不明的步骤。
4. 发布前失败只清理本次stage与自己认领的空壳/回执；已有目录、文件、链接和晚到的其他创建者不删除、不覆盖。输出壳可能短暂可见，只有package与匹配receipt同时存在才视为完成。

这是稳定本地目录内的导出，不是敌对并发替换目录的OS沙箱；不承诺目录fsync、断电事务、设备安装或原子激活。调用成功返回相对output/package目录、manifest SHA与验证统计，无播放状态。

## 命令

从仓库根目录运行；`--output`每次选新目录，父目录需存在。当前真实候选来源与完整复现命令见[报告](../reports/2026-10-30-layered-character-export.md)。

```sh
node scripts/prepare-layered-character-package.mjs \
  --master '<已审母版目录>' --master-sha256 '<期望manifest SHA>' \
  --expressions '<已审表情目录>' --expressions-sha256 '<期望manifest SHA>' \
  --raised-arm '<已审抬手目录>' --raised-arm-manifest-sha256 '<期望manifest SHA>' \
  --raised-arm-sha256 '<已审抬手PNG SHA>' \
  --character-id '<角色ID>' --variant-id native360 --version v1 \
  --license-ref '<已复核许可ref>' --method ai_assisted \
  --output .cache/layered-character/my-new-export
```

CLI成功退出0并输出目录/摘要/验证统计；失败退出1，输出稳定错误code/可选逻辑资源ID，不暴露本机路径/源提示词。错误包括L1类别及output_exists、export_io_failed、export_cleanup_failed。原始主机I/O异常供库调用方内部诊断，CLI不序列化cause。

新代码MIT；真实素材沿用原非商业改编及上善无形、ZipZipPipe、PC2005-cloud/dsh-pet署名，只在.cache本地验证，未发布/安装。后续已完成[独立加载、取消/旧结果保护与首帧切换](layered-character-loader.md)。导出命令仍只审计/发布纯数据，不自动播放或激活；播放需另行显式选择包。
