# 备份与回退基线：1.75C-EN／原生360

2026-11-02目标替代说明：用户已确认管理端后续主线对齐[400×400／78动作](native400-baseline.md)。本页保留360已验实现/媒体/驻留引用与回退，不能再将本页“首闭环计划”作为当前新开发入口；分层360不迁移。当前[共同G0](plans/round-pet-g0-handoff.md)、[Spec/Diff](plans/native400-manager-alignment-spec.md)列新400缺口，本轮不改旧代码/协议/设备缓存。下文是360兼容范围及既有证据。

2026-11-02共同G0只读核定快照。固件docs/context/current-status.md及最新compact78报告是外部依据；本页不是本任务读Flash/串口结果。见[对齐表](round-pet-hub-baseline-alignment.md)、[本轮报告](../reports/2026-11-02-round-pet-g0-closure-review.md)、[旧引用归档](history/round-pet-g0-closure-review-evolution.md)。

| 项目 | 当前引用与验证范围 |
| --- | --- |
| 目标 | 一块ESP32-S3-Touch-AMOLED-1.75C-EN；旧128/240仅历史兼容，不改它 |
| 兼容基线引用（前次窗口结束） | 最新400窗口已关闭，原cbdf3169…有效应用1318752B/整个2MiB原字节恢复，system/28MiB缓存一致；启动前32MiB归档7a4fb43b…与窗口前相同，随后原id0启动8秒、串口释放。未切67，启动后未再全片读；本任务未新读设备或处置服务 |
| 已验播放基线/恢复目标 | 前瞻应用SHA256 67e1af88f9f5d933ca9a9da08e2e5c64e5e74d4cc075fa99d0e8aa6a7faa4100，1320048B；P1/P2与TIMING，P3三配置各600秒及用户实屏通过；不是此刻驻留或完整联网维护／发布／8小时验收 |
| 精确回退报告 | a7d1c0541f9c392462b7ae35c06c88711f0dea74c0052e3e855383a2c771f879，1300512B；当前源码不能重建后冒充a7。旧a2625a整片含2c，不是当前前瞻＋缓存的快照 |
| 几何／素材 | 466×466屏，360×360 PET4 center(53,53)，24fps／241帧、flag1/key12/tile20；当前固定角色46个原编号动作，PC库225509627B。通用parser范围不放宽生产约束 |
| 存储 | 32MiB Flash／8MiB OPI PSRAM，既有2MiB应用＋28MiB V2素材区；4活跃root引用＋1暂存，当前缓存动作0/4/1/11，0/4保护、1/11可轮换。不是4个RAM槽，也不能全库离线 |
| 工作集／内存 | 单encoded最大5865472B，三RGB＋history等907200B，FAST read-ahead65536B；P2显式PSRAM6916777B／系统前余1471831B。P3最低PSRAM空闲1404660B、最大块1376256B、内部59035B、main栈2376B，均非TLS峰值／可分配上界 |
| 性能报告 | 正常点击23.73源FPS，恢复约24；同代最大70.47ms、跨代118.02ms，未承诺严格24fps／面板FPS或无停顿。网络关联及旧服务失败重试存在，不是成功联网维护 |
| 当前网络代码 | 旧v5 HTTP Bearer／整文件下载／played/touch；不支持新hub完整context/lease/mTLS或saved线上确认。现行control与loader可分别发请求，不符合新单TLS owner设计 |
| 首闭环计划 | 首窗口设计选远端0/11＋physical4，remote4暂禁；R2已验显式离线gate与内部选项，真实UI/固件适配未实施；再未缓存／保存／淘汰／重连。G0 wire/批准未关闭，G1完整维护和G2 TLS/可信时间/秘密／取消资源待验，真实通道仍关闭 |
| 回退边界 | 保留前瞻和a7，恢复前另核设备身份／表／双根／当时备份；应用回退不自动撤销新凭据或还原NVS／素材。不改分区、namespace，不自动擦Flash |

来源根：/Users/elves/myproject/ai-embedded-studio/ai-embedded-studio。本轮核对current-status、指定三份规划、既有G0回复/输入、设备目录后的Store/播放器/策略/HTTP与媒体导出源码；当前读取HEAD9816317…，不代替dirty文件或部署身份。本轮38证据SHA见[摘要](../protocol/vectors/round-pet-g0-closure-review-v1.json)，原P2/P3指标仅沿用对应历史证据。采样期间上游matrix/todos变化已重读，新增400可靠ACK/短锁仅宿主候选未部署，不改变本正式路径或G1/G2结论。

G1轻量fc55曾联网60秒通过，但缓存挥手后SDK历史低水位46527B＜48KiB，素材下载/保存尝试0；A/B仅A准入/待机，完整维护未过。最新400结束恢复原cbdf不补齐G1；400无Wi-Fi高内存余量不作TLS准入。正式46文件F/长度与P/M/N/source本轮重核保持；旧11086帧全CRC/index与源blob证据沿R1，未重复解码/源视频读取。ZipZipPipe原声明/CC官方条款本轮已直接核验，非商业/署名/SA明确；内部offline-validation approval与真实A2导入仍未执行。400/78与分层候选不改变本正式目标。

旧docs/protocol/transport-budget.json及预算脚本本轮未改，里面6851241B等是历史输入，少65536B read-ahead，不代表本页新前瞻资源准入。旧140KiB预握手／32KiB余量只作历史假设；当前保留固件内部≥48KiB、PSRAM≥1MiB／最大块≥512KiB、main栈≥1KiB，TLS最大连续块和新任务栈待G2定版。不能单算术通过或延TTL掩盖未知资源／排队。

本轮只改文档／原创摘要向量并跑既有宿主回归，不构建或运行固件、连接／烧录设备、启动生产listener、安装插件或修改DSH/pet/bridge配置。
