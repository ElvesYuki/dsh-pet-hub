# 400全量压缩版：批准合并与设备交接（2026-11-02）

用户已审阅全78压缩优先对照并授权合并。全部78候选原字节复制到新的规范平铺库，未重新编码、减色或改参数；旧合并库／四动作三档／全78对照和旧角色目录保留。[Spec/Diff](../context/plans/native400-compact-merge-spec.md)。

## 当前交付与冻结摘要

| 交付 | 新目录 | SHA256 |
| --- | --- | --- |
| 78文件0.pet–77.pet与manifest | .cache/native400-compact78-v1 | manifest: a1c7c2a6a6a5ffeb113e403262252739271afc18db0a6d53ab40f1ebbab94ae5 |
| 完整78宿主角色目录 | .cache/native400-compact-library78-v1 | index: 5bd657d47a288b055c4806e4245c07c470ad9057edf37338c75d8450fe19df29 |
| 完整78来源记录 | 同上provenance.json | 740fade4b526a1e72dc1f768d7ed3755ef7b091acd11c261066ec918c516845f |
| 八语义宿主角色目录 | .cache/native400-compact-role8-v1 | index: afdda0e87d05ebad3117a25100ad330f58c6b6564adaf10c881b060ce2b92f99 |
| 八语义来源记录 | 同上provenance.json | 9c8719e116b2205f00ae6ff51e72220e4d2b732f522d5ed14fcc6065cb788213 |
| 已审阅全量对照 | .cache/native400-compact78-review-v1 | manifest: 21142a93f4d4b15e137a931ceb2082d33cf9af3c9d72dde1657b92693fe3dd7e |

全库348737057B（332.58MiB），比旧合并408869792B减少60132735B／14.71%。所有完整PET4≤5865472B，最大67号5569645B（余295827B）；新八语义包31877424B，仍超过28MiB，不能据此八项常驻，更不能把全78一次写入既有缓存。

本次全部78文件身份更新，**八语义index也更新**，不能继续引用旧role8摘要。新recipe为native400-compact-approved-v1；源处理仍source400-flat-smoothing-bounded-temporal-palette-hc12-v1，空间18／时间5／至多128色及原色数75%的参数保持。manifest只保留新像素／新增误差／源误差及父文件身份，不继承旧12项中的无损声明或旧palette_mae作为本版总误差。

视觉批准绑定已审阅manifest SHA及全部0–77 ID；这是用户对本版画面的确认，不是对外许可、设备性能或Flash安装批准。设备线程不需要重新筛选／量化，但须核对新文件／目录身份和实际解码显示。

## 验证

新平铺库全部78文件18675帧CRC、索引SHA、RGB565 SHA、长度／文件SHA和随机seek已复验；42号保持118帧，其他77项241帧／全部24fps，与已审阅候选逐字节一致。最大压缩tile与额外完整key数按新PET4重新计算，无沿用旧值。证明在新平铺库host-verification.json。

宿主管理验证已通过：新完整78角色包在原sim_A单文件cap=5865472B下导入／worker全包复验／激活、78动作首帧和虚拟推进、touch返回idle、success保持末帧、400真实IPC像素与同源代理、缓存重启auto和确认revision1／指针原字节保持。实际帧响应426976B＜512KiB。证明在新library78的management-verification.json；自有临时UDS／HTTP／worker／缓存目录已清理。这是宿主模拟链路，不是设备回执。

回归验证：npm run check通过，含构建npm test880/880通过，0失败／取消／跳过（本轮新增3项，含同期其他切片）。新库全部78文件与已审阅压缩候选SHA一致，旧合并manifest／旧index／原对照manifest保持，素材忽略规则及文档链接／git diff --check收尾通过。

新增3项测试覆盖全78视觉批准／审阅SHA绑定、父文件／源／实际118帧／几何／处理参数／容量／证明负例，以及拒绝覆盖既有输出。归档只写新.cache，失败清理仅本次创建目录，不触碰旧CAS／角色指针。

## 设备继续验证

按[最新交接](../protocol/native400-device-handoff.md)顶部新目录继续现有400适配进度，不重做已通过的工作。先核对新manifest及逐项文件SHA，设备目录／缓存批准按既有合同重新绑定新身份；宿主index不直接冒充设备目录摘要。

二进制格式和显示几何不变：400×400／24fps／RGB565、466屏(33,33)居中、无缩放／额外安全圆；头仍256项调色板、索引仍8位，不因有效色数降低而缩短头。key12／flag1／tile20／8000B独立LZ4HC12，非12倍数也可tag0，按tag解完整帧／XOR。42号118帧、首尾与seek；保护0/4、取消／切换保旧画面、缓存保存／恢复／回退及RAM／加载／帧率仍按设备合同验证。

旧库.cache/native400-merged78-v1及旧角色目录保留，旧manifest db185f3020000b1bea6d1bd380ba39bfc8f0ab24e9fd3d1a6a29b87160769ca8、旧完整index 195224a9d55b46569341b393f8f9b51d22959d327364802ac5c2a8d2163246a3仍对应旧文件；回退须整套身份一致，不能混合批准。正式360／固件／设备／现有服务本轮未写入，未联系其他线程、未提交推送。
