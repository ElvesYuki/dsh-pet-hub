# 400-10 Spec：独立临时宿主的来源审阅status装配

2026-11-03，先行设计已按范围完成离线实现，见[报告](../../reports/2026-11-03-native400-10.md)。依赖[400-09](../../protocol/native400-source-review-storage.md)。已核AGENTS/README/context/规则及service选主、IPC、宿主代理和共享槽。保留已有修改，不用子智能体；仅原创临时文件/私有UDS/临时动态loopback宿主代理，不读取真实素材/cache/固件/备份，不接设备或启生产listener，不安装插件/烧录/提交推送，不改现有服务或配置。新代码MIT，零新依赖。

## 装配与信任边界

- 复用startOrAttach的bind选主、鉴权客户端、sourceKey及ready/close，不另建服务/鉴权/重试体系。新增仅内部代码可传入的sourceReview选项，须显式目录，source/device disabled，禁止并存simulation/managed/observation/assembly/material模式。
- 新runtime准备入口验证并快照candidate/catalog与两份独立批准，canonical摘要作为选主身份。返回本实例模块识别的不可序列化选项；不接受任意id/create或从账本自授权。固定profile/version与createJournal策略入身份，同目录批准内容/用途不同拒绝attach。
- 准备入口不读盘、不打开账本/源。仅UDS赢家在服务私有目录固定子目录创建或打开400-09 owner；目录需private，无自动修复。createJournal默认false，缺档不自动建。显式true才创建新journal目录/账本，坏档/残锁仍拒绝，保留原字节。
- sourceReview不选择或扫描源文件，不自动review/revalidate。重启只有历史；赢家返回内部owner供调用者显式操作，attach者只有client/无owner。attach/detach或卸载代理不取消、关闭或重复创建赢家owner。
- 在途初始化/退出status503；attach遵循已有5秒总期限与单IPC超时，不回收未知socket/descriptor。赢家初始化失败清自有资源/socket/descriptor，留账本，不修复/覆盖旧数据。

## 只读状态与生命周期

服务仅GET /v1/status输出publicNative400SourceReviewView重建的sourceReview；该模式其余IPC路由（含旧config/source写入）404，无新页面写路由。生产默认参数无该slot。代理复用GET /dsh-pet-hub/status，将sourceReview再次白名单校验，丢弃私有扩展；坏值失败关闭，不回旧current，不泄露路径/批准原文/凭据。

沿用共享UI槽显示empty/history/reviewing/current/failed/cancelled/uncertain，设备通道false、devices=[]、无actual/saved/库存确认。JS宿主经真实UDS→临时HTTP代理→构建候选读取和渲染；不声称真实浏览器/DSH加载或设备验收。

退出先标closed/ready=false，调用owner.close立即fence并等实际reader/hook/fd退出，完成后才删除自有descriptor并释放UDS；忽略abort的I/O未退出时不得让新owner提前接管。close幂等，旧结果不能提交/发布；unknown owner不能原地恢复，需close/reopen历史再独立复验。取消代理请求/卸载只取消自身IPC，不影响共享审阅任务。

## 验证

原创28MiB sparse fixture实际reader：save/current→close→reopen historical→显式revalidate；status不启动读/不变revision，审批错/坏档/锁/权限保留拒绝。单进程与双进程选主，赢家一份owner，身份错/默认模式互斥、半启动503、attach总期限、退出持UDS到实际fd退出；取消/unknown/源坏后代理和UI不误报current；HTTP和IPC写入口拒绝，页面卸载不关服务，旧client代数/新实例拒绝。覆盖代理私有字段剥离、畸形值拒绝、构建候选真实status读取及unmount取消自身请求。

先专项/独立临时CLI，再npm run check（语法）与npm test（含构建）；仅新失败/改动才重跑。保持400-03固定字节、400-07预算、400-08reader/400-09journal/manager及旧尺寸。

## 回退与未覆盖

本候选不接CLI参数/插件config，无自动安装/启动。先卸载临时代理并close赢家，等实际退出后归档自有目录；保留源和journal，unknown/残锁不自动删，不能强占旧socket。撤回新装配分支可回400-09内部owner，无格式迁移或外部配置恢复。固件/真实素材用途/G0/Flash writer/可信时间凭据/TLS/G1-G2/24fps仍待共同确认；外部状态继续400-06快照。本轮不扩生产生命周期、真实DSH/browser或物理断电保证。
