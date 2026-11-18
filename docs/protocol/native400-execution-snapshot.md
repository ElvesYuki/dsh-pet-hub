# TCP-15：显式执行文件快照

2026-11-05。[Spec](../context/plans/tcp15-spec.md)/[Diff](../context/plans/tcp15-diff.md)/[报告](../reports/2026-11-05-tcp15.md)。默认关闭，只供可信本地准备，不新增IPC/插件/服务启动路径。

TCP17范围收敛：[纯Node控制窗口](native400-node-control-window.md)为后续管理端启动方向，不要求Python。本文已有USB进程/通用快照或加载审计保留为显式可选开发能力；涉及Python/serial环境的历史下一入口不再是管理端默认前置，只有选择该外部工具时才单独核定。

后续[TCP16实际Node导入审计](native400-node-load-audit.md)复用内部lease，在新进程核实际解析source；原快照coverage仍只declared-inventory，不将其升级为完整运行闭包。

## 创建与证据范围

`createNative400ExecutionSnapshot({enabled,directory,roots,entries,runtime,beforeSeal?})`同步创建私有副本，返回真实当前进程capability。enabled必须true；directory为已存在700规范绝对目录。roots为1–8项`{label,directory,files:[{path,sha256}]}`；entries为1–2项`{role:'manager'|'consumer',root:label,path}`，role唯一且必须在清单。runtime为`{kind:'node'|'python',executable,sha256}`，解释器文件需单独预期SHA，kind仅调用者声明，不通过执行解释器探测版本。beforeSeal为受控同步测试/生命周期hook，不接外部文件配置，不得创建未报告异步资源。

文件清单由调用者先审阅和pin，工具不签发来源/许可批准或窗口授权。文件路径只ASCII相对段，不含隐藏段/点段/反斜线；来源普通current-user单链接、无组其他写。目录及文件无符号链接，文件O_NOFOLLOW/O_NONBLOCK读取并核fd/path前后指纹。最多2048文件、单个2MiB、合计32MiB；解释器最多128MiB、单链接、current-user或root/无组其他写，64KiB流式核SHA，**仅pin其文件，不复制或执行解释器**。

复制到新建自有私有子目录，用wx写入，文件400/目录500。封存前再次完整核对源SHA/指纹和解释器，避免复制时源混变；副本复核成功才返回capability。manifest闭合profile为`native400-execution-snapshot/1`，字段包含排序的roots/files路径/长度/SHA、entries及runtime文件摘要；SHA为roundPetCanonical UTF8的SHA256，不含源绝对路径/时间/端口/凭据，输入清单顺序不改变摘要。manifest不是许可或密码学认证。

coverage固定`declared-inventory-only`、runtime_closure_proven=false、device_evidence=false。**没有静态或动态依赖解析器**：相对/bare/动态导入、Python stdlib/serial/native依赖、系统动态库、外部命令和运行环境是否完备由额外审阅确定。文件只读权限不能抵抗恶意同用户换盘/篡改，前后复核不能证明中途换改再还原未发生。不能把此快照写成完整运行闭包已自动准入或精确历史窗口代码已重建。

Full verification uses synchronous bounded file I/O and hashing. This is an offline preparation candidate, not a measured live-control latency guarantee. Before integration, measure interpreter/inventory hashing cost outside the armed device window; do not extend TTL to hide it.

## 使用与关闭

| 入口 | 行为 |
| --- | --- |
| manifest() | 内存清单深拷贝，不信任caller修改或任意磁盘manifest |
| snapshot() | 仅摘要/数量/字节/coverage/关闭与lease状态，不含绝对路径 |
| entry(role) | 可信本地取副本路径，不导入/执行；关闭后拒绝 |
| verify() | 完整核精确库存、每文件SHA/长度/400及500目录、manifest和解释器pin；拒额外/缺失/符号链接/权限变化，无mtime快捷缓存 |
| close() | 同步fence新run，等待已有lease归零，再清理自有树；可重复，清理失败明确拒绝，可显式再试 |

源工作树封存后变化不使副本改变；verify只核副本与声明的解释器文件。没有从磁盘重开并自授权的API。失败清理只删本工具自有树，不删源或调用方目录。活动运行持有快照文件，不以删除文件替代进程/设备退出。

## 可选consumer装配

`createNative400SnapshotConsumer({snapshot,port,holdSeconds?,graceMs?})`必须是真capability，拒clone/duck typing和多余script/executable/guard字段。从副本consumer入口及解释器pin构造TCP14固定argv consumer；port明确传入，不发现/探测设备。没有consumer角色的manager-only快照不能用于USB consumer。

run至多一次，开始领取lease并完整verify；实际child与stdio close后再verify，才保留原queued结果。取消/close/复核失败返回unknown；公共outcome以装配层最终结果为准，底层queued_seen只是历史工具输出。公开execution_snapshot_verified只表示该次装配复核，不证明全部运行时依赖被覆盖、STA联网或设备显示。snapshot.close期间禁止新的运行，已有运行继续持有lease直到实际退出；调用方负责先关consumer/session，再await snapshot.close，未知退出不能抢删。

保持TCP14标准consumer与service单配置owner/退出屏障兼容，不自动将此候选塞入高层startReviewed，不更改LAN/source/授权/期限。真实工具的入口/依赖、解释器环境、素材用途和当次窗口仍需另外核定，本片不启动该路径。

## 离线入口与下一步

`node scripts/verify-native400-execution-snapshot.mjs --output .cache/<新路径>.json`只运行原创Node/合成Python字节的隔离测试。`node scripts/verify-native400-hub-snapshot.mjs --output .cache/<新路径>.json`固定枚举本仓库packages/apps/service下.mjs、两份公开wire JSON及明确包/许可文件，生成显式code-only清单，封存/复核后清理；输出wx，不覆盖旧证据。不搜索业务目录、凭据、素材或固件，不import副本模块或运行LAN服务。保守包含模拟/历史代码不等于它们实际被加载。

当前manager-only164文件验证是本仓库源码快照，原始Node fixture实际副本导入是独立宿主样本；均不等当前复合LAN路径或ESP验证。下一先对真实运行入口/全部外部依赖做清单审阅与环境/加载证明，并结合终端PMU启动验证，重新绑定当次peer和独立用途/窗口记录。任何设备操作另用具体授权方案和精确f553/分区/cache回退，STATE/媒体流/保存/V3不并入。

回退先close consumer/session并等实际退出，再close快照；未知退出继续持有，不自动重试配置或发设备stop。本片无生产目录迁移，不调用新API即保持TCP14原行为。
