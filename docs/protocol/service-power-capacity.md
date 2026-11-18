# 单实例装配、电源源与managed会话回收

2026-10-30。生产代码的显式review装配已在独立临时环境验证；默认不启用、没有设备listener。依据[Spec](../context/plans/service-power-capacity-spec.md)/[Diff](../context/plans/service-power-capacity-diff.md)，证据见[报告](../reports/2026-10-30-service-power-capacity.md)。不等于正式部署、系统睡眠周期或ESP互操作完成。

## 选主与服务所有权

startOrAttach新增可选managedSessions，profile必须review，deviceMode/source均disabled。CLI和插件没有启用该配置的新增开关；调用方是受信程序装配代码，不能从UI/IPC反序列化factory/可执行路径。生产设备能力仍deviceTransport=false。

描述包含bindingDirectory、controller_id、rootDER摘要、manifest、policy及power源kind/identity，规范化后纳入sourceKey；函数、秘密、helper PID/运行端口不进入描述。不同字段插入顺序不改变身份；模式/信任锚/能力策略不同拒绝attach。不带managed选项时原sourceKey格式保持。

只有赢得UDS bind的owner才打开元数据、构造会话层与启动电源源。真实两进程竞争已验证只启动一个观察源；loser只attach，不运行其factory，不写元数据。附着方detach不关闭owner。managed service_instance_id与持锁服务instanceId一致。

打开既有hub-bindings/1使用create=false，缺失/旧格式/损坏/遗留锁拒绝，不自动注册、迁移或恢复。根证书只是公开信任锚；密钥/证书签发/Keychain和正式绑定审批没有接入。半初始化/停止中IPC返回503，managed attach使用单一5秒abort期限，不逐请求续期；挂起的已有UDS也不被回收或覆盖。

UDS status仅增加去敏sessions：profile/phase/error、power_kind、资源计数及device_listener=false，不含绑定指纹、文件路径、nonce、私钥或helper命令。插件/UI未新增会话写路由。默认/原simulation的业务契约保持。

关闭共享同一Promise：停止准入、关闭电源源及会话/存储，再清本实例descriptor、释放UDS。释放某一资源失败也继续其他清理，最终明确返回聚合错误；不吞错假成功，不删除绑定文件。初始化失败同样回滚自有资源，不触碰已有owner。

## macOS真实观察源

native/macos-power.c用IORegisterForSystemPower和CFRunLoop；先确认系统通知的IOAllowPowerChange，再向父进程输出WillSleep→suspend、HasPoweredOn/WillNotSleep→resume。CanSystemSleep只确认，不veto；不请求睡眠/唤醒，不建阻止休眠的assertion，不改电源设置。stdin EOF或SIGTERM退出，清IOKit端口与runloop source。

createMacOSPowerSource只执行显式私有二进制，校验目录/文件的私有权限与非symlink，二进制摘要作为源identity。没有shell/自动编译/下载/重启；测试才在私有临时目录调用现有clang构建，不写安装目录。未复用Electron主进程或pet私有helper。

子进程通过hub-power/1 NDJSON传protocol/type/uint64 seq：第一帧ready/0，后续严格递增，type仅suspend/resume；每帧≤512B、缓冲≤4096B、启动ready期限1500ms。坏schema/UTF-8/超长/序列/EOF/异常退出均使owner暂停并保持blocked；源已失效后不能靠迟到resume解冻，须重建owner/source。关闭停止读流，结束stdin、SIGTERM，并有500ms自有子进程终止后备，await退出。

owner在ready前暂停。有效suspend同步失效挑战/租约/在途工作、关闭认证socket；有效resume仍检查可信时间，且必须新TLS/hello/acquire。重复语义事件幂等，关闭后的回调无效。可信时间暂缺可在仍健康的源下一次resume重新检查；源损坏则不自动恢复。

本机已在真实服务owner内观察IOKit注册ready及退出。**没有让电脑实际睡眠/唤醒**：native确认与Node收包之间、唤醒事件与网络回调之间的物理先后未验；注册成功不能证明睡眠前已完成失效。这是正式deviceTransport仍关闭的原因之一。Electron powerMonitor不直接用于独立Node，其他OS/发行签名与真实周期仍待专项验证。

## 一次性admission与容量

旧直接context auth入口仍默认最多256历史session ID，用于防调用方重放。本轮没有FIFO丢弃历史再放行旧context。

managed owner在生成挑战时创建不可序列化admission，绑定当前socket、完整context与generation；confirm检查同TLS/凭据/5秒期限后，auth在建立会话前原子验证并消费此admission。未通过挑战、序列化票据、旧连接或旧代数不能兑换。重复已确认hello返回原ready，不再兑换或续租。

managed auth不保存所有过去随机ID，活动session仅由当前Map持有；admission仅与当前pending关联，取消/过期/关闭删除。活动auth≤16、pending≤32、设备代数/历史观测≤64、每会话任务≤8；失效/close清权威。320次串行真实TLS重连后，每次均确认session/pending/task回落0、remembered_sessions=0；新连接仍需新session，旧proof/context拒绝。

这是固定单设备串行回收验证，不是16设备并发/多日/RSS硬预算。逐4KiB授权复验保持；后续[承载负载验证](transport-load.md)已量化证书与同步元数据成本，并补控制队列的条件预算反例；当前[复验减量](verification-reduction.md)已在默认scoped实现静态缓存/逐次动态检查及同步revision视图，保留完整新scope坏盘检查。宿主warm样本不能替代物理最坏时延或1900ms/500ppm假设的准入依据，生产调度器仍未装配。

## 执行与回退

`node scripts/verify-service-power-capacity.mjs --output .cache/service-power-capacity/results.json`在macOS测试17项，含真实native注册、临时UDS、受控电源事件与320次TLS重连。只输出去敏用例、整轮观察耗时和清理状态；测试根使用短路径以满足既有UDS路径上限。正常/失败/取消均清自有进程组/临时根，不保存端口、证书正文或本机运行配置。

回退先停止新请求、暂停owner，关闭电源订阅/helper并等待退出，关闭会话与自有TLS/UDS后删除本轮临时目录。附着方不执行owner清理；有既有owner的启动失败不删它的socket/descriptor。没有正式配置/数据迁移，默认入口不变，撤回managed装配即可。真实睡眠周期、系统密钥/签名、生产LAN listener、ESP资源与v5/Flash门槛保持NO_GO_UNTIL_MEASURED。
