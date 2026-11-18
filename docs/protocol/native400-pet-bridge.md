# TCP21 pet→shared控制桥接

2026-11-06。API：`createNative400PetReader({context?,base?})`及`createNative400PetBridge({enabled=false,read,client,expectedRevision,ttlMs=5000,pollMs=500,timers?})`，模块在packages/runtime。均为可信本地装配，不是网页发权接口。

后续[TCP23](native400-pet-hold.md)增加显式mode=hold-state、opaque HTTP source/priority与真实lane limits；下文同counter不续期为默认event语义，继续保持。

reader只复用公开getState与显式loopback GET适配：page能力优先；缺方法且无显式HTTP来源为unsupported，getState返回null为pending；仅ready的state=null按原scheduler映射idle0。Node宿主不可跨容器假装取得页面Cordis服务，应显式选择HTTP只读adapter或以后经宿主认证的页面来源通道。本片未读取现有DSH/pet响应，不声称真实getState存在。

bridge必须使用已经独立来源/用途/窗口批准的shared scoped client及可信expectedRevision。每次新命令读controls，绑定实例/组/revision；通过原seq/request_id/CAS/ACK提交，不调用owner.base，不改变LAN source=disabled。不通过旧source/page路由自动写设备。thinking1/working11/idle0，4仅本地；result/success/waiting/error当前不可用，撤本桥目标回本地，不宣称43/58/7/55已缓存。

start显式开启串行poll，poll也可由可信调度器调用；同counter/state无副作用、不续TTL。倒退/同counter不同状态撤自己的目标并封锁来源代；须可信重建，不凭下一拍自动清高水位。pending/unsupported/unavailable/读异常撤自己的目标；非法ready阻塞；无法撤销时只依赖原TTL有限收敛。来源中断后同旧counter恢复不会重播，须新事件/可信新来源代。长时间相同working也不自动续期，产品长期租约另审。

expectedRevision防止自动桥抢占已有人工控制；人工修改、权限失效或服务/组换代使桥blocked。取消前核本桥command_id及共享desired，不取消他人的目标。unknown保完整原body、冻结新读/命令；仅显式confirm作原请求幂等确认，不重置TTL。确认旧组失败须可信重新授权/重建，不能自动改body。

close停止自己的timer、abort并等待读取退出、忽略晚值，尝试撤自己仍持有的目标；不end后台共享组。unknown不推测是否生效，保原TTL；权限丢失不自助续权。页面unmount不是后台桥close；source owner卸载负责close。snapshot只给phase/counter/pending/owns_target/timer，不含原pet响应/凭据。submitted不代表设备accepted/SHA/playing。

## 显式0.2.2候选与回退

先npm run build，再`node scripts/build-dsh022.mjs`生成忽略的dist-dsh022：主入口host-022、精确Cordis4.1.0/Schemastery3.19.0/WebServer及Connection0.2.2-rc.1/React18.3.1；单Connection client.js，无第二panel。旧dist/模板/rc.3 peer保持。默认入口仍只读，不自动装配resolve、bridge或启动服务；信任映射必须由新隔离profile的可信shim显式注入。

原TCP21动态方案（TCP22已执行Web路径，详情见后附报告）：新profile/home/runtime，不读现有账号/配置，来源disabled、设备关闭，单新候选；先核Config/slots/Connection加载/重载/卸载，再由独立可信操作授临时shared client、固定只读pet来源，观察filtered semantic/counter。不读cookie secret、不用Request.url推Origin、不发网页批准。先对原创pet HTTP走宿主链，再经具体授权读取真实pet变化；ESP窗口最后另行由终端负责。只停自有PID、撤自己grant、await bridge/request/audit退出；unknown留现场不重放。后续TCP22已获得新隔离profile授权并执行Web路径的加载/重挂/卸载、Connection及临时来源装配，见[报告](../reports/2026-11-06-tcp22.md)；真实pet只观察到空闲，Desktop scheme/真实状态迁移仍待。

回退close桥、停止自有新profile、删除自有候选/临时授权；不清他人组/改旧profile，旧包可继续保持。没有存储迁移、素材变更或固件操作。
