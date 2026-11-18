# PET4离线导入、严格解析与播放 Spec（实现前）

2026-10-29。只读审计外部PET4生成器、通用C++解码器和素材manifest，禁止导入/执行其Python模块、修改或构建固件。已从固定上游README核对：代码MIT，素材禁止商用，形象CC BY-NC-SA 4.0，保留原作者与设计来源；本轮仅本地非商业验证，不复制素材到Git、不再分发动画。PET4/LZ4格式独立用JS实现，新代码MIT，不复制Apache/BSD源码；参考来源及快照摘要登记THIRD_PARTY。

新增纯core PET4解析器与LZ4块解码：240/360正方形、24fps、1–360帧，key12/tile20、CRC32覆盖header、严格offset起末/单调/边界、full/delta标签和定期关键帧；每块有界LZ4长度/offset/重叠/终止约束，精确输出tile大小，逐帧XOR重建、CRC验证、RGB565调色板转换。只保留当前索引帧和RGB帧，不缓存全部帧。随机取帧从关键帧重新解码；拒绝越界帧。

运行层导入支持PET4，保留index/文件摘要、许可白名单与原有读入预算。导入时全帧解码并记录索引/RGB摘要、帧数/fps；播放复验后持有独立decoder，虚拟时钟按24fps循环取真实RGB帧并记录frame_index/RGB SHA256，首帧提交仍模拟，无设备/画布显示/FPS性能承诺。内置PET4元数据因没有可信文件保持metadata_only，不能仅凭codec当可播。

新增只读宿主审计CLI对实际240/360素材库逐文件验证manifest长度/SHA/时间信息/全帧CRC，与既有index_sha256独立比对；输出忽略目录中的摘要结果，无大二进制。需显式manifest摘要和已核对许可引用，不读取Wi-Fi/桥接配置。仓库常规test只生成原创PET4小fixture，不依赖外部路径。真实库运行单独记录，不能将合成fixture扩大为全部46动作验收。

验证：独立LZ4已知向量/边界负例；PET4头/offset/tag/keyframe/tile/CRC损坏拒绝；关键帧随机跳转/循环/不同片长；导入摘要匹配但格式坏拒绝；每设备decoder隔离、偏好切包/失败不覆盖actual、虚拟帧推进。运行npm check/test及真实库审计。回退停止本轮临时进程、移除忽略目录产物，不触碰现有服务/固件。
