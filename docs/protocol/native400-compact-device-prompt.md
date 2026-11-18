# 设备侧继续验证提示词（2026-11-02）

下面正文可复制到已有设备侧线程；摘要来自[当前交接](native400-device-handoff.md)及[批准合并报告](../reports/2026-11-02-native400-compact-merge.md)。

```text
我已确认全78动作“压缩优先”版的画质，管理端已完成合并。请沿用你当前400适配和验证进度，将后续验证素材切换为下面的新版本，保留已有代码、验证结果及回退，不从头重做已通过的工作。

先读你仓库当前AGENTS、系统摘要、待办，以及管理端最新交接：
/Users/elves/myproject/github/dsh-pet-hub/dsh-pet-hub/docs/protocol/native400-device-handoff.md

新素材规范目录（0.pet–77.pet）：
/Users/elves/myproject/github/dsh-pet-hub/dsh-pet-hub/.cache/native400-compact78-v1
manifest.json SHA256：
a1c7c2a6a6a5ffeb113e403262252739271afc18db0a6d53ab40f1ebbab94ae5

新完整宿主角色目录：
/Users/elves/myproject/github/dsh-pet-hub/dsh-pet-hub/.cache/native400-compact-library78-v1
index.json SHA256：
5bd657d47a288b055c4806e4245c07c470ad9057edf37338c75d8450fe19df29

如果使用八语义包，改用：
/Users/elves/myproject/github/dsh-pet-hub/dsh-pet-hub/.cache/native400-compact-role8-v1
其index.json SHA256：
afdda0e87d05ebad3117a25100ad330f58c6b6564adaf10c881b060ce2b92f99

本版全部78文件都更新了，八语义包摘要也已更新。请核对逐项SHA，并按设备侧现有合同重新生成/绑定目录、缓存与批准身份；不能复用旧SHA或把宿主index当作设备目录摘要，不混用新旧文件。旧库及旧角色目录仍保留用于整套回退。

画质已确认，不再重新筛选、减色或压缩。保持：
- 400×400，466屏按(33,33)原像素居中，无缩放、额外安全圆或逐动作平移。
- 全部24fps；42号118帧，其余77项241帧，按实际帧数处理首尾、循环、截止和seek。
- PET4头仍256项RGB565调色板、每像素8位索引；有效色数减少不改变二进制布局。
- key interval12／flags1／20行tile＝8000B独立LZ4块。非12倍数帧也可以tag0，必须按tag解完整帧或XOR。
- 全库348737057B，较上版小14.71%；所有文件≤旧5865472B，最大67号5569645B。按既有缓存/Flash及保护0/4合同管理，不能把全库或八语义包直接当成全部常驻。

管理端已完成新库18675帧CRC、索引/RGB565 SHA及seek；完整78包在旧cap下的宿主导入、激活、动作切换、帧代理和缓存恢复也通过。这些不替代设备证据。

请继续验证：先用设备侧解码器核对新文件与manifest，重点覆盖0/4、42号118帧、67号最大文件、额外tag0及随机seek；再沿用已授权验证窗口检查实际显示、加载/首帧/切换、帧率与漏帧、RAM/内部余量、取消/失败保旧画面、保存/恢复和回退。文件变小不改变400帧缓冲需求。保留正式360恢复路径，沿用本线程已有授权范围，不额外调整分区或现有服务。

完成后记录本次采用的新manifest/目录SHA、已通过/失败/待验项目、资源与时序实测、剩余问题及回退状态。不要只更新文档后停止；在已有授权范围内继续完成验证。
```
