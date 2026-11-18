# 管理端共同G0：400实际基线与契约差异

2026-11-03，[400-06 Spec/Diff](plans/native400-06-spec.md)、[报告/35文件SHA](../reports/2026-11-03-native400-06.md)、[决定D01–D09/时间预算](../protocol/native400-g0-review.md)、[固件交接C01–C12](plans/round-pet-g0-handoff.md)。本任务只读文件，外部报告与当前源码分别核定；联合G0/G1/G2未关闭。被替代的“USB窗口执行中/缓存仍360/下一调度”已[归档](history/native400-06-evolution.md)，400-05/旧尺寸有效证据保持。

| 项目 | 已实现/已核对 | 待实现/待共同确认 |
| --- | --- | --- |
| 目标/几何 | 400²/78/466屏center33；固件本地常用版6882已有实屏/触摸返回反馈 | 24fps未验收；360/旧尺寸成对备份，分层仍360 |
| 文件/时序 | compact78身份与既有18675帧/1019额外tag0证据沿用，42=118/其他241；未重读真实媒体 | 动作目录78不等于板上78；实际本地四对象0/4/1/11，无全库安装承诺 |
| 身份/许可 | 外部实际N_boot=a34d0c7b…/cache57ae06ed…已装；hub候选P52b2f6cb…/M094e69be…/N_offline dd0f19bf…保持 | 400-08已有独立批准/严格PC来源映射，仍不能直接替换review scope或当设备库存；真实A2用途批准/导入/设备协议采纳仍待 |
| 能力/工作集 | 400-02/03 schema3 frame_window及400-04/05临时TLS/actor/调度已离线完成；固件1MiB/三RGB/只读Catalog已部署报告 | 无正式hello/调度/local源/期限协商；persistent=null保持，无运行期400 writer |
| 完整性/首帧 | hub首遍全F/全CRC/index/RGB/extra→帧SHA重读→首帧；固件首用F、播放CRC/增量F已有报告 | 不可把首用F/预取F或USB Done当完整media verified/playing；双遍/7712B或新Flash可信链/渐进策略需定版 |
| 触摸/寿命/维护 | 400-05一latest/一touch/忽略重复/回有效base/原截止/周期proof/欠载已验；固件本地按下边沿去抖、回0/随机策略已有 | 重复点击可重启4、无远端base/租约；local无限循环/remote120秒、尾帧完整间隔/fallback需共同确认；未知源不造idle0 |
| 保存/库存 | 固件ROM成对安装并验证回退，4+1/28MiB几何复用；hub storage0未知/null | ROM部署不是远端saved。新writer/gate/root/unknown/淘汰/掉电恢复和当前session库存未实现 |
| 协议/IO/认证 | 原session/guard/CAS/A4逐块授权/实际退出与400-05单池真实loopback验证保持 | 400本地无Wi-Fi/HTTP/TLS，USB素材/cancel显式Reject；stop_feed/旧gen丢弃不证明物理IO退出，缺单TLS owner/时间/凭据证据 |
| 时间预算 | 当前read准入1610ms、renew严格>4510ms/6720提前触发，完整exchange/source/累计compute与170段原截止已有400-07宿主对照 | 完整gateway含多次exchange/flush，不等于单段1秒；最大首遍在接近段预算时已超120秒。原标量漏窗已实际复现并修正；计划fits只必要条件，仍无物理上界，不延TTL |
| 资源/驻留/回退 | 报告记6882+N_boot四对象留驻，90秒/1928帧全SHA/连续23.297fps/max889.076ms；无Wi-Fi资源门禁有报告 | 当前源码加四前缀2107136B及额外状态，不沿用6882预算；新源码构建/动态/TLS/24fps另交。回360必须成对app/cache，前2MiB/分区/服务保护 |

本轮不执行固件脚本、构建或测试，不发消息，不接设备/生产listener。314条本仓库源/fixture/工具SHA保持，check及含构建1126项通过，无新增行为/测试。400-07已补24专项/1150回归，400-08已补44专项/1194回归，下一400-09保存/可信重开/只读投影；正式协商与固件资源交付再独立推进，不重复既有承载优化。
