# TCP-17 Spec：纯Node控制窗口启动装配（2026-11-05，实施前）

用户已明确管理端正式运行不要求Python；前面把固件USB工具环境审查排入主线扩大了范围，本片纠正该默认路径。先读规则/当前摘要、service/TCP09–16代码和终端最新状态。上游f553/af5b精确恢复及用户播放/触摸确认已过，20f4第三轮异常仍开放；终端只读，不进入设备窗口。

## 方案及范围

正式技术方向为共享React管理界面＋Node ESM单实例服务/核心适配＋LAN明文二进制TCP＋ESP C++。pet保持只读状态来源，不另听DSH会话。Python/serial只属于固件侧可选人工USB开发工具，不是管理端运行依赖、启动前置或待完成的发布门禁。既有默认关闭进程consumer/快照诊断保留兼容，不删除上游工具、不移植USB协议/增加serial依赖。

新增createNative400NodeControlWindow({enabled=false,directory,lanReview,signal?})：明确enabled=true、规范私有runtime目录和当前真实prepareNative400LanHost选项，拒绝伪对象及wifi/consumer/脚本/来源/任意服务参数。它只复用startOrAttach({directory,lanReview})，不另建单例/监听/调度/批准。准备option是可信本地来源/独立用途决定，不从文件自授权、不签发真实素材许可或设备库存。实际LAN成功路径/高层audit关联仍须独立窗口审阅，本片只用loopback-rehearsal合成身份与注入NIC。

startOrAttach已拥有UDS竞选、sourceKey、原TCP/配置owner退出屏障。只有赢家await lanReview.start({enabled:true})，动态port0/指定单地址保持；attached只获得角色/实例信息，没有start/base/网络控制权、不能停赢家。准备/启动不读取或生成设备配置，不自动networkLink/up；设备已联网及端点配置由外部准备，地址只能由本地赢家显式取出，不进公开view/Git。当前loopback验证无真实配网/设备。

## 生命周期与控制

返回task含ready/close/snapshot/resources和本地address/networkLink/base/reapply/cancel/pause/resume/tick。ready只表示本窗口赢家TCP已bind或只读附着完成，不是HELLO/设备在线/播放。方法在ready完成且为未关闭赢家才可调用；source/device disabled，不接真实pet/设备自动调度，无新IPC写路由。下发只支持remote0/1/11，物理4不变；返回只表示本地提交，不制造accepted/verified/playing/saved。snapshot使用既有publicNative400LanHostView，verified=null、current_display=unknown、frame0_history仅报文历史、device_evidence=false；模拟PRESENTED不能当ESP首帧。

networkLink epoch必须显式来自可信外部观察，旧epoch不变更；HELLO新会话、重连不自动重放、reapply仅剩余TTL、超时/错mapping/取消/本地触摸与过期继续由已有owner/model保证，不重写。BASE原截止不续期，不延TTL掩排队。

close/abort立即fence本地后续操作，并在已有service句柄时同步请求关闭；启动仍在途则等它完成后关闭实际资源，不漏迟到bind。关闭等ready收尾与service.close实际TCP/UDS退出，attached close仅退出自己。清理失败phase=cleanup_unknown、保留句柄供显式close重试，不自动抢UDS/重发动作；坏配置/不匹配不得覆盖原服务。禁止从wrapper raw异常/endpoint/原始配置泄露路径/凭据，错误为稳定node_control_*，底层未知退出不冒充资源归零。

## 验证及回退

原创合成4缓存身份/用途中间件，只在自有临时目录/127动态端口运行真实UDS/TCP，驱动HELLO/OPEN/BASE/ACK、独立模拟prepare/PRESENTED、取消/触摸/重连/旧回执/窗口期满与close。两实例或独立Node进程验证一个赢家，附着无权。PATH为空及不继承NODE_OPTIONS的原创子进程仍可启动服务/闭环/退出，证明没有Python/serial要求；不运行固件工具或读凭据。子进程fixture本身仅测试用途，不能作为真实许可/设备入口。

先专项/隔离CLI，npm run check与npm test含build，最终build。更新README/当前摘要/待办/G0，归档被替代Python主线前置，不抹除旧工具测试事实；API/报告区分本仓库Node/真实loopback与ESP待验。回退await本task.close核实际退出，再删自有临时目录；失败保现场、可明确手动再close，不自动发送设备stop或写配置。默认旧路径不变，无生产服务/profile/pet/bridge/插件或固件/分区/cache/素材更改、无提交推送。真实设备/STA/动态资源/最坏时延、产品USB/BLE、STATE/媒体流/保存/V3后置。

实施状态：21专项/独立CLI、check及含build全量1730/1730、最终build通过。纯Node窗口/真实loopback与空PATH进程已验，未接ESP或真实LAN。收尾只读终端新口径已接受当前帧率/流畅度，严格24fps不再作验收前置，素材时间信息和完整性/资源/退化检查保持。见[报告](../../reports/2026-11-05-tcp17.md)。
