# 400-03 待实现摘要的替代

2026-11-02。下列为400-02完成后、400-03实现前语境，现由[400-03报告](../../reports/2026-11-02-native400-03.md)/[API与W01–W10](../../protocol/native400-wire-review.md)替代。400-02阶段48专项/1018回归保持历史证据；本轮36专项/94正116反/1054回归只覆盖独立review codec/元数据及宿主向量，正式策略/联合G0/固件准入没有完成。295份原源文件及360合同保持，下一400-04默认OFF临时链，不接真实设备。

## 原docs/context/index.md

管理端最新（2026-11-02）：[400-02 Spec](../plans/native400-02-spec.md)/[Diff](../plans/native400-02-diff.md)、[API/资源/完整性](../../protocol/native400-window.md)、[48专项报告](../../reports/2026-11-02-native400-02.md)、[原创review向量](../../protocol/vectors/native400-02-window-review-v1.json)、[归档](native400-02-evolution.md)。实际1MiB ring/三RGB、118/241时钟、全验后重读与显式渐进对照、首帧/取消/同步退出已离线验证，check/独立CLI及全套1018通过；schema3仍本地review、无Flash/生产装配/设备证据。400是主线、旧尺寸只备份；[400-01身份/导入](../../reports/2026-11-02-native400-01.md)保持，真实P/M/N候选不代表用途批准/正式N/安装。下一400-03共同协议/向量，再400-04默认OFF装配；[400基线](../native400-baseline.md)/[共同G0](../plans/round-pet-g0-handoff.md)未准入。

## 原docs/context/current-system.md

2026-11-02 [400-02纯core帧窗口](../../reports/2026-11-02-native400-02.md)已完成本轮离线范围：1MiB实际ring与file5865472B分开、3RGB/history/tile有界、24帧准入/36高水位、真实LZ4/XOR/CRC与118短尾/241、首帧/欠载/迟到平移/循环及取消/会话/期限/同步退出已验。默认全验后重读＋逐帧SHA，显式progressive-review仅离线，pending/failed不冒充全F verified；saved/offline_available不支持、persistent=null。48专项/独立CLI正常清理、check（语法）及含构建全套1018/1018通过。宿主逻辑typed-array最大2194816B，含额外7712B收据，不是ESP/TLS/RSS硬上界。schema3只本地review，未修改通用schema1/2、360/旧wire/生产装配；289份原源文件中288份SHA保持，只给PET4新增显式400 tile导出。[API/待固件决定](../../protocol/native400-window.md)、[被替代摘要](native400-02-evolution.md)。

## 原docs/context/current-todos.md

1. **400-03共同wire与宿主字节向量**：400-01身份/严格导入与[400-02纯core窗口](../../reports/2026-11-02-native400-02.md)已离线完成，旧尺寸只备份。下一先Spec/Diff，独立400 profile/hello/cap版本、78项分页/4KiB body、118短尾、完整性/维护/首帧状态、Range/HTTP关联及Node/C++同字节正反向量，不扩大旧360 revision2。默认全验后重读＋帧SHA仅管理端离线选择，生产策略仍须固件确认；明确两遍/7712B收据/每loop重读成本，或另审渐进头帧信任与pending/failed语义。仅离线合同/向量不要求先接设备。
