# A7 会话命名空间与回滚维护 Spec（实现前）

2026-10-30。继A6继续，已读规则/当前上下文、actor/executor/观察/承载/装配实际代码。保留修改、不用子智能体；独立临时UDS/PKI/loopback、原创PET4/逻辑Flash/虚拟双时钟，不访问固件/设备/pet/bridge/DSH，不开生产listener/安装插件/提交推送。

## 决定及范围

1. wire目标身份为完整context七字段＋command_id/revision；revision只在该会话内单调。A1新增受信beginSession(context)切换命名空间：同context幂等，新的已认证context清旧work/load/frame/save/read lease与RAM、重置revision，保留root/对象和最后有效画面held_last_valid；不reboot、不重扫/重写Flash。它不是认证入口，旧context的接纳仍由现有session/socket权威决定。异常/未知Flash不因切换而变healthy。
2. simulator open调用该入口；传输回调携带捕获的完整context，旧异步请求不能借当前全局peer注入。load/frame opaque票据继续失效。新会话不重放意图/首帧/saved，需新hello/acquire/库存；新owner同manual_1也不会与旧actor work碰撞。
3. A3新增严格root检查点候选：绑定(device_id,binding_id,binding_epoch)、N、已确认floor、最后完整根与尚未查询提交的对象身份（floor_commit）。saved可推进floor但未查询的新根不能伪造完整库存。恢复后库存仍unknown；新认证查询低于floor/同seq内容冲突拒绝。跨binding不能继承旧检查点，不能通过换service/boot/session清低floor。
4. A4/A5仅增加内部显式checkpoint传入/导出，进入UDS配置匹配；无页面导入/清floor/覆盖配置方法。测试caller把检查点存自有临时文件再交给新owner，验证真实服务重启时有效。**不实现生产自动持久化、跨进程防回滚存储或新信任批准**；有效旧文件回放无法靠schema检测，生产仍需权威CAS/耐久/防回滚专项。
5. 低root或同根冲突失败关闭，保留原floor/历史事实，显示稳定原因。维护决定仅为评审：保全故障证据、只读核对介质/身份、由固件恢复已批准的相同或更高根，或明确撤销旧binding后重新建立信任；均需独立方案/授权/G0，不提供“接受较低根”按钮或自动rebind/格式化。
6. deferred非提交确认。显式比较cancel先于commit、commit先于cancel、marker结果未知后的cancel与断线；不能撤销已发生root事实，不能把unknown取消成未保存。模型同步切点不证明ESP互斥、维护让出或最坏耗时。

## 模块、测试与回退

局部改core/native360-device、root-checkpoint纯验证/维护评审、RoundPetObservations检查点；runtime pull/assembly内部装配及错误保留；simulator executor/context防迟到；临时lab支持不重启设备的hub重启和检查点保存。保持旧默认/公开wire/schema、零新依赖；旧无检查点用法保留但不宣称跨owner高水位持久。

专项覆盖同会话幂等/新会话低revision/旧票据、RAM与Flash/画面、不重启真实TLS重连及新service_instance_id、saved先于查询的floor、低root/同seq冲突/错误binding/坏检查点/大uint64、配置attach匹配、默认OFF、维护不降floor、deferred取消/提交/未知竞态、初始化/关闭/正常与SIGTERM清理。先小范围排错，最终npm run check与npm test保持634基线，独立CLI仅监督自有进程组。

回退关闭自有peer/server、服务owner和模型，等真实I/O/worker/pin退出后删除临时PKI/检查点；撤回显式checkpoint选项即可，默认无生产listener/磁盘迁移。生产自动checkpoint、真实46包/许可、Node/C++共同向量、固件接受C04/C07/C08/C12、G1/G2和设备窗口均未关闭，不改V2 N/前瞻/a7。

实施状态（2026-10-30）：本Spec/Diff先于代码建立；24专项、658全套及独立CLI正常/中断清理通过，见[报告](../../reports/2026-10-30-round-pet-a7.md)和[API](../../protocol/round-pet-a7.md)。被替代摘要已[归档](../history/round-pet-a7-evolution.md)。生产权威持久化/防回滚、共同wire/真实包及G1/G2/实体窗口仍未关闭。
