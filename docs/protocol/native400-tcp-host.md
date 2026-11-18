# TCP-07：单实例TCP审阅宿主与独立LAN profile边界

2026-11-05。[Spec](../context/plans/tcp07-spec.md)/[Diff](../context/plans/tcp07-diff.md)/[报告](../reports/2026-11-05-tcp07.md)。本片只运行自有临时UDS/loopback，不改变真实网络/设备/DSH。

## 分析结论与现实现

TCP05是PC源快照的offline-loopback用途，TCP06解决单peer/link epoch；两者不能代替共享服务所有权或真实设备批准。现新增tcpReview可信装配option，复用原startOrAttach的UDS bind选主，不新增第二套端口锁或服务发现。单实例范围是同一私有runtime目录，不保证不同目录之间全局互斥。

`prepareNative400TcpHost({binding,file,peerAddress,...})`不读文件：验证绑定opaque option、绝对规范路径、单IPv4与ack/tick/timeout范围；通过TCP05安全descriptor得到输入摘要。返回WeakMap opaque option，不能从JSON恢复。路径/peer只作为sourceKey哈希材料，descriptor无原文；源/peer/策略变化拒绝附着，不覆盖赢家配置。测试clock/timer/read hooks是可信注入，不进入产品配置或页面。

可信代码显式调用`startOrAttach({directory,tcpReview:option})`；directory必须明确，source/device模式disabled且其他review/material互斥。只有UDS赢家创建一个fresh PC源审阅任务，附着者无TCP句柄、不读源。IPC可在reading中响应；坏源只显示failed、不开TCP、不重试。审阅成功也不自动监听；只有赢家返回的`tcpReview`句柄可显式start/networkLink/base。监听保持127.0.0.1/port0，旧七消息/身份/租约/网络代数不变。

GET `/v1/status`新增可选tcpReview（profile=native400-tcp-host-view/1），独立core投影重建源阶段/审阅完成标记、listener/占用会话、link epoch/ready、已报告首帧的历史动作。current_display=unknown、verified=null、device_evidence=false。拒绝不兼容的设备证明/完整性/显示声明；稳定错误不带原输入。没有路径、端点、map/mapping SHA、批准正文或操作凭据。TCP模式拒绝全部其他IPC路由，包括旧config/source/page写入。未扩DSH代理/UI白名单；该slot仅内部IPC候选，不声称页面已挂载。

关闭服务先同步fence并close任务，等待实际reader/socket/timer退出，再删除descriptor和关闭UDS。不能用超时/Task取消代实际退出；附着者close不停止赢家。服务重开会新鲜审阅，不恢复旧listener、network up或目标。默认不提供tcpReview时原行为保持，默认CLI/插件没有新增启动开关。

## LAN profile独立评审（TCP07阶段设计）

后续[TCP08](native400-tcp-lan-profile.md)已实现独立限时transport profile；下表为TCP07阶段/旧offline宿主边界，LAN专用单实例宿主、真实用途及配置提供者仍未完成。

| 项目 | 独立LAN候选必须具备的输入/行为 | 当前边界 |
| --- | --- | --- |
| 用途与身份 | 真实角色独立用途决定；批准完整78原始index/manifest/N_boot/四文件F/bytes/frames及实际缓存来源；与终端本地Catalog核对 | 当前opaque binding只offline-loopback，不得改usage字符串或把PC map作为设备库存/凭据 |
| 地址与所有权 | 可信本地选择单个实际NIC IPv4与单peer，接口/路由变更同步fence；同一指定runtime赢家独占listener，附着者不启第二个 | 当前只有loopback/port0，未实现LAN监听option或实际NIC事件采集 |
| 准入与权限 | 新版本/profile显式可信准入；真实窗口授权/精确候选与回退材料，接口不能由网页/设备消息生成 | IP/nonce/controller ID/SHA非密码学认证。DSH自己的HTTP/IPC权限继续独立保留 |
| 生命周期 | 复用终端已完成STA Relay，可信调用者在STA启动前watch正确netif、独立arm批准身份；stop后等待owner实际关闭确认 | 没有真实watch/arm/STA初始化，unwatch仅异步请求，不是fd/显示/Flash退出证明 |
| 失败与资源 | 默认关闭、坏源/旧epoch/超期/资源失败关闭；独立测内部RAM/PSRAM/栈低水位、最坏排队/往返与实际首帧 | 静态DRAM+15216B与宿主loopback样本不保证联网余量/硬时延；不延TTL或降低校验 |
| 关闭与回退 | 先fence目标/连接并等待自有资源，再释放UDS；固件回退由独立任务按既有配套镜像/缓存执行 | 管理端本轮没有外部配置/设备/生产服务要恢复 |

下一入口是R0真实来源/用途决定及上述新LAN profile实施审查，随后按[TCP06窗口步骤](native400-tcp-network.md)准备真实STA/资源短窗。R1的共享服务所有权子范围本轮已实现，不等于整套LAN入口完成。真实数据输入/批准、LAN bind、STA初始化、同步设备关闭确认仍未实现；不重复终端Core/owner/Relay。STATE扩展、媒体流/保存/V3后置。

## 验证与回退

13项专项含同进程与两独立进程选主、不同sourceKey拒绝、默认slot、只读/隐私/坏snapshot、真实原创PC文件读取、显式loopback、附着者退出、等待忽略abort的reader退出再释放UDS、重开重读/不重放。均临时原创数据，未连接ESP或执行固件脚本。回退先close赢家并等资源清理，再销毁自己的临时根；省略tcpReview即原默认路径，无持久格式迁移、无生产配置、无安装/提交推送。
