# TCP-14 Spec（2026-11-05，实施前）

已读规则/当前摘要/TCP13及service实际退出流程，终端最新职责合同/真实有限窗口报告和USB工具。终端已实际Ready/Queued/STA/DHCP及清理，但因旧精确peer不符未OPEN；第二窗PMU只读识别失败后恢复f553。raw index可信本地责任已明确，不再列合同未答复；不把上游实测写成本仓库运行或TCP业务通过。

本片实现显式子进程consumer入口和LAN服务退出屏障。绝不运行固件工具/设备脚本：只用本仓库原创Node fixture作真实临时子进程，验证与现USB工具相同的安全JSON输出和固定参数接口，无serial依赖、网络或设备操作。

新createNative400UsbProcessConsumer需enabled=true、明确绝对executable/script、独立scriptSha256、精确port和holdSeconds（≤120）。run时只读核入口script普通current-user/nlink1/无组其他写与SHA/前后指纹；这不是完整导入闭包/解释器冻结，真实窗口须另冻当前全部代码，不能沿旧6882或前后两SHA反推执行版本。spawn用固定argv/shell=false，无命令字符串、端口扫描/凭据argv/重试。仅传私有config文件；不读取或hash其秘密正文，不执行外部脚本。

输出严格有界：只接现工具queued/status/failed JSON（重复键/额外字段/坏UTF8/截断拒绝），stdout总128KiB/行2KiB、stderr16KiB只计数不记录。queued最多一次，status须在queued后且phase0–6/clean bool；process最终exit0且输出有效且未取消才返回queued，其余unknown。queued_seen只历史工具报告，不当device evidence/联网/ACK/首帧或STA清理。raw输出/异常/路径不进公开错误/状态。

run只一次；close/abort发SIGTERM，宽限后SIGKILL自有POSIX进程组，等待直接child与stdio close事件，不以exit/kill返回当退出。先close禁止后来spawn，清理所有自有timer/listener；不宣称杀死脱管后代或设备STA已退出。脚本必须不派生脱管任务。仅入口pin及观测指纹，不抵抗恶意同用户换盘；固定环境不继承PYTHONPATH等注入配置，禁Python字节码写。

TCP13新增内部真实session控制注册/领取，保留捕获的原ready/close/resources/snapshot，public方法替换不能伪造退出；一个session只能被一个owner领取。新config owner支持受控同步factory的预留和显式adopt，单活/一个pending，先登记reservation再创建文件资源；fence拒绝新任务并取消已有，等待pending注册完后再关，不漏close竞态。普通失败若资源已真实归零可回收容量；cleanup_unknown保持所有权，不自动retryCleanup或run。显式手动修复后服务close可重试。

仅UDS LAN赢家装配config owner，返回本地lanConfig {adopt,startReviewed,resources}，attached无句柄、IPC不新增写路由/敏感状态。adopt是可信本地移交已有TCP13任务，不发放素材或USB授权；正向offline屏障测试采用此组件边界，不绕过高层LAN gate。startReviewed由service提供真lanOwner和TCP12 request构造TCP13任务，caller不能换owner/config/guard。

service.close同步fence TCP与config owner，再等待两者实际退出及配置文件/lock/fd/timer/consumer状态；有失败保UDS/503，不删descriptor或让别进程抢占，不自动重发配置。pending构造/挂起run或close时均持UDS；附着close无权停赢家。只在全部归零后执行原服务清理。默认无LAN模式不创建此owner，旧source/transport/wire/TTL保持。

专项：真实原创child JSON/退出/流未关/取消/信号升级/入口pin/输出坏例/未spawn/单run/无泄漏，TCP13文件与实际子进程组合；config owner pending登记/fence/容量/双领/坏snapshot、service真实UDS持有到退出/cleanup失败手动恢复/附着无权。高层genuine LAN成功分支仍不执行。先专项/隔离CLI，再check及单套test含build；更新摘要与G0、归档旧未有USB/STA/索引职责措辞。

回退先fence并await consumer/session/TCP实际退出，unknown保stage lock与UDS，不强抢/重试设备命令。子进程退出不代device stop/cleanup_complete；真机回退仍由设备任务负责。新入口默认关闭，无产品CLI/插件/现有服务/profile改变，无真实凭据/用途批准/新备份/ESP/烧录，不运行固件脚本，不提交推送。后续先处理终端稳定启动证据/当次peer、独立真实用途装配与导入闭包冻结，再按授权做TCP OPEN/ACK/PRESENTED/取消/资源短窗；不盲刷或扩白名单。

收尾修复（已实施复验）：第二次全量遇到既有wall-memory smoke的incomplete_window。定时器可能在小数毫秒截止前返回；每个采样tick已改为单调时钟循环等待真实截止，不放宽窗口/间隔门槛，不重试测量或伪造时间。既有墙钟真实IPC专项3/3通过，最终顺序check/test及build通过。

实施状态：28专项/隔离CLI、墙钟专项3/3、最终check与含build全量1656通过；三次顺序全量包含一次旧墙钟边界失败及修复，详见报告。仅原创Node进程/临时文件/UDS，本轮未运行终端Python/USB/STA/ESP。上游部分真机证据独立记账。见[报告](../../reports/2026-11-05-tcp14.md)。
