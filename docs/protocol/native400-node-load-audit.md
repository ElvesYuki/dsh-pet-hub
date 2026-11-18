# TCP-16：管理端实际模块导入审计

2026-11-05。[Spec](../context/plans/tcp16-spec.md)/[Diff](../context/plans/tcp16-diff.md)/[报告](../reports/2026-11-05-tcp16.md)。可信本地、默认关闭，非服务启动器或不可信代码沙箱。

TCP17范围收敛：[纯Node控制窗口](native400-node-control-window.md)为后续管理端启动方向，不要求Python。本文已有USB进程/通用快照或加载审计保留为显式可选开发能力；涉及Python/serial环境的历史下一入口不再是管理端默认前置，只有选择该外部工具时才单独核定。

## 入口与实际执行

`createNative400NodeLoadAudit({enabled=false,snapshot,timeoutMs=5000,signal?})`返回`{ready,close,snapshot,resources}`。必须显式true、POSIX、Node24.14.1，timeoutMs100–30000。只接受当前进程真TCP15 snapshot，且存在manager角色；manifest.runtime.kind必须node，解释器规范路径必须等于当前process.execPath。不能靠kind标签把任意可执行文件当Node。原快照/consumer/API保持默认不装配。

从真实capability内部借用manager入口/目录/manifest/解释器及lease，先完整verify。bootstrap固定为清单内packages/runtime/native400-node-load-child.mjs，SHA必须与受控原创实现相同；不能传脚本/guard替换。固定argv、shell=false、独立POSIX组、cwd在副本，stdin忽略，env只LANG/NODE_DISABLE_COMPILE_CACHE，不继承NODE_OPTIONS/NODE_PATH/用户预加载或运行配置。Node用--no-addons、--disable-proto=throw、--no-warnings；这些不是网络/文件沙箱。

bootstrap先检查当前Node版本/manifest摘要和自身SHA，再注册同步loader hook，动态import manager模块。只观察导入，不调用导出函数。**apps/service/main.mjs会直接startOrAttach，不可用作本片实际入口**；当前审计packages/runtime/service.mjs只导出startOrAttach，未调用它。调用者必须先审阅目标无顶层设备/服务/凭据副作用，不得把此工具用于任意未知模块。

## 加载字节与receipt

依据[Node v24.14.1官方module契约](https://raw.githubusercontent.com/nodejs/node/v24.14.1/doc/api/module.md)，registerHooks为1.2 release candidate，只在锁定工具链的离线诊断使用。业务模块在hook注册后动态导入；bootstrap预先导入的五个builtins单列，不当业务加载记录。

resolve接受node内建、相对或清单内file URL；拒裸第三方包/data/http、未列入文件、符号链接重定向、query/hash。load只接受module/JSON，对nextLoad返回、即将交给解析器的原source核长度与SHA，然后原样返回。任何策略违反为sticky失败，业务模块捕获该异常也不能产生成功receipt。缓存重复导入仅记录一次，未执行的动态分支不计loaded。

单条闭合JSON receipt profile为native400-node-import-receipt/1，包含Node版本、snapshot和bootstrap SHA、manager身份、loaded[{root,path,sha256,bytes,format}]、业务builtins、bootstrap_builtins和导出名。只记录相对路径/摘要，无绝对路径/端口/凭据。parent核全部loaded与原manifest对应、唯一、入口已加载/字段闭合/输出预算后，再完整postflight verify才发布ready成功。不能从磁盘任意receipt自授权。

coverage固定observed-node-imports、device_evidence=false、full_runtime_closure_proven=false。该证据证明本次经过hook的解析字节与副本清单相符，**不是未执行分支、worker、CJS、原生/系统库、任意文件读取或Python依赖全部覆盖**。Node builtin名称也不代表其内部C++/动态库逐一冻结。bootstrap和父进程既有加载代码属于受信任诊断基线；不能从源码前后SHA重建父进程历史，也不抵抗恶意同用户或模块删除hook/自行伪造环境。

## 关闭与失败

stdout上限2MiB，stderr16KiB丢弃；输出不为单条合法receipt、污染/截断/超限或非0退出均拒绝，不回显原始错误/日志。超期/abort/close TERM，200ms宽限后KILL自有组，等child的close事件（含stdio）后才postflight/释放lease；exit或kill返回不够。外部snapshot.close同步fence新任务，并等当前审计实际退出，不抢删运行副本。ready为Promise，失败稳定node_load_*或execution_snapshot_*；未知退出不假成功。

close可重复，等待ready收尾，不自动重跑。resources为child_running/streams_open/timers/snapshot_lease；公开view区分started/exited/finished/import_completed及稳定错误，import_completed只在完整成功后为true。snapshot.close不能代替设备stop/STA cleanup或固件恢复。

## 验证与未覆盖

专项覆盖原创静态/动态/JSON、实际加载字节篡改、缓存/未执行分支、外部/裸包/CJS/URL拒绝、catch不消除违规、输出与期限、TERM升级/继承stdio退出、lease/取消与环境注入。固定CLI：

- `node scripts/verify-native400-node-load-audit.mjs --output .cache/<新文件>.json`：独立临时环境原创测试，无设备。
- `node scripts/verify-native400-hub-load-audit.mjs --output .cache/<新文件>.json`：当前hub code-only166文件快照，新进程实际import service，85个业务模块/JSON及11个业务builtins，bootstrap另列；核startOrAttach导出，未执行启动函数，然后清理。

数量是本次快照，源码变化须重验，不硬编码为未来准入。TCP17已补纯Node实际启动/loopback控制；真实LAN分支、系统库和窗口预算仍待。Python serial/stdlib/native只属于可选外部工具；不能延TTL掩排队。终端20f4异常后已由其任务恢复f553并获用户播放/触摸确认；候选问题保留，本模块不触碰USB或固件。

回退先close审计等待实际退出，再close快照。真实设备窗口仍需新鲜状态核定、独立用途/audit、当前精确peer及具体停止/恢复方案；STATE、媒体流、保存/V3后置。不使用新API保持原服务/插件/profile和TCP12–15路径。
