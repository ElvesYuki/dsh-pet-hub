# TCP-13：私有配置文件与单消费会话

2026-11-05。[Spec](../context/plans/tcp13-spec.md)/[Diff](../context/plans/tcp13-diff.md)/[报告](../reports/2026-11-05-tcp13.md)。POSIX临时宿主候选，零新依赖。此片仅实现可信consumer调用方的生命周期，**未实现/运行真实串口或子进程consumer adapter**，不重写终端USB协议。

后续[TCP14](native400-config-process-owner.md)已新增进程consumer入口与LAN赢家统一退出屏障；本页“尚未接service/真实adapter”为TCP13当时边界。当前只执行原创Node进程，实际Python/串口和设备业务仍待。

## 两个显式入口

`createNative400PrivateConfigSession({directory,config,consumer,signal?,timeoutMs=10000,guard?,beforeConsume?,fault?})` 是低层文件/消费所有权工具，不授材料或网络用途。config必须是闭合native400-device-lan-ram/1，复用TCP10的N_boot/source manifest/raw role_index/四记录/端点/wifi校验。只允许显式绝对canonical路径、已存在的current-user私有目录；无默认路径、配置发现或自动启动。

`createNative400ReviewedConfigSession({request,owner,wifi,directory,consumer,...})` 是高层候选：仅接受TCP12真实WeakMap request，先领取原一次config与live guard，复用实际LAN赢家门禁。伪request/未启动owner在文件I/O前拒绝。guard在准备和消费阶段核同次audit、原owner端点/网络epoch与窗口，不能用caller guard覆盖。领取后原request已handed_off，即使本地文件准备失败也不自动重取/新建窗口。

TCP12新增内部beginNative400ReviewedConfigHandoff，TCP09新增本地HandoffGuard；原public deviceConfig和旧直接可信API不变。此层没有变成全局强制授权，也没有自动关闭调用方的request/service/audit。

## Consumer契约与权限

consumer为可信本地对象，只有两个方法：

| 方法 | 契约 |
| --- | --- |
| run({file,signal}) | 至多一次；读取私有文件，在同一消费/USB会话内工作，resolve值仅queued/rejected/unknown |
| close() | 可并行于run取消；resolve前必须等待实际串口/进程/自有I/O退出，而非仅发送关闭请求 |

调用方仅拿到临时路径/AbortSignal，配置不会选择命令或注入执行代码。模块不启动进程、打开USB、寻找设备、读取真实凭据文件或自动重试。未来真实adapter应复用终端既有USB工具的显式端口、boot/Ready/Queued/同端口hold/status/stop语义；当前fake consumer不证明这些真机契约。

本进程同一consumer对象最多领取一次，未拿锁的竞争者不关闭其他owner的consumer。单目录wx锁跨调用者排他，但本轮竞测是同进程实际文件系统；不同目录、进程重启后的全局USB独占仍由产品固定目录和真实adapter实现，不能据此宣称所有应用全局单实例。

## 文件、取消与退出顺序

1. 在私有parent以wx600创建固定config-session.lock，捕获inode；已有/残锁明确拒绝，不清旧档。
2. 赢家创建随机0700子目录与wx+600 config.json，完整写入≤16KiB JSON，擦除自有编码buffer。不存配置/凭据SHA、原始响应或日志，不覆盖caller其他文件。
3. 写前、异步准备后、run前核guard；消费期间每25ms复检。guard必须同步返回true，不接文件/IPC依赖，非硬实时保证。timeoutMs为1–120000ms逻辑失效期限。
4. close/abort/期限/guard失效立刻fence并发signal，至多一次调用consumer.close。即使close先resolve，只要run/hook还没实际返回，文件/fd/锁继续保持。
5. run结束且consumer.close确认退出后，核自有parent/dir/file身份，覆盖自有文件可见字节、truncate、unlink、关自有fd、rmdir自有空目录，最后关/删自有lock。只操作捕获inode，不递归删除、不跟随替换路径或删除foreign文件。

JS字符串、caller副本、Python/SDK/OS缓存及SSD历史块不保证擦除；上述是可见文件回收，不是物理安全擦除。未提供fsync/断电持久清除承诺。consumer应只读文件；路径/权限/硬链变化会阻止清理并保留所有权供明确检查。

任何consumer退出或文件清理不确定，phase=cleanup-unknown、保留尚有的私有资源/lock，不能释放后再重发。`retryCleanup()` 仅在run已settle后显式重试close/本地清理；已成功close不会重复调用，run永不重做。ready原失败仍是历史失败，不因资源后来清完改为成功。旧锁/进程崩溃后遗留不自动抢占。

## 结果、错误与资源

ready在消费和本地清理均完成后resolve安全snapshot；unknown/rejected也可表示生命周期结束，**不表示配置已生效**。失败reject稳定config_session_*，consumer原始异常正文/任意code/结果对象不外泄，snapshot不含路径、端点、摘要、凭据或原始回执。

| 字段 | 含义 |
| --- | --- |
| phase | preparing/consuming/closing/completed/cancelled/failed/cleanup-unknown/cleaned |
| outcome | not-started、unknown、rejected或queued-not-connected-or-presented |
| consumer_started/run_exited | 本模块是否调用run及其实际Promise是否结束 |
| consumer_exit_confirmed | 可信close契约已resolve，仅消费方宿主资源，不是设备STA清理 |
| storage_cleaned | 自有文件/fd/目录/锁已退出，不包括设备或物理擦除 |
| device_evidence/device_cleanup | 恒false／unknown |

取消先于迟到queued时忽略该结果，保unknown；已确认queued之后再取消则保queued历史，不冒称已撤回配置。queued不是LAN连接、动作accepted、SHA或frame0显示。close幂等并等待ready与资源，不自动执行retryCleanup；closed是本地fence，需结合run/exit/storage字段判断资源状态。

resources仅给file_descriptors/lock_held/staging_directory/consumer_running/consumer_exit_confirmed/timers/buffer_retained。beforeConsume/fault为内部测试钩子，不是用户配置；测试覆盖ignore-abort与关闭故障，不将Promise模型当硬I/O退出上界。

## 验证、剩余与回退

24专项使用原创synthetic config、真实私有fd/文件权限/锁与fake consumer，覆盖正常/unknown/rejected、单次run/竞锁、取消/超期/guard、迟到queued、清理失败/手动重试、symlink与lock换inode不删foreign、稳定异常及秘密投影。另有真实原创audit→TCP12→未启动UDS owner的高层拒绝；高层LAN成功config/guard跨epoch仍未执行，不用fake request补成功。

本轮没有真实USB/串口进程、Wi-Fi文件读取、LAN bind/ESP或新用途批准。终端现有工具/固件只读，未执行其脚本。真实用途与index职责仍待独立确认；历史来源与f553/未部署station、资源/400@24限制不变。

下一接真实consumer adapter的显式启动/安全结果转换（先fake串口/子进程），并把会话纳入服务整体退出编排。本片**尚未接service.close屏障**：caller须先等待session退出，再按原规则关服务/request/audit；session的私有锁不等于UDS或设备已退出。真实串口/STA cleanup与fresh备份/回退需独立授权窗口。

回退close并等run/consumer和本地资源，cleanup-unknown保锁检查或显式retryCleanup，不强抢/重跑；仅清自有临时资源。省略新API仍TCP12/10/09，旧wire/service/owner和现有配置未迁移。STATE/媒体流/保存/V3后置，不安装插件或提交推送。
