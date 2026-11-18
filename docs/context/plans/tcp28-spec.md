# TCP28 Spec：有限hold运行器与退出装配（先写后实施，已完成）

2026-11-06。TCP27准备工具和runbook已完成，本片补此前未装配的45秒自动片段监管；只借用既有已授权shared client，不启动listener、不发权、不读取真实pet/设备。本仓库规则/固件只读/默认OFF/不改现有服务等边界保持，先离线验证。

## 范围与所有权

新增可信本地`createNative400PetHoldRun`运行层模块：显式enabled=true、client/base/expectedRevision、runMs默认45000（最大45000）、sourceMs默认60000、可信单调clock和timer；构造不启动。start一次性前置GET核shared/网络open/无既有desired/精确revision/page与lane独立余量（扣查询耗时）均>runMs+7500，以及独立sourceMs>runMs+7500，再创建唯一source/原A bridge并串行poll。开始计时取start调用前的单调时间，异步查询不延监管期限，不重建来源/授新权限。

借用client及外部NodeControlWindow，不拥有窗口、client、页面grant或共享组。close只fence并中止本次在途读/原bridge、尽力只撤自己的已确认目标、关闭自己source和timer；不end/revoke/pause/close其他窗口，不影响manual目标。window.close仍由可信外层在本窗口真正结束时独立负责。

45秒由独立deadline timer和每次poll/confirm边界时钟检查实施；迟到timer不能允许超期新读/命令。默认500ms串行poll。source失效/人工冲突/预算不足等原bridge停止则停轮询并关自己source；unknown冻结新读/命令，保留同一来源、原body及监管截止，只允许显式confirm。fresh确认ready可在原截止内恢复原轮询，不续任何来源/权限/旧目标TTL；stale确认按原bridge停止。到期/close终结本次运行，重复start不能重开。时钟回退失败关闭。

不修改core、wire、owner、旧bridge/source/权限channel、插件入口或准备工具。scope状态只含阶段/稳定reason/剩余监管期/资源与原桥过滤snapshot，不含地址/凭据/原响应，不冒称当前显示、完整SHA或设备准入。固定副本实际启动/运行身份和真机前置仍须可信外层提供，不接受JSON自授device_admission。

## 验证

独立原创HTTP/真实UDS/shared client/loopback端侧模型及虚拟时钟，覆盖默认OFF/构造无副作用、一次启动、52.5秒预算/查询耗时/三期限、长touch/保位续租、45秒到期与迟到timer、unknown原body确认/期限、不取消人工、source失败、在途close/late result、clock rollback、重复close/明确外层窗口保持。原event/B/true-false恢复回归保留。少量实际短墙钟计时器验证真实监管退出，非45秒ESP/网络最坏时延测量。check/test/两构建，更新上下文与归档被替代的“监管未装配”记录。

## 回退与准入

不调用新运行器即回原手动/event/A构造；close仅清自己持有资源，调用方随后明确关闭自己的外层窗口。无存储/wire/服务迁移。真实pet加载身份/自然迁移、fresh素材/用途/window、实际app/peer/动态资源/实屏和设备退出/精确恢复仍待；本片不接ESP、不启生产listener、不运行终端脚本或安装插件，cycle/mail无wire观测限制保持。

完成证据：[TCP28报告](../../reports/2026-11-06-tcp28.md)，24专项/1940全量、check及两候选构建通过；候选import 7模块与自身清理通过。未启动真实宿主或设备窗口。
