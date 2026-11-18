# PET4严格离线解析与播放验证

2026-10-29。packages/core/pet4.mjs为独立MIT实现，不复制或执行固件源码。runtime/material-import.mjs在原目录摘要/许可白名单/文件长度与SHA检查后，对PET4执行完整解码；原SIM2仍兼容。无设备连接、真实显示提交或硬件帧率承诺。

## 格式契约

只接受240或360正方形、24fps、1–360帧；压缩文件限240的3MiB或360的5865472B。小端字段：

| 偏移 | 内容 |
| --- | --- |
| 0 | PET4魔数 |
| 4/6/8/10 | uint16宽/高/fps/帧数 |
| 12 | 256项uint16 RGB565调色板 |
| 524/526 | uint16关键帧间隔12、编码版本1 |
| 528 | uint32 CRC32覆盖[4,528) |
| 532 | frames+1个uint32 payload相对偏移，随后frames个uint32索引帧CRC |
| 532+4×(2×frames+1) | 压缩payload |

offset首项必须0，严格递增，末项必须精确等于payload长度，不允许尾随数据。每帧tag=0全量或1 XOR差分；每12帧必须tag0。每帧按20行tile，每tile用uint16压缩块长度；长度不超过tile+floor(tile/255)+16，不能跨帧或包含多余字节。

LZ4块严格限制输入/输出边界、扩展长度、非零且向后的match offset、重叠复制及终止条件；精确解码width×20字节。遵循LZ4 v1.10.0块格式的末尾literal与最后match约束。XOR重建后核对整帧CRC32，再将每个索引查表为小端RGB565。随机跳转从对应关键帧重建；同帧重读、前跳、回跳与循环有明确行为。CRC和SHA用途不同，二者都保留。

导入全帧检查还累积indices/RGB565 SHA256，不保留整动画解码帧数组。inspectPet4返回width/height/frames/fps、索引/RGB全流摘要和独立frame(index)接口；该接口按需解码帧、返回帧号/尺寸/RGB摘要，不能当作固件确认。目录manifest的display必须与二进制一致。

## 播放协调

runtime仅对已导入验证且所有action字节均存在的PET4或SIM2装配。旧内置PET4候选没有可信文件，继续仅规格参考，不能凭codec直接标可播。accepted/verified/playing仍由虚拟时间和提交阶段区分；PET4在模拟首帧提交前实际解码frame0，失败不替换旧actual。后续按floor(elapsed_ms×24/1000)%frames获取帧，写decoded_frame(frame_index,width,height,rgb565_sha256)。每设备独立decoder，离线/切包清pending及decoder，保留最后观测；重启重新导入和验证，只恢复偏好。

这验证了真实字节的解码与时间选择，没有实现浏览器动画画布、硬件扫描或Flash安装。RGB565转PNG仅为本地诊断，保留素材原许可，不纳入发布包。

## 宿主审计CLI

scripts/audit-pet4.mjs：参数--source-dir、--manifest-sha256、--license-ref dsh-pet-nc-86181ce、--output。固定源manifest摘要后，逐动作读取实际.pet、校核文件SHA/长度、全部帧CRC/fps/帧数，并将重建索引流摘要与现有index_sha256比对。结束再次核对manifest摘要；只写摘要报告，不执行外部脚本、不改外部目录。不检查发布者签名，也不等于商业授权。

导入index.json仍使用[目录契约](material-import.md)的规范元数据摘要，不直接兼容外部media_contract.py的pet-package-v1-canonical-json包摘要（后者还覆盖timing/semantics）；两者禁止混用。未来完整角色包语义迁移另审。

## 容量与未覆盖

总快照32MiB上限保持；真实360八个语义动作共35701591B，超过预算，启动导入应拒绝。全库审计逐动作读取，不等于全库导入成功。当前未实现磁盘内容仓库/后台worker/长期去重回收、PET4之外的格式、Flash掉电状态、v5/认证/设备性能测试；全帧校验同步运行，不能据此承诺UI实时延迟。复杂恶意输入有边界负例，但尚无长期fuzz/独立安全审计。

后续[流式仓库](material-store.md)已解决完整360库的整库快照限制，后台worker也承担播放解码；原snapshot路径仍保留32MiB限制。实际全库/响应性结果见对应报告，不能把磁盘预算等同于总内存。
