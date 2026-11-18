# TCP-15 Spec：显式执行文件快照与复核（2026-11-05，实施前）

TCP14已提供入口脚本pin/实际进程退出与服务屏障。上一设备窗管理端并行变化，入口或前后SHA不能重建实际加载闭包。本片只做离线准备，终端只读；当前f553正常、PMU20f4/e2a6仅宿主/构建，真实启动及TCP业务不在本片。先读规则、当前摘要、service/TCP12–14及终端最新交接。

## 范围与不变量

提供默认关闭的runtime执行快照工具：可信调用方显式提交有独立预期SHA的文件清单、根标签、manager/consumer入口和解释器文件pin。runtime API无递归自动搜集业务目录；独立code-only CLI仅枚举固定packages/apps/service中的.mjs及两份公开wire JSON和明确包/许可文件、无读取凭据/素材/当前运行配置；不运行Python、import上游或自动装配LAN。调用方负责清单审阅及上游复制许可。本轮只复制本仓库原创代码与合成fixture，不复制终端工具或依赖。

每个源根为规范绝对目录、实际无符号链接；路径为不含隐藏段/点段/反斜线的相对文件名。源文件普通/current-user/单链接/无组其他写，O_NOFOLLOW/O_NONBLOCK、逐组件及fd/path指纹，核独立SHA。最多2048文件/单文件2MiB/总32MiB；解释器普通文件单独流式核SHA，最多128MiB、不复制、不执行。显式rootlabel与入口只引用清单，不使用PATH/动态安装。不能把解释器文件pin当其stdlib/site-packages/dyld及环境全部冻结。

目标必须已有私有700目录；创建自有700子目录，文件wx/600，核复制字节后文件400、目录500。先完整源清单二次核对，再发布闭合版本manifest（只标签/相对路径/长度/SHA和运行文件摘要，无源绝对路径/凭据）。顺序清单稳定排序；同内容异输入顺序得同manifest摘要。失败只删自有临时树，不动调用者文件；清理失败明确报错、不假成功。无重开任意磁盘manifest的信任接口。

真实capability封装verify/entry/关闭，verify检查精确目录库存、权限、文件内容及manifest/解释器pin；漏文件/额外文件/符号链接/改写失败关闭，不靠mtime跳过SHA。原工作树在封存后变化不改变快照；snapshot.verify不是source未变或任意动态导入都被包含的证明。

提供可选snapshot consumer装配：只接真实当前进程capability，固定从快照consumer入口取script及pin和已核解释器，禁止caller替换路径/guard。run前/最终实际child+stdio关闭后各完整verify，才可保留queued结果；失败/关闭/取消仍unknown，不当联网/播放证明。装配层snapshot.outcome必须覆盖底层工具历史，防止postflight失败仍显示queued；execution_snapshot_verified只有前后实际复核均通过才为true。run期间快照lease保留文件；snapshot.close同步fence新run，等已有run实际退出后删除；不抢删运行代码、不重复执行或暗发stop。保留TCP14旧入口行为，service/IPC/TTL/来源/授权不变；不强行把尚缺Python依赖冻结写成高层生产门禁。

覆盖语义固定declared-inventory-only、动态/解释器依赖未自动推断、device_evidence=false。本片实际当前hub全packages＋apps/service及包/许可文件保守清单封存/复核后清理，源SHA记录；不是运行整个LAN/USB组合，也不是完整运行时闭包已准入。manager入口示例是模块，工具不import它。后续补真实Python与serial/stdlib/native依赖审阅、清洁执行环境和实际加载证明，再与当次peer/独立用途和窗口记录绑定。

## 验证、停止与回退

原创临时Node程序实际从副本import依赖并输出固定工具JSON，覆盖源修改隔离、依赖改变/额外或缺失文件、重放假capability、入口/解释器错pin、symlink/hardlink/权限/预算/目录逃逸、创建中变化、取消/close等待child与清理。部分用合成Python文件仅验证字节保存，绝不执行Python。

先专项及隔离CLI，再npm run check、npm test（含build）、最终build。只用自有临时进程/目录/UDS或既有loopback回归，无ESP/USB/LAN生产listener、凭据/设备库存探测、插件/profile/固件/服务操作，无提交推送。关闭由consumer实际退出后释放快照；未知退出继续持有，人工核清理，不能以删除快照冒充设备退出。新API不使用即保留原路径。更新当前摘要/待办/G0并归档被替代TCP14下一入口。

实施状态：26项隔离专项、当前hub164文件清单快照/复核/清理、最终check及含build全量1682/1682和最终build通过。两次全量顺序运行，第二次覆盖装配层postflight失败的公共outcome修正；原TCP14/service及现有源文件未更改。仅declared inventory与原创Node加载对照，完整动态/Python/系统依赖和ESP仍待。[报告](../../reports/2026-11-05-tcp15.md)。
