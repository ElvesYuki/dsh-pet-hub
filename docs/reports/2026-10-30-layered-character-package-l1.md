# 分层角色包 L1：字段与严格校验

2026-10-30。用户授权按[Spec](../context/plans/layered-character-package-spec.md)/[Diff](../context/plans/layered-character-package-diff.md)先实施L1。**已完成完整字段合同、固定参数基线、原创合成包和只读校验；未实施L2真实候选导出/加载或L3像素等效与恢复。**

## 已实现

- [完整数据契约](../protocol/layered-character-package.md)与[全部固定参数JSON](../protocol/layered-character-profiles-v1.json)：独立dsh-layered-character/1，21主层/11动态发束、脸槽、挥手替换顺序、静态命中、8种profile和全部字段/取值；首版仅允许当前固定基线，不接受包内脚本或未经验证参数。
- core的layered-character-json/package/profiles模块：fatal UTF-8/重复键/嵌套/节点数检查、封闭schema、完整引用、当前骨架/支点/绘制顺序、能力与许可allowlist、字节/逻辑RGBA配额。无DOM/DSH/磁盘读取或引擎执行。
- runtime的layered-character-validator/png模块：显式期望摘要、所有文件长度/SHA/集合复核、PNG CRC/尺寸/格式/压缩长度/全部0–4滤波还原；只读目录审计拒绝符号链接/未声明文件，读取前核对大小、open/fstat身份，读后复核时间与SHA。JSON/rig先验证，后逐图解码丢弃，不保留整库RGBA。
- scripts/validate-layered-character-package.mjs：显式目录、摘要、许可ref参数；成功只返回validated_data_only_not_loaded统计，失败输出稳定code及可选逻辑资源ID，无启动/激活/修复/写配置操作。
- simulator/layered-character-fixture.mjs：全原创几何矩形、一个PNG被21层与所有表情/姿态槽共享，测试去重和引用；合成外观不代表真实角色。没有生成新图或导出原角色PNG。

L1的profile注册是数据合同，不是可调用播放器。L2仍须把现有制作引擎常量接到共同参数入口并做等效验证，本轮没有搬移/改写既有自然动作、表情、说话、挥手/轮廓渲染代码。

## 验证结果

`npm run check`通过；`npm test`全套241/241通过，包含新增24项L1测试。主要证据：

| 范围 | 已验证 |
| --- | --- |
| 正例/可重复性 | 合成包完整通过，两次构造manifest摘要相同，全部脸/姿态/主层引用共享一个PNG而只计一次RGBA；校验不修改输入文档 |
| JSON/版本/参数 | 非UTF-8、重复转义键、非有限数、尾随垃圾、深度/长度、旧PET4标识、未知字段/能力、删改行为参数均拒绝 |
| 引用/骨架/许可 | 路径逃逸/编码/盘符/URL、重复id/path、无引用贴图、缺图/脸槽、循环/缺发束/错支点/重复顺序/移动根、许可allowlist空或来源不匹配均拒绝 |
| PNG/资源 | 五种滤波精确还原原RGBA；坏CRC、截断/尾部、APNG、错误尺寸/位深/色型/交错、非法滤波、解压超限/多余压缩数据拒绝；即使重新计算外层SHA也不能绕过PNG检查 |
| 目录/命令 | 正例先通过，再分别破坏为缺文件、多文件、长度不符、文件/子目录/root/祖先链接；CLI只读，失败与空参数无本机路径/堆栈泄露 |
| 基线审查 | 文档参数JSON与核心基线逐字段一致；16个自然通道身份/limit/speed与既有状态模式求值器相符，defaults副本修改不污染固定基线 |

“参数审查”不等于完整动作/浏览器像素等效；本轮没有重新进行4046帧角色扫描，也不把上一阶段结果作为分层包验收。

## 本地证据与使用

`.cache/layered-character/layered-package-l1/synthetic-package/`保存完整合成目录（manifest、rig、behavior、provenance、一个PNG）。外侧verification.json为实际审计结果，tests.log为全套测试输出，profile-source-audit.json记录制作代码摘要与参数文档一致性检查，均为本地证据，不在包内夹带脚本/绝对路径。

该fixture实测：21层、8种profile、1张不同PNG，逻辑解码RGBA为518400B，文件总计116996B（含manifest）；manifest SHA为`3a688474403f9b3d22dba09a68494932c807a09ddc77501477b523ea2b704406`。这不是实际角色容量或运行RAM测量。

只读复验命令：

```sh
node scripts/validate-layered-character-package.mjs \
  --directory .cache/layered-character/layered-package-l1/synthetic-package \
  --manifest-sha256 3a688474403f9b3d22dba09a68494932c807a09ddc77501477b523ea2b704406 \
  --artwork-license-ref synthetic-mit
```

新增代码与合成几何图MIT，真实素材/署名边界不变，见[来源许可](../../THIRD_PARTY.md)。测试未访问设备/固件或现有pet写接口；无安装/服务调整/提交推送。只构建dist候选，未安装启用；fixture仍被排除。

## 限制及下一项

- 目录审计针对调用方拥有的稳定目录，使用无链接规范路径；不是针对敌对并发改名进程的OS沙箱。不支持ZIP、URL、其他骨架/profile或其他PNG色型。
- 32MiB为逻辑RGBA准入上限；读取快照、PNG临时解压、Canvas/距离场和进程RSS另计。未测设备资源或帧率，未改变认证门槛。
- 尚无真实包导出、独立角色加载/解码取消/首帧交换、生产仓库/IPC、重开恢复、PET4协调、设备或音频。

下一项为L2：读取已确认制作候选、导出纯数据包；独立加载只读该包，候选失败/取消保留旧角色，并防止旧异步解码覆盖最新选择。之后L3再验证完整场景等效和移走原目录后的恢复。
