# 400-03 Diff（实现前）

2026-11-02，配套[Spec](native400-03-spec.md)。源文件SHA及当前摘要变更前副本位于忽略.cache/native400-03。

| 范围 | 新增 | 不变 |
| --- | --- | --- |
| core | native400-wire-contract.json与native400-wire.mjs：closed review表/canonical编解码、状态关系、HTTP路径/头关联检查 | 旧360表/parser、通用能力、400-01/02、lease/session/guard不改 |
| native | native400-wire-check.cpp：独立MIT C++17宿主解析/表匹配/新语义 | 旧oracle/固件/生产网络不改 |
| simulator/scripts/vectors/tests | 原创review fixture、golden生成/固定SHA、Node/C++对照与HTTP负例、独立监督CLI | 不读真实媒体/凭据或启动socket，不改旧向量 |
| 文档 | Spec/API/完整性决定与待确认清单/报告、当前摘要/历史替代 | 不代固件签核、资源/生产准入或实体回执 |

无依赖/配置/持久格式变更，不装配任何默认路径。具体落地、分页实际大小、测试数量与偏差实施后填写。

## 实际落地（2026-11-02）

按计划新增7文件：core表/codec、独立C++oracle、原创fixture、golden生成/监督CLI及36专项；295份原源文件SHA全保持，0修改/删除，无依赖/入口变化。新codec增加validateNative400MaterialRefs，对已批准400-01元数据做纯比对，不重建仓库/认证或产生授权。为local4补独立asset.verified/verification_seq，远端verified报告亦携带序列，首帧引用由400-04解析；byte codec不持有跨消息状态。

固定94正/116反同字节，Node/C++独立接受/拒绝；JSON表29,188B、原创向量487,456B，均为协议文字/合成输入，无动画大文件。极值四项page3019B（最大descriptor尾页3039B）、八项4675B；固定正例最大3792B，补测最长显示3877B。36专项/独立CLI正常清理/check/含构建1054通过。Node-only HTTP路径/头/Range和素材pin与C++ JSON覆盖分别记，真实HTTP/TLS/actor/固件不在本片。

完整边界、回退与W01–W10见[API](../../protocol/native400-wire-review.md)/[报告](../../reports/2026-11-02-native400-03.md)。旧400-03待实施摘要已归档，下一400-04默认OFF临时链；联合G0与生产策略/正式N/资源/持久化未签核，不自动启用。
