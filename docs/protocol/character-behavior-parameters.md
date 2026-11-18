# 分层角色行为参数接入

2026-10-30。L2的参数接入子切片已实现；不代表真实角色包导出/独立加载完成。[实施Spec/Diff](../context/plans/layered-character-behavior-parameters-spec.md)、[报告](../reports/2026-10-30-character-behavior-parameters.md)。[L1固定参数JSON](layered-character-profiles-v1.json)和允许值未改变。

## 参数入口与所有权

`packages/core/layered-character-profiles.mjs`新增`resolveCharacterBehavior(value?)`。省略/undefined返回原冻结基线；显式输入须与完整L1合同逐字段相同，不合格抛code=unsupported_profile。合法外部输入先structuredClone再递归冻结，后续修改原对象不影响运行实例；修改过的原对象再次传入会重新校验并拒绝。

已经由此入口产生的冻结快照可重复传入。内部WeakSet仅识别受信任快照，不缓存可变调用方对象，避免“校验后改值”绕过；不从包import/eval任何代码。工厂创建时解析一次，内部子通道/预览共用同一快照，热循环不重复解析JSON。

v1仅允许当前固定参数，不支持任意调参、新profile或混用缺省局部片段。策略/坐标/能力等描述性字段由固定版本算法及rig合同解释，不以字符串选择任意函数。完整JSON与L1摘要仍兼容；本轮不迁移格式版本。

## 纯逻辑API

以下实现在`packages/core/character-*.mjs`，不依赖DOM、Node文件读取、DSH或设备；`scripts/character-*.mjs`保留同名导出的兼容入口，只转导，不复制第二份实现。

| API | 新增可选参数 |
| --- | --- |
| createNaturalMotion(parts, options?) | options.behavior；原options.states仍保留 |
| replayNaturalMotion(parts, time, events?, options?) / sampleNaturalMotion | 同上 |
| createCharacterStates(behavior?) | 完整行为快照 |
| composeCharacterStateFace(face, state, behavior?) | 第三个参数 |
| blinkStarts(until, behavior?) | 第二个参数 |
| sampleExpression(time, headTouch?, behavior?) | 第三个参数 |
| createSpeechPreview(behavior?) | 完整行为快照 |
| replaySpeech(time, events?, behavior?) / composeSpeechMouth(face, speech, behavior?) | 第三个参数 |
| createCharacterWave(behavior?) | 完整行为快照 |
| replayCharacterWave(time, events?, behavior?) | 第三个参数 |
| morphArmRgba(old, next, width, height, amount, behavior?) | 第六个参数 |

原无参数/default调用、返回形状、显式时间/事件顺序和已有错误语义保持。expression的长眨眼时间表仍允许3600秒；不同旧API原有时间边界不擅自统一收紧，预览整体0–60秒由共用rules限制。无音频通道仍是预设嘴型，不变成音频同步。

使用方式（在调用方已经获得通过L1校验的数据之后）：

```js
const behavior = resolveCharacterBehavior(behaviorDocument);
const motion = createNaturalMotion(parts, { states: true, behavior });
const speech = createSpeechPreview(behavior);
const wave = createCharacterWave(behavior);
// 所有时间仍由调用方显式提供。
```

创建运动求值器不等于验证整个目录包：贴图/rig/许可/摘要等仍必须走L1校验，未来加载器还需首帧/异步取消保护。

## 参数如何进入求值与绘制

- natural_120hz_v1驱动积分步长、16个通道弹簧/限幅、呼吸曲线、风/跟随与触摸反馈；character_states_v1驱动目标姿态/权重、成功反馈/去重与眼态门槛。
- expression_v1驱动确定性LCG眨眼与摸头眼眉；silent_speech_v1驱动cue、持续时间/暂停/结束；wave_v1驱动进入/摆动/退出/打断时间及角度。
- arm_contour_distance_v1驱动mask、传播轮数、边缘函数；预览同样读取肩腕锚点、ROI阈值/余量与说话默认时长，避免纯逻辑接入而绘制仍留旧常量。
- rig/PNG尺寸和静态触摸界限继续使用同一冻结坐标合同。角度矩阵、插值/波形的数学定义属于固定算法版本，不变成包内表达式。
- 旧`states=false`自然动作仍保留臂限幅0.65度/速度3度每秒，这是包外历史兼容模式。当前包v1要求三基础态能力，使用states=true、profile中的3度/12度每秒；不把旧模式加入v1参数JSON或静默改变旧行为。

`character-motion-probe`的固定8秒诊断曲线也迁入core供原工具复用，但其诊断幅度不是新包可调profile。实际包运动由natural/state/wave控制。

## 离线HTML与验证范围

制作导出器从固定白名单core文件按依赖顺序内嵌可信代码，附完整behavior配置及behavior_sha256。自然预览页面先取得一个冻结快照，再传入全部通道/绘制函数。导出的HTML仍是制作预览，未变成纯数据目录包；旧v4 HTML保留。

数值基线在修改前由原实现生成，固定合成事件不含真实pet状态或素材；默认API和显式JSON参数各自对照14段4046采样、旧自然模式289帧、7组轮廓RGBA及89条边界记录。比较原状态/姿态/速度/通道所有权/控制返回值与像素算法摘要，不通过重写预期掩盖漂移。

本切片尚无真实包导出器、独立加载/取消/首帧切换、原目录移除后的恢复或设备运行。完整L3像素等效仍待做，不能用数值摘要或覆盖为0声称所有画风/跨平台渲染均已验收。
