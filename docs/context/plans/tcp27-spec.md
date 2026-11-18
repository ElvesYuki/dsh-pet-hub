# TCP27 Spec：有限自动hold窗口准备（先写后实施，已完成）

2026-11-06。TCP26保位语义/oracle和1909回归已通过；终端最新current-status仍为保位station未部署、原f553/af5b驻留。其“待管理端采纳”是旧读取快照，不重做TCP26。用户本次继续授权准备管理端后续；本片不操作ESP/USB、不启动控制listener、不安装插件/改profile，不运行固件脚本、不读真实pet/凭据。

## 交付范围

1. 新增纯准备CLI，固定引用TCP26结构化源码/候选pins，前后核原六模块及实际核心/bridge/source/channel/owner候选文件。复用TCP15 execution snapshot和TCP16 Node import audit，在自有临时只读副本中加载候选pet-bridge模块并确认export；不调用bridge/startOrAttach/窗口/issuer，也不审计现有DSH运行进程。声明清单和实际加载范围分别输出，不冒充完整执行闭包。
2. 输出仅含SHA/版本/过滤计数和未覆盖项的准备材料，explicit .cache新文件、失败不覆盖。无endpoint/SSID/令牌/原响应；没有启用flag或返回运行权限。固定标记device_admission=false，真实pet加载身份/自然迁移、fresh素材用途批准、实际app回读/peer、动态资源/实屏、设备退出/恢复证据为待验。
3. 写具体有限窗口与回退清单：管理端/终端责任、前置实证、从完整性audits到shared/source/bridge的现有API、开始/停止顺序、有限三期限、同目标保位/触摸/手动CAS/unknown/重连验收与未发生项。不得自动续权/延TTL/重试设备窗口，运行仍需终端独立安排。
4. 核对最新终端源码/manifest/镜像指纹仅只读；保留原rollback、既有服务和所有用户修改。复用工具而非新增生产broker/transport或全事件投影。

## 验证

新增准备工具的集成正负例：实际候选副本import-only、前后pins/实际退出、源码或候选漂移/缺失、未知参数/既有输出、失败不覆盖。临时fixture不复制凭据或素材；只复制代码与固定测试证据。npm run check/npm test及两候选构建。真实只读准备结果只对本次文件/Node副本有效，不是实际DSH、设备加载身份或未来启动凭证。

## 回退

删除自己新准备产物/临时副本；close audit等待子进程/stdio和snapshot lease实际退出再删自有目录。准备不触及服务/设备，无配置或wire迁移。有限窗口另案失败先关闭自身bridge/source/owner，终端负责设备stop/STA退出和精确只app恢复/保护/人眼确认；不能以host退出代替端侧退出。只有通过具体现场准入才进入真实窗口，本轮交付可审阅方案而非询问抽象权限。

完成证据：[TCP27报告](../../reports/2026-11-06-tcp27.md)，7专项/全量1916、check及两候选build通过；实际候选副本import 6模块、清理通过。现场窗口未执行、准备不能准入设备。
