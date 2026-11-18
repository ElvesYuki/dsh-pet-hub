# 原像素400素材候选 Diff

2026-10-30；配套[Spec](native400-material-spec.md)。本轮交付为设计文档，不是实施完成。

## 本轮实际修改

- 新增native400-material-spec.md：固定几何、源像素／安全区策略、78动作审计、预算、M0–M4阶段、适配与回退。
- 新增本Diff及规划报告；在索引、当前系统、待办、决策中登记“400候选，正式360保持”。
- 不修改产品代码、检查脚本、素材、缓存、运行配置或固件；不生成400正式包，不接设备。

## 后续预期改动（每阶段实施前另写具体Diff）

- M0：新增本仓库原创离线工具与合成边界测试，真实素材只读、输出只进忽略目录；产生可审计的78项清单和同帧完整动画对照。
- M1：按明确400 profile审查packages/core/pet4.mjs、materials/role-package和runtime/material-import等入口；新增独立编码recipe，保留现有240/360拒绝／通过语义。
- M2：worker、IPC及代理frame边界、packages/ui/frame-preview.mjs、配额与角色恢复等；400 base64超384KiB，必须统一计算有界新上限并补精确边界负例。不得顺手放宽全部消息限制。
- M3/M4：只形成固件协作需求，固件代码与烧录不属于本仓库授权。固定几何／资源、存储与认证余量由双方验证，非本文件自动批准。

验证本轮文档链接、算术和事实分类；按AGENTS.md运行npm run check和npm test。通过不代表400实现通过；结果见[规划报告](../../reports/2026-10-30-native400-plan.md)。
