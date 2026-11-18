# TCP-13 Spec（2026-11-05，实施前）

已读规则/当前摘要/TCP10–12及终端USB合同与工具实际单端口hold/boot/unknown语义。下一补可信私有配置文件和单消费会话生命周期；不重写USB握手/packet/状态机、不执行终端工具、不填真实凭据或生成真实用途决定。

新增低层createNative400PrivateConfigSession，输入显式private directory、已构造device RAM config、可信consumer {run,close}、signal/timeout/guard。严格复用现有RAM JSON约束（namespace/source manifest/raw role_index/四记录/endpoint/wifi），闭合根字段；仅用于私有文件交接，不自行授权或监听。caller可用原创合成config独立验证，不把此低层视为TCP12批准路径。

directory须已存在/current-user/0700类权限/绝对canonical无symlink，捕获身份。用固定wx600 lock原子排他，同目录只一会话，残锁/不同owner不自动回收。赢家创建随机0700子目录与wx+600配置文件，固定≤16KiB缓冲完整写入，consumer仅收到私有路径和AbortSignal，不从配置字段选择命令。无秘密摘要/日志或默认目录/产品CLI，原JSON字符串/调用方副本/OS和SSD不承诺完全擦除。

consumer为可信显式适配器：run({file,signal})只调用一次，返回queued/rejected/unknown；close()必须等待实际串口/子进程/其他I/O退出。返回queued只投影queued-not-connected-or-presented，不作LAN/accepted/首帧/cleanup设备证据。此轮consumer全为fake，真实串口adapter后续复用端侧工具且不自动查找端口/重试/复位。consumer对象在本进程只能被领取一次，未赢锁的竞争者不关闭赢家consumer；不同目录/进程全局互斥不作保证。

close/abort/期限/guard失效立即fence、发signal并至多调用一次consumer.close；正常run结束也必须等待close。run即使忽略abort仍占用私有文件/lock，必须run settle与consumer close都完成才能清理。旧回执/迟到queued不得覆盖取消前unknown；已确认queued的历史不会因后来取消冒称撤回。逻辑期限非硬I/O退出上界。guard同步有界，写前/交接前及短周期复检；无async guard或从文件注入依赖。

清理只处理本会话捕获的inode：确认parent/子目录/file/lock身份，覆盖自有文件可见字节并truncate、unlink、关闭自有fd、rmdir自有空目录，最后释放自有lock。不递归删目录、不跟随替换symlink/硬链，不删用户其他文件，不声称物理安全擦除。关闭/清理失败保留私有资源与lock、稳定cleanup_unknown；显式retryCleanup只在run实际退出后重试关闭/本地清理，绝不再次run或下发配置。ready原失败不改写成功。

新增TCP12内部opaque request→一次config+live guard的本地交接入口，WeakMap拒绝伪request；复用原实际owner/窗口门禁。guard绑定原owner网络epoch/实际端点和同次audit存活，异步文件准备期间到期/撤销/换epoch不能启动consumer，消费期间失效发取消。原公开deviceConfig仍保持，无source/endpoint/凭据进IPC。高层createNative400ReviewedConfigSession只接真实TCP12 request与该guard；真实LAN成功分支本轮不跑，不用fake request/owner绕过补成功。

测试：原创config/私有临时目录与fake消费者验证600/0700/完整内容、同目录wx竞争与单run、close等待run/实际consumer退出、abort/期限/guard与迟到回执、unknown不重试、关闭失败/清理失败保锁和手动cleanup、path替换/foreign文件不删除、非法配置与unsafe parent、无敏感状态/异常泄漏；真实审计/未启动UDS→高层门禁拒绝验证，无LAN/USB。先专项/隔离CLI，再check及单套test含build。

回退close并等消费和文件实际退出，仅清理自有资源；cleanup_unknown保lock检查，允许明确retryCleanup，不强抢残锁。高层request/service/audit仍需调用方分别关闭，host文件清理不表示设备stop/STA cleanup或回退完成。无真实材料批准/凭据读取、LAN/USB/STA/ESP、生产服务/DSH/pet/bridge/固件/素材/插件改变，无提交推送。新真实用途/index职责和fresh设备/资源窗口保持前置，STATE/媒体流/保存/V3后置。

实施状态：24专项/隔离CLI、check及含build单套1628通过；仅原创临时文件/fake consumer和高层未启动UDS拒绝，无LAN/USB/STA/ESP。真实adapter/service统一退出仍待。见[报告](../../reports/2026-11-05-tcp13.md)。
