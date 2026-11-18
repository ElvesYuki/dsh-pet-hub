# 分层角色包 v1 Diff

2026-10-30。状态：**L1和L2行为参数/真实包/独立加载已实现，[L3宿主等效/重开/资源](../../reports/2026-10-30-layered-character-l3.md)已验收；生产接入和跨浏览器/设备仍后续。** 配套[Spec](layered-character-package-spec.md)、[L1实际报告](../../reports/2026-10-30-layered-character-package-l1.md)。[独立加载实际落点](../../reports/2026-10-30-layered-character-loader.md)，不改生产角色运行层。

## L1实际落点

- core/layered-character-json.mjs、layered-character-package.mjs、layered-character-profiles.mjs：严格JSON/文档/固定profile数据合同，无求值执行。
- runtime/layered-character-png.mjs、layered-character-validator.mjs：有界字节/PNG及只读目录审计；刻意使用validator命名，不冒充L2加载器。
- simulator/layered-character-fixture.mjs、scripts/validate-layered-character-package.mjs、tests/layered-character-package.test.mjs：原创合成包、显式只读CLI及24项正负测试。
- docs/protocol/layered-character-package.md、layered-character-profiles-v1.json：完整字段表/参数基线。

## L2行为参数实际落点

core/character-*为单一纯求值实现，scripts同名模块兼容转导；profile模块增加resolveCharacterBehavior快照入口，制作预览/导出器显式传入行为并内嵌固定core代码。新增6项数值/边界/参数测试，原v4数值基线保留，见[报告](../../reports/2026-10-30-character-behavior-parameters.md)。

## L2真实导出实际落点

runtime/layered-character-export.mjs、scripts/prepare-layered-character-package.mjs实现显式来源SHA/许可绑定、原字节去重、L1复验、外部回执及私有stage发布；validator的安全目录/读取逻辑共用。新增16项合成导出测试，真实包已输出并二次复验，见[报告](../../reports/2026-10-30-layered-character-export.md)。

下表保留总体规划；行为参数化/导出已完成，独立加载/生产装配尚未实施。

## 相对现状的变化

| 当前 | 拟议结果 |
| --- | --- |
| master/face/raised-arm分别读取制作manifest | 离线导出为独立dsh-layered-character/1目录，显式引用与SHA闭合 |
| HTML内嵌素材和脚本本身充当交付 | 包只含白名单JSON/PNG；本仓库受信任引擎按固定profile求值，HTML仅为展示工具 |
| 参数散在自然/状态/表情/说话/挥手脚本 | 完整提取当前profile参数快照、字段/范围校验；profile版本冻结算法，首版只接受当前基线 |
| 预览隐式知道清洁贴图覆盖和绘制例外 | rig记录最终有效绑定、face slots、open_edge、挥手替换及前景顺序 |
| 预览基于制作目录，不验证正式包加载 | 独立目录＋expected manifest SHA→全文件复验→离屏首帧→load_generation检查→切换 |
| 新PNG/代码混合的制作候选 | 包内无可执行内容，不携带原HTML、脚本、本机路径或原始大源稿 |

## 拟议文件与职责（名称在实施中可按既有结构收敛）

| 层/文件 | 拟议变更 |
| --- | --- |
| docs/protocol/layered-character-package.md | L1时从Spec冻结字段表/JSON示例/错误语义，继续标明未实现部分，不把设计写成已支持 |
| packages/core/layered-character-package.mjs | 纯数据schema、rig/profile/引用/资源元数据校验；不读取磁盘/DOM，不复用PET4 schema误判新包 |
| packages/core/layered-character-profiles.mjs | 固定profile注册、严格参数结构、能力检查及纯时间/通道适配；复用已有原创行为实现，避免复制一套产生漂移 |
| packages/runtime/layered-character-loader.mjs | 显式本地目录安全读取/长度/SHA/PNG校验，产生私有已验证候选；无自动发现/网络或生产service挂载 |
| scripts/prepare-layered-character-package.mjs | 显式输入摘要、纹理去重/规范化、临时目录验证后发布新.cache包与外部回执 |
| scripts/layered-character-package-preview*.mjs | 独立加载器的Canvas/浏览器适配与控制，候选代数、取消、关闭/资源清理；不依赖pet或DSH |
| 现有character-*行为模块与预览 | 将所需固定参数提取到profile边界并复用；保留旧调用的默认值与旧v4参考，避免只拷贝代码到新目录 |
| tests/layered-character-package*.test.mjs | 原创合成PNG、严格负例、取消/旧异步、导出可重现/源目录移除、角色等效和回退 |
| docs/context及制作指南/清单 | 事实变化时更新包入口、限制和测试，旧阶段证据归档，不将authoring checklist改名冒充运行manifest |

新profile字段表必须覆盖现有脚本所有影响输出的常量，L1先梳理再实施参数化；禁止让包携带JS或用“算法版本一致”掩盖未打包的自定义参数。若迁移到core，保持纯逻辑和原有测试入口可兼容；不让core导入DOM/文件读取或DSH。

## 明确不改

- package_schema=2、SIM2/PET4解析、现有8语义/46动作、角色CAS仓库/激活指针/IPC及管理界面；新包未入库，旧代码遇到它应按旧白名单拒绝，不能被误当完整PET4包。
- 固件/bridge/pet状态来源、真实设备承载/Flash、音频播放/嘴型同步、现有运行服务/插件安装状态。
- 冻结360大小/原点、21主层/11动态发束、当前挥手轮廓算法/时序与原眼睛；不为导包减少动态或重做图像。
- 不安装依赖，不引入完整Live2D/Cubism或第三方动画SDK；工作区现有制作依赖不能变成包内运行代码。

## 迁移、失败与回退

只在新命令/新输出目录中引入格式，既有制作目录/HTML及PET4导入链路保留，不进行隐式目录升级或配置迁移。L1先做合成fixture与受信任profile合同，L2才导真实候选/独立加载，L3对照回归；后续接仓库/设备另写Diff。

包导出失败不发布半包；候选校验/解码/首帧失败保留旧画面。一个活跃角色＋最多一个候选，旧load_generation结果只能清理自身，不能更新新角色。恢复只重验显式选择的包，从idle重建，不恢复触摸/挥手/旧嘴型会话或弹簧状态。

回退停止独立工具并重新打开旧v4；任何新包目录留待显式清理，不覆盖或删旧素材。宿主文件rename/页面首帧不等于设备Flash事务或实物显示确认。

## 检查与完成定义

实施后运行npm run check/npm test和Spec的L1–L3验收矩阵；包校验负例不代替视觉/内存验证。当前217测试与4046次扫描只证明既有v4预览，不是新包验收结果。L1及L2参数/真实导出/独立加载已完成，L3同Canvas后端等效、复制包重开和资源验收也已完成；下一是生产宿主接入设计。
