# 服务装配、电源事件与会话回收 Spec（实施前）

状态：先行切片已于2026-10-30实施并在独立临时环境验证，见[报告](../../reports/2026-10-30-service-power-capacity.md)。下文保留执行前范围；没有生产部署、物理睡眠周期或设备接入。

2026-10-30。用户授权本切片评审、实现及独立临时验证。已读规则/当前上下文；不使用子智能体，保留并行动画工作。不接真实设备，不改固件/pet/bridge/现有DSH配置，不安装插件/系统服务，不提交推送。先明确边界与回退再执行。

## 现状与本轮范围

session-runtime已在fixture验证，尚未挂到服务选主；auth的256历史session为旧直接context入口防重放，但会限制长期重连。DSH安装产物是Electron主程序，插件/独立Node服务没有已确认可用的powerMonitor入口；不把renderer/window事件当OS事件。

本轮把会话owner以显式managedSessions review配置挂入现有startOrAttach，只在UDS bind成功后创建存储/owner/电源源；默认不装配。review必须deviceMode/source disabled，仍deviceTransport=false，无设备listener/新插件入口或旧配置迁移。构造现有服务代码的装配能力，不自动投入生产或开放LAN。

## 单实例与初始化

装配描述由显式bindingDirectory、controller、root SHA、manifest/policy及power源kind/identity生成，并纳入sourceKey。第二个调用只能attach，不能创建电源helper/存储写入者、替换owner或启用不同配置；loser不接触元数据文件。启动期间IPC拒绝半初始化访问，attach有界等待ready。

只打开已显式初始化的hub-bindings/1，create=false；缺失、旧格式、坏档/遗留锁拒绝，不自动注册/迁移。root为公开信任锚，私钥/证书正文/Keychain读取不包含本轮；profile配置不得从普通IPC/UI传入可执行factory。会话service_instance使用持锁的服务实例ID。UDS状态只加去敏counts/phase/power来源及错误分类，不输出凭据/路径/nonce/运行端口。

owner持有会话层、binding store及电源订阅；attached.close不能关闭它们。初始化失败清本实例descriptor/socket/子资源，不删除绑定文件；owner关闭先切断新准入、移除电源订阅、关会话资源，再释放UDS所有权。共享配置/pet来源/角色路径保持已有行为。

## 系统电源接入与验证边界

新增最小macOS C helper，使用本机SDK IORegisterForSystemPower/CFRunLoop；ready后仅输出hub-power/1有界NDJSON、uint64顺序号和ready/suspend/resume。CanSystemSleep/WillSleep必须IOAllowPowerChange，不veto、不改电源设置、不制造电源断言、不触发睡眠/唤醒。退出清IOKit/CF订阅；stdin EOF和SIGTERM有界退出。

Node source只执行显式私有可执行文件；无shell/自动编译/下载/重启。父进程拥有child、流、超时与disposer。ready前会话暂停；序号跳跃/倒退、坏schema/超长/EOF/异常退出均暂停并保持blocked。事件由单一owner串行处理，重复suspend/resume幂等，resume须通过会话层可信时间检查；关闭后迟到事件无效。真实API注册若受环境限制，记录失败，不用fixture替代成功。

本轮用现有Apple clang21.0.0及本机SDK在临时私有目录构建helper，记录工具版本/源摘要，不安装二进制。执行真实注册→ready→取消/关闭的只读验证，并用受控子进程事件验证会话失效与顺序。**不主动让用户电脑睡眠**；真实睡眠前送达、睡眠期间停钟及唤醒后网络事件顺序未经物理周期验证，不能据注册成功解除设备准入。Electron powerMonitor/Windows/Linux、发行签名与权限另行评审。

## 会话历史回收

保留旧直接context入口的默认256历史上限。managed owner改用不可序列化、绑定socket/context/generation的一次性session admission，只有同TLS未过期挑战确认才能兑换。auth建立会话时原子验证并消费该admission；不保存所有已用随机session ID。失效后旧proof/socket/admission/挑战均不能重新建立，活动集合≤16、挑战≤32、设备代数≤64、任务每会话≤8，close清所有本轮权威。

不能简单FIFO逐出历史ID后接受旧context，不能满时踢活跃会话。用超过256次真实TLS握手/hello/断连验证 managed路径持续可用且owned state回落；同时检查旧proof/旧挑战、不同socket及晚close。只验证该固定串行负载，不推导16设备并发容量、多日稳定或EPS吞吐。

## 检查、证据与回退

先专项验证：选主只创建一次owner/source，配置不匹配拒绝，初始化失败无残留，attach detach不影响owner，状态去敏；真实native注册/退出；受控power事件顺序/异常/关闭后回调、未知可信时间、真实TLS断开/重认证；≥300次managed重连与旧凭据/票据拒绝。记录固定样本耗时及状态上限，不把loopback耗时当1900ms命令预算或硬实时界限。运行check/test，必要的会话/TLS回归；不重复长测/真实素材/浏览器。

所有运行在自有临时目录/UDS/动态loopback与测试进程组。回退先停新请求并暂停owner、关闭电源流/helper并等待退出、移除订阅、关会话/TLS/UDS，再删本轮临时目录。只杀已知自有进程，不按端口查杀，不删除绑定/角色文件或改系统电源设置。默认模式和现有配置不变；撤回新增managed装配即可。完成后直接更新当前摘要/待办，按主题归档被替代片段；未实现门禁和物理验证不得写成已支持。
