# L2 行为参数接入切片

2026-10-30。用户授权仅实施L2行为参数接入；按[切片Spec/Diff](../context/plans/layered-character-behavior-parameters-spec.md)，[API合同](../protocol/character-behavior-parameters.md)。本轮不实施真实角色包导出或独立加载。

## 完成的修改

七个纯模块（运动矩阵/诊断、自然动作、状态、表情、无音频嘴型、挥手、RGBA轮廓）迁入packages/core；原scripts入口仅转导同名API，现有测试/工具调用继续有效。求值器共用L1固定参数入口resolveCharacterBehavior，省略参数保持旧基线，显式完整JSON先严格校验/克隆/冻结；篡改/未知字段以unsupported_profile拒绝。外部对象后续修改不能污染已有实例。

原积分/浮点运算顺序保持；挥手退出仍使用与进入相同的0.45秒字段，不用2.4−1.95的浮点差值代替常量。保留旧states=false臂0.65度/3度每秒，包模式states=true读当前profile 3度/12度每秒。固定参数JSON/profile版本、360大小/原点、11动态发束、原46动作和许可不变。

离线制作导出器改从固定core白名单内嵌代码，显式传入同一behavior并记录SHA。预览绘制也读取肩腕锚点、轮廓ROI/阈值/余量、嘴型默认时长和历史/时间限制，避免逻辑/绘制各自维护常量。没有包内可执行代码、第三方依赖、设备/固件/pet或现有运行服务操作；未安装/启用插件。

## 验证结果

- npm run check通过；最终npm test为258/258通过，含本轮新增6项参数测试以及工作区其他既有用例。本轮未修改租约/墙钟等其他切片实现。
- 修改前先生成tests/fixtures/character-profile-v4-golden.json（约3KiB），记录原代码SHA和合成时间线摘要。默认调用与显式L1参数均逐组匹配：14段4046帧原组合、289帧旧自然模式、7组轮廓RGBA，以及89条进入/释放/结束/取消附近的边界记录（含LCG完整3600秒日程）。控制返回值、物理姿态/速度/矩阵、状态权重、眼眉嘴及挥手通道均在摘要内。
- 新测试同时验证所有相关工厂/replay/sample/compose入口拒绝缺键/改值/未知数据；快照冻结/外部修改隔离、修改后重新传入拒绝；摸头冷却、说话暂停与挥手取消边界保持。
- 新HTML实际加载21层与全部11处头发。14段4046次浏览器扫描、6133像素body内区低覆盖/越半径166.5安全圆候选均为0；与旧v4保存的整个scan记录逐字段一致，包括每帧记录、末状态和边界框。它是扫描记录等效，不是全画布RGBA逐像素证明。
- 浏览器实际操作：工作→挥手→摸头并开始无音频说话→取消挥手→思考；退出后wave inactive、base thinking，speech仍speaking/open，只拥有嘴部。
- 原主部件SHA、表情manifest、抬手图SHA及根坐标与v4一致；L1参数文档与当前defaults一致。未改PNG/生成新图，未重复制作美术。

## 本地证据

`.cache/layered-character/behavior-parameters-v1/`：

| 文件 | 用途 |
| --- | --- |
| original-sources/ | 修改前的本仓库MIT纯逻辑，仅本地对照，非新运行依赖 |
| preview/index.html / manifest.json | 接入固定参数的隔离预览，manifest记录behavior_sha256 |
| browser-checks.json | 按钮、说话组合及完整扫描记录 |
| asset-verification.json | 原图/根坐标/参数JSON保持证明 |
| scan-comparison.json | 前后scan记录逐字段比较，all_scan_records_equal=true |
| tests.log / equivalence-tests.log | 全套测试与参数专项输出 |

版本化测试fixture只含人工合成事件和数值摘要，不含美术或真实状态响应。临时loopback预览已关闭，浏览器退出页面，旧v4目录保留可直接打开回退。

## 尚未完成与下一项

只完成L2的参数接入。下一项是读取制作候选、导出符合L1的纯数据目录包，再实现独立加载、候选取消/代数保护和首帧交换。尚不能移走制作目录后由新包恢复运行，未接生产仓库/IPC、PET4协调、设备或音频。旧v4观感仍待确认，数值回归不替代自然度/许可复核、跨浏览器像素一致性或设备帧率验收。
