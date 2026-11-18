# 400-14替代记录

2026-11-03：以下实施前原文由[当前系统](../current-system.md)/[待办](../current-todos.md)及[400-14报告](../../reports/2026-11-03-native400-14.md)替代。仅替代“14未接”、旧最新验证与下一入口；13/12/09内部控制/选择/持久与400-06外部快照仍有效。真实浏览器/DSH身份/native picker仍未验。

## 原 docs/context/index.md

管理端最新（2026-11-03）：[400-13 Spec](../plans/native400-13-spec.md)/[Diff](../plans/native400-13-diff.md)、[内部控制器API](../../protocol/native400-review-controller.md)、[45专项/1353回归报告](../../reports/2026-11-03-native400-13.md)/[原创证据](../../protocol/vectors/native400-13-controls-v1.json)、[旧入口归档](native400-13-evolution.md)。已验单会话/选择/任务、ACK去重/一次消费/定向取消、同步授权期限/提交gate、unknown恢复与实际退出；333条原源保持，2修改/4新增，reader/selector/journal/固定wire/400-07/只读service保持。下一400-14先Spec/Diff接显式交互profile/IPC/代理/UI与权限方案；内部handle验证不等于真实浏览器/DSH身份，native picker/真实用途/G0/资源/Flash/TLS/G1-G2/24fps仍另验，未接设备或现有配置。

## 原 docs/context/current-system.md

2026-11-03 [400-13内部有界控制器](../../reports/2026-11-03-native400-13.md)已完成离线范围：单可信会话/单选择/单任务，uint64高水位与最近ACK去重、一次选择消费、同步定向job取消；复用400-12选择/原owner与journal，新增可选严格同步Boolean授权gate进入准入/提交/发布，首次失效锁存、坏/异步/重入修改失败关闭。控制器直接核会话/任务截止，timer只唤醒，rename后跨期只保历史，unknown优先至可信重开；元数据/内容实际退出后回收，迟到timer不能影响新会话。45专项/监督CLI清理、check（语法）/含构建1353/1353通过；335条原源中333保持，2修改/4新增。[Spec/Diff](../plans/native400-13-spec.md)、[API](../../protocol/native400-review-controller.md)、[原创证据](../../protocol/vectors/native400-13-controls-v1.json)、[旧入口归档](native400-13-evolution.md)。管理操作线仅内部13已落地，400-14交互profile/IPC/代理/UI及真实页面授权/native picker未接；service仍400-10只读，无生产/设备/真实源/固件/现有配置操作，外部仍400-06快照。

## 原 docs/context/current-system.md

400-12[选择绑定](../../protocol/native400-source-selection.md)继续有效：元数据短fd/opaque引用、原reader首读前指纹钉住、TTL准入/撤销/坏时钟与实际退出；默认undefined旧接口/来源map/journal保持。400-13在其上增加可信内部消费/任务授权，没有把raw选择引用直接开放给页面。

## 原 docs/context/current-system.md

400-13内部控制器已完成，下一400-14交互接线先Spec/Diff，继续不从来源审阅生成设备库存授权。

## 原 docs/context/current-todos.md

1. **400-14显式临时交互profile/IPC/代理/UI（下一实施入口）**：先Spec/Diff和具体方案/回退，复用[400-13内部控制器](../../protocol/native400-review-controller.md)/[400-11契约](../../protocol/native400-source-review-controls.md)，明确仅UDS赢家装配、新profile进入sourceKey、私有审阅权限/选择引用的发放与同源检查、异步start/任务状态/定向cancel及UI确认。不能将global status、随机client_id/Origin或账本作为授权，缺可信页面/native provider时保持只读；原生picker与实际DSH权限验证单列。先原创临时源/隔离环境，不接设备/生产listener/现有服务或配置；不重复controller/reader/journal或放宽坏档/unknown恢复。

## 原 docs/context/native400-baseline.md

400-13[报告](../../reports/2026-11-03-native400-13.md)/[API](../../protocol/native400-review-controller.md)：45专项/监督CLI/check/1353全套已验内部会话/一次选择/单任务、请求高水位ACK去重、定向取消、同步授权提交gate与unknown/真实退出。未接交互service/IPC/UI或真实页面身份；下一400-14先Spec/Diff，设备准入与旧wire不变，外部仍400-06快照。


## 原 docs/context/native400-baseline.md

400-13内部有界控制器已完成，下一400-14交互接线；

## 原 docs/context/plans/native400-manager-alignment-spec.md

## 400-13后的当前入口（2026-11-03）

## 原 docs/context/plans/native400-manager-alignment-spec.md

400-01至05、07至10/12离线实现及06/11评审已完成；[400-12报告](../../reports/2026-11-03-native400-12.md)记录35专项/1308回归、内部元数据选择/原reader首读前绑定与提交检查。400-13已补内部可信会话/去重/定向取消与同步授权gate，45专项/1353回归见[报告](../../reports/2026-11-03-native400-13.md)；网页/原生provider待400-14，CTL整体不能标完成。service仍400-10只读，下一400-14先Spec/Diff；正式合同、真实用途和G1/G2/24fps另审。


## 原 docs/protocol/native400-g0-review.md

7. **400-13内部操作控制（离线已完成）**。见[45专项/1353回归](../../reports/2026-11-03-native400-13.md)/[API](../../protocol/native400-review-controller.md)。有界会话/选择/任务、ACK去重/定向取消/同步授权期限与unknown恢复已验，无service/页面写路由或真实宿主身份授权。下一400-14仅先审显式交互方案，不改设备N_boot/proof/Flash/G1-G2/24fps准入。


## 原 docs/protocol/native400-source-review-host.md

后续[400-11操作评审](../../protocol/native400-source-review-controls.md)已收口上述设计，运行实现仍保持本页只读边界；后续[400-12](../../protocol/native400-source-selection.md)已实现内部选择钉住，控制会话/定向取消/完整同步授权gate与网页交互仍待实现。不开放任意路径读、自动批准/扫描或账本修复。共同G0、真实用途、N_boot协议/当前库存、Flash writer/proof、可信时间/凭据/TLS、G1/G2/24fps仍另审。本轮外部事实沿用400-06快照，生产/实体窗口须另有具体方案、回退及授权。


## 原 docs/protocol/native400-review-controller.md

默认服务/CLI/IPC/代理/UI未装配该控制器，页面仍只读，真实文件选择与页面授权仍待400-14。

## 原 docs/protocol/native400-review-controller.md

本片验证CTL中的内部请求/取消/期限/资源与旧持久边界；HTTP Origin/真实页面授权、native picker、service选主下的交互装配/IPC/代理/UI仍待400-14。不能把内部handle验证等同已实现浏览器/DSH用户身份。旧400-10 profile仍只读，没有新CLI参数、生产listener或设备指令。

## 原 docs/protocol/native400-review-controller.md

下一400-14需先Spec/Diff与明确临时交互/授权方案；

## 原 docs/protocol/native400-source-review-controls.md

**400-12选择与400-13内部操作控制已实现并离线验证；本页仍包含后续400-14交互设计，网页写路由/真实页面授权/native picker尚未实现。**

## 原 docs/protocol/native400-source-review-controls.md

页面权限仍未接。

## 原 docs/protocol/native400-source-review-controls.md

HTTP Origin、真实页面身份/native picker及service交互接线仍未验，不能将CTL-01–40整体标完成。

## 原 README.md（收尾对齐）

仅内部离线能力，原service/IPC/UI仍只读；下一400-14先审显式交互profile及宿主权限。

## 原 docs/context/native400-baseline.md（收尾对齐）

400-13控制器已完成，下一400-14。

## 原 docs/context/native400-baseline.md（收尾对齐）

页面/原生provider待400-14；外部仍400-06快照。

## 原 docs/context/plans/round-pet-g0-handoff.md（收尾对齐）

当前无页面写路由/真实源/设备通道，

## 原 docs/context/plans/round-pet-g0-handoff.md（收尾对齐）

后续400-11已审边界，仍无交互实现。

## 原 docs/context/plans/round-pet-g0-handoff.md（收尾对齐）

后续再做可信会话/有界请求去重/定向取消/同步提交授权gate，最后才显式交互profile；后两部分待实现，

## 原 docs/context/plans/round-pet-g0-handoff.md（收尾对齐）

下一400-14显式交互另先审边界。

## 原 docs/protocol/native400-source-review-controls.md（收尾对齐）

页面受限流程尚未接入
