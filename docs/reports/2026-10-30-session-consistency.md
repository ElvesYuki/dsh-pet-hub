# 绑定与会话一致性离线验证

2026-10-30。先补[Spec](../context/plans/session-consistency-spec.md)/[Diff](../context/plans/session-consistency-diff.md)，再在私有临时目录、虚拟时钟与真实loopback TLS中实施。协议/API见[契约](../protocol/session-consistency.md)。不接真实设备，不改固件/pet/bridge/DSH配置，不安装/启用插件、不提交推送；并行角色加载工作保留。

## 完成内容

- 单一hub-bindings/1元数据供Registry与TLS指纹查询共用；严格字段/大小/权限/摘要，uint64 CAS、写锁和file/目录fsync。不存在另一份managed批准表，普通Registry commit不能改凭据/撤销状态。
- session-runtime统一拥有auth、Registry、guard、挑战和在途票据；本地随机service_instance、hub随机session/挑战、同TLS两步hello、幂等confirm、新连接重新acquire。
- Registry受信invalidate不再依赖bound，当前绑定epoch变化会拒绝旧操作/controlled摘要；旧close不会清新会话，peer proof不能替换hello的boot/session。
- 撤销/轮换/断线/休眠统一失效，任务代数及期限拒绝旧结果；损坏磁盘不妨碍内存安全清理。断线保留最后actual，新会话当前actual未知，历史last_observed明确标为非当前。
- 休眠/恢复注入在host时钟不前进时也失效旧租约；无可信时间拒绝恢复，单调时钟回退自动暂停。没有实现OS电源事件或真实漂移检测。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| npm run check（仅.mjs语法） | 通过 |
| npm test（含候选构建） | 348/348通过 |
| 本轮专项 | 28/28：元数据8项＋会话/真实TLS20项，均包含在全套 |
| 旧loopback TLS回归 | 22/22通过 |
| SIM-01–30及补充 | 30/30＋4证据通过 |
| 双时钟回归 | 13/13通过 |
| 租约预算回归 | 11/11，768参数及2368速率边界检查通过 |
| 两个隔离CLI的SIGTERM取消 | 预期退出1、interrupted=true、passed=false、临时根已删除 |

全套348包含并行分层角色独立加载新增12项；本切片只新增28项，不把其他路线测试算作本轮新增。CLI复用验收用例，不是额外独立覆盖。无需重复未受影响的浏览器/真实素材全库/30分钟测量；本轮TLS资产仍是70001B原创合成字节，未导入/复制真实动画。

元数据8项覆盖共享视图、mapping-only适配、CAS与跨handle冲突、指纹唯一/坏schema、缺失/损坏/超长文件、权限与普通/悬空symlink、写前失败、rename后不确定、三个真实子进程崩溃切点。会话20项覆盖hub生成context、重复begin/confirm与准确5秒期限、跨TLS/错实例/自报身份、挑战期间轮换、持久撤销与任务/guard失效、旧凭据拒绝、新会话无旧租约、迟到close、休眠与可信时间、单调回退、8任务容量/期限/伪造票据、坏磁盘仍完成失效、提交未回执重启、服务实例更换、旧wire/hello proof拒绝、陈旧CAS无副作用及素材首块后休眠取消。

## 故障与恢复证据

| 切点 | 观察与结论 |
| --- | --- |
| rename前注入写失败 | 磁盘revision/state保持；当前设备冻结，auth/guard/任务已失效，不报成功 |
| rename后/目录sync后注入响应丢失 | 返回storage_commit_unknown；原实例不重试确认或重开准入；重开后核对operation_id/pending记录，继续拒绝旧身份 |
| 子进程在before_rename被SIGKILL | 遗留锁阻止重开；父进程证实已退出后清自有临时锁，旧bound记录可读，未提交请求没有被声称持久撤销 |
| 子进程在after_rename/after_sync被SIGKILL | 同样先fail closed；明确临时锁恢复后读取pending_revocation，旧凭据仍拒绝 |
| 活跃TLS期间文件损坏 | 认证查询失败触发内存失效，不再依赖Registry.summary读磁盘清理；最后观测保留 |
| 撤销/回退时socket已标closed、close事件尚未送达 | 收尾按自有集合await每个close，不能依据.closed提前跳过；资源计数归零 |

以上是宿主进程切点，不是物理断电或ESP Flash事务测试。file/目录fsync没有被外推为所有文件系统/硬件的掉电证明。遗留锁仅由测试父进程在已知自有子进程退出后删除，产品未实现自动删锁/坏档修复。

## 运行与回退

锁定Node24.14.1/npm11.11.0；Node内置crypto/OpenSSL3.5.5，临时PKI仍由本机LibreSSL3.3.6 CLI生成，无新增依赖。运行`node scripts/verify-session-consistency.mjs --output .cache/session-consistency/results.json`；回归和取消摘要也在同一Git忽略目录，不记录私钥、证书原文、session secret、端口、本机运行配置或原始设备状态。

正常fixture关闭断言listener=false、socket/Agent/request/timer/在途HTTP为0，协调器pending/session/task为0，auth关闭，PKI和元数据临时目录删除；两条CLI取消则由监督器终止整个自有POSIX进程组并确认临时根删除。所有本轮测试环境均已收尾，未启动正式服务/插件或外部设备。

回退先关闭协调器和本轮TLS资源，等待请求/socket/子进程关闭，再删本轮临时目录；没有旧格式自动迁移，无需还原任何外部配置。新代码与合成fixture MIT；没有复制上游代码、固件或动画。被替代的“待统一存储/hello/休眠失效”当前片段见[历史](../context/history/session-consistency-evolution.md)。

## 剩余门槛与下一入口

尚无真实配对/设备持久撤销确认、永久解绑/遗忘、系统密钥存储、OS休眠事件、生产服务选主装配、旧绑定迁移、ESP协议/可信时间/TLS内存峰值、物理时延/漂移或Flash事务。32挑战/16认证连接/256历史session与64设备是实现上限，不是满载或长时间容量验收；第256会话后的安全回收策略仍需生产准入前专项处理。跨进程元数据CAS不代表跨进程设备控制互斥。

下一先审查生产装配边界：把已验证owner挂到既有单实例服务、明确绑定记录/秘密引用及迁移、系统电源事件来源与重连容量回收，在独立profile/临时环境验证，不自动启用设备listener。随后对齐175C v5能力、控制/素材队列及Flash安装/激活/掉电模型。现有1900ms/500ppm仍为假设，设备NO_GO_UNTIL_MEASURED保持；任何真机/固件操作另行授权。
