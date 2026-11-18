# TCP-16 Spec：新进程中实际模块加载审计（2026-11-05，实施前）

先读规则、当前摘要、TCP15快照/consumer及真实service入口。apps/service/main.mjs会调用startOrAttach，不可作为本片import目标；packages/runtime/service.mjs仅导出启动函数，可在新隔离进程中import而不启动服务。实施前初读终端20f4 PMU候选第三次USB复位后失联、恢复待重连，当时不能继续写f553已驻留；收尾新恢复证据见报告；终端只读，不参与恢复/设备窗口。

## 范围

TCP15能封存声明清单，但未import当前manager。本片新增默认关闭、仅可信本地的Node模块加载审计：复用真snapshot/lease，新进程从副本动态import指定manager模块，记录实际经过loader的.mjs/JSON字节SHA与路径；不调用启动函数、不运行apps/service CLI、不触及USB/Python/凭据/生产listener。manager必须是已审无顶层设备/服务副作用的模块；该工具不是不可信代码沙箱。

Node固定24.14.1。已本机确认module.registerHooks存在，并查官方同版本module.md：同步hook为1.2 release candidate，必须在动态import前注册；不用26版文档推断当前能力。相对导入/声明内file URL及node内建可用，裸第三方包/data/http/未声明file/URL query/hash/非module或JSON格式拒绝。load hook对**实际将交给Node解析的source**核完整SHA/长度，不只读文件stat；再原样返回给解析器，避免前后SHA代替加载字节。模块缓存及尚未执行动态路径只记录实际观察范围，非全部分支闭包。

## 资源与信任边界

TCP15新增内部真capability借用，取得manager入口/manifest/解释器及verify/release；仅本地模块使用，不暴露给IPC。审计run前完整verify，持lease至实际child+stdio关闭及postflight复核，再release。snapshot.close先fence新工作，已有审计持有副本不被抢删。

bootstrap为本仓库原创、仅静态依赖Node builtins的文件；必须位于清单副本且SHA等于受控实现，固定argv、shell=false、显式解释器、干净最小env、不继承NODE_OPTIONS/NODE_PATH/用户预加载/编译缓存。bootstrap本身与解释器文件pin单独记账，不冒称父进程既有模块、stdlib/系统动态库已全部证明。child进程组TERM→KILL、有限启动期限、abort/close、输出预算2MiB/stdout和16KiB/stderr，等close而非exit。输出严格单条JSON、原始错误/日志丢弃；receipt逐条绑定manifest、拒重复/额外项/超限，结果失败或postflight变化不能记import完成。

公开证据仅相对路径/摘要/计数/Node版本、coverage=observed-node-imports，device_evidence=false。bootstrap预先导入的Node内建单列，不将未使用清单文件写成loaded。无磁盘receipt自授权接口、无新素材/设备用途批准。只读权限/loader不抵抗恶意同用户或模块自删hook/另起worker；这些受信任模块不做此行为。未覆盖实际service启动/动态控制分支、Python serial/stdlib/native、外部系统库、真实链路/最坏延迟。

## 验证与回退

原创临时模块实际静态/动态/JSON导入、坏SHA/未声明/路径与scheme/裸包/CJS拒绝、重复与缓存观察、顶层失败/输出污染、超期/取消/close等待、工作树变化不影响副本、postflight篡改失败。新code-only CLI对当前hub源清单封存后，实际新进程import service并核导出startOrAttach，记录loaded清单和完整临时环境退出。只用自有临时进程/文件，不运行任何上游脚本/设备工具，也不调用服务启动函数。

专项/隔离CLI→npm run check→npm test含build→最终build；只因新失败扩大复验。同步更新摘要/待办/G0/终端新状态，归档TCP15被替代的未import结论。回退close审计等实际退出，再close快照；未知退出保留lease/文件，不自动重试/删除或冒称设备恢复。原TCP12–15/service/IPC/wire/TTL默认行为保持，无插件/现有服务/profile、固件/分区/cache修改，无提交推送。

实施状态：27专项/隔离CLI、当前hub166文件快照中新进程85业务模块/JSON及11业务builtins导入对照、check与含build全量1709通过；最终build及证据收尾见[报告](../../reports/2026-11-05-tcp16.md)。未启动服务/设备通道，完整动态/Python/系统依赖及正式launcher仍待。
