# 400-15替代记录

2026-11-03：以下旧最新摘要/下一入口由[当前系统](../current-system.md)/[待办](../current-todos.md)及[400-15报告](../../reports/2026-11-03-native400-15.md)替代；只替代“共享UI真实浏览器尚未验/下一15”与当前安装版本表述。14及以前的生产实现/设备限制仍有效，DSH身份/native dialog/rc.5动态profile仍未验。

## 原 docs/context/index.md

管理端最新（2026-11-03）：[400-14 Spec](../plans/native400-14-spec.md)/[Diff](../plans/native400-14-diff.md)、[临时交互宿主API](../../protocol/native400-interactive-host.md)、[42专项/1395回归报告](../../reports/2026-11-03-native400-14.md)/[原创证据](../../protocol/vectors/native400-14-host-v1.json)、[旧入口归档](native400-14-evolution.md)。默认OFF交互profile已接原13 controller、私有实例固定IPC、受信临时页面provider和共享操作UI；实际HTTP/UDS/source/journal、构建设置槽JS宿主、取消/丢ACK同请求确认/unknown恢复已验。339条既有文件中332保持，7修改/5新增，controller/reader/selector/journal/固定wire/400-07保持；默认apply无provider仍只读。下一400-15先评审原生选择/可信页面权限交接及隔离浏览器/DSH方案；本轮没有真实浏览器/DSH用户身份/native picker或设备验收，真实用途/G0/资源/Flash/TLS/G1-G2/24fps另验，外部仍400-06快照。

## 原 docs/context/current-system.md

2026-11-03 [400-14默认关闭临时交互宿主](../../reports/2026-11-03-native400-14.md)已完成离线范围：仅UDS赢家显式装配原13 controller，controls策略进sourceKey；owner可信authorize/choose/revoke，独立内存凭据/固定实例IPC、受信临时页面resolver、精确Origin/Host及白名单GET/start/cancel，严格4KiB JSON/独立2.5秒body门禁。共享界面显式审阅/历史复验/定向取消，私有选择不进渲染树；丢响应保原body手动确认，无自动写重试，迟到poll/会话变化/卸载隔离；unknown只可信历史重开，close等实际I/O退出。42专项/独立临时CLI、check（语法）及含构建1395/1395通过；339条既有文件中332保持，7修改/5新增，controller/reader/selector/journal/固定wire/400-07与依赖不改。[Spec/Diff](../plans/native400-14-spec.md)、[API](../../protocol/native400-interactive-host.md)、[原创证据](../../protocol/vectors/native400-14-host-v1.json)、[旧入口归档](native400-14-evolution.md)。默认service无交互选项、默认plugin apply无provider，继续只读；候选未安装，未读真实源/固件/备份、未接设备/生产listener/现有配置。本片UI为构建JS hook宿主与真实临时HTTP/UDS，未验真实浏览器/React DOM/DSH用户身份/native picker；下一400-15先评审该交接/隔离profile方案，外部仍400-06快照。

## 原 docs/context/current-system.md

本机旧pet缺少getState，真实HTTP仅核对过空闲响应，

## 原 docs/context/current-system.md

实测环境DSH 0.2.1-rc.3/pet 0.3.8/macOS，不代表完整版本兼容；

## 原 docs/context/current-system.md

下一400-15评审可信provider/原生选择和隔离浏览器方案，

## 原 docs/context/current-todos.md

1. **400-15可信provider/原生选择交接与隔离浏览器评审（下一实施入口）**：先Spec/Diff和具体方案/回退，基于[400-14临时交互宿主](../../protocol/native400-interactive-host.md)明确真实宿主身份→单审阅会话→显式本地文件选择→私有scoped client的交接/撤销/重开与权限期限；核对DSH实际可用能力，没有可靠provider继续只读，不以Origin/client_id/global status或临时cookie测试代替用户身份。先原创临时源/隔离profile，准备真实浏览器/React DOM的审阅、同请求确认、取消待退出及重载/卸载验证方案；不默认安装/启用插件或修改现有DSH，执行须遵守已授权边界。不要重做13 controller/原reader/journal或放宽unknown/坏档恢复。

## 原 docs/context/current-todos.md

本机旧pet缺少getState，不自动升级，

## 原 docs/context/native400-baseline.md

400-13[报告](../../reports/2026-11-03-native400-13.md)/[API](../../protocol/native400-review-controller.md)的内部单会话/选择/任务、高水位ACK去重、同步授权提交gate与unknown/真实退出继续有效。400-14[报告](../../reports/2026-11-03-native400-14.md)/[API](../../protocol/native400-interactive-host.md)：42专项/独立CLI/check/1395全套已验默认OFF交互profile、私有IPC、受信临时页面代理和共享操作UI；源/journal真实I/O、原请求确认、定向取消和退出保持。仅构建JS hook宿主，未验证实际浏览器/DSH身份/native picker；默认apply无provider只读，下一400-15先审该交接/隔离profile，不改变设备准入，外部仍400-06快照。

## 原 docs/context/native400-baseline.md

下一400-15可信provider/原生选择及隔离浏览器评审；

## 原 docs/protocol/native400-interactive-host.md

**本轮未验证真实浏览器/React DOM交互、DSH用户身份与native文件选择器、实际DSH交互profile的加载/重载/卸载**；旧P1只读宿主结果不能代替此授权验收。下一400-15先评审明确可信provider/原生选择交接与独立profile浏览器方案，缺可信身份时继续只读。

## 原 docs/protocol/native400-source-review-controls.md

真实浏览器/DSH用户身份/native picker未验，

## 原 docs/protocol/native400-source-review-controls.md

实际浏览器/DSH用户身份/native picker仍未验，不能将CTL-01–40整体标完成。

## 原 docs/context/plans/native400-manager-alignment-spec.md

## 400-14后的当前入口（2026-11-03）

## 原 docs/context/plans/native400-manager-alignment-spec.md

400-01至05、07至10/12离线实现及06/11评审已完成；13内部控制/gate与14默认OFF交互profile/私有IPC/受信临时proxy/共享UI已离线验证，见[400-14报告](../../reports/2026-11-03-native400-14.md)/[API](../../protocol/native400-interactive-host.md)。42专项/1395全套包含既有回归，原reader/selector/controller/journal/固定wire保持。默认apply无provider仍只读，构建JS hook宿主不能替代真实浏览器/DSH身份/native picker；下一400-15先Spec/Diff核对可信provider/原生选择交接与隔离profile方案，CTL整体不能标完成。正式合同、真实用途和G1/G2/24fps另审。

## 原 docs/context/plans/round-pet-g0-handoff.md

下一400-15审宿主身份/选择交接。

## 原 docs/protocol/native400-g0-review.md

下一400-15审该交接与隔离方案，

## 原 README.md

真实浏览器/DSH用户身份/native picker仍待下一400-15评审。

## 原 README.md

S2模拟管理：`npm run preview:simulation`（本机DSH 0.2.1-rc.3只读React种子要求；启动独立临时服务，无插件安装）。

## 原 docs/protocol/native400-review-controller.md（收尾对齐）

真实浏览器/DSH身份/native picker另待400-15评审。

## 原 docs/protocol/native400-review-controller.md（收尾对齐）

下一400-15先评审可信provider/原生选择交接与隔离浏览器方案；

## 原 docs/context/plans/round-pet-g0-handoff.md（收尾对齐）

下一400-15先审可信provider/原生选择与隔离浏览器方案。
