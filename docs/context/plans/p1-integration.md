# P1 真实集成方案与回退（初始方案）

本轮只有临时服务/模拟宿主/静态预览验证，未连接现有pet、桥接或实体设备。以下先列具体候选与步骤；真实DSH profile安装/启用仍需用户批准。

## 已准备的审查对象

- `npm run build`生成dist目录，包含host入口、无顶层ESM的client脚本、唯一bundle entry `dsh-pet-hub`和MIT声明。未发布，manifest保持private；兼容性标记未伪称compatible。
- host只代理GET status和POST page-state；没有设备写入/任意URL/配置写入/远程stop路由，页面拿不到IPC token。
- CLI明确传入runtime目录，插件从同一目录连接；默认插件目录是~/.dsh-pet-hub，但本轮从未创建/使用它。隔离测试必须在宿主装配配置中明确传runtimeDirectory，不向现有desktop profile打补丁。

## 第一步：离线服务手动复核（不依赖DSH）

在本仓库终端创建全新的短路径私有目录，启动：

```sh
trial_dir=$(mktemp -d /tmp/pethub.XXXXXX)
node apps/service/main.mjs --runtime-dir "$trial_dir" --source-mode disabled
```

另一个终端用相同目录启动同命令，应返回attached并退出；主终端按Ctrl-C后只释放本服务socket/描述文件。config.json若存在保留，目录仅属于本次试验；不要对已有运行目录执行删除。多源配置不匹配必须报错，不能重配现有服务。

## 第二步：隔离DSH宿主（审批后）

1. 先只读核对`dsh plugin --help`与profile隔离能力，确认不会覆盖desktop/web profile；未确认前不写任何DSH配置。准备独立测试profile及其完整配置diff、明确停止命令。
2. 当前dist是结构候选，先解析本机宿主的schema/config注入方式和peer/client依赖，确定runtimeDirectory如何传入；当前未导出DSH Config schema，因此不能直接假设配置项已经被宿主接受。`dsh.client.inject`也要在隔离环境核对宿主的slots/React模块解析，确认后再宣称候选可安装。
3. 仅在测试profile挂载dist；服务另行前台启动，模式disabled；确认设置区名称、空设备状态、只读诊断和host路由路径语义。
4. 卸载/重载测试插件，验证路由和页面定时器释放，同时共享服务仍可被独立客户端读取。关闭测试profile不影响现有desktop profile和现有桥接。

## 第三步：只读pet状态（审批后）

- 本机旧pet不具备页面getState。优先在测试profile中确认实际能力；不升级现有pet。page模式显示unsupported应为正常结果，不编造空闲。
- 若测试同页pet确有公开getState，则显式以page模式运行服务；打开两页验证首写租约，关闭所有页面约3.5秒后应显示来源不可用。页面来源不能作为无人值守后台唯一来源。
- HTTP模式仅在用户指定经核实的数值loopback base后启用：`node apps/service/main.mjs --runtime-dir "$trial_dir" --source-mode http --pet-base 'http://127.0.0.1:实际端口/dsh-pet-7340'`。不保存URL、不自动读取DSH配置、不进行任何POST到pet。
- 本轮不触发真实DSH任务。后续自然任务验证thinking/working/result等以及断连恢复，检查实体管理不触碰桌宠设置与播放。

## 回退与异常恢复

- 正常回退：卸载测试profile内候选、关闭测试profile；终止本次前台hub服务（Ctrl-C/SIGTERM）；关闭预览。只移除本试验的dist或临时目录，不触碰原有pet、桥接进程、profile、NVS或素材。
- 附着客户端退出不能终止owner。没有远程stop接口；不按端口杀进程。
- SIGKILL/崩溃后可能残留socket/描述文件。不可达不代表可删除：先确认所有使用相同runtime目录的启动者已停、检查目录所有权/实例记录和本试验进程；只在离线窗口人工移走试验目录中的hub.sock和service.json，保留config.json。若无法确认无人持有则保持阻塞，改用全新隔离目录，不清理已有目录。禁止仅凭PID/超时回收。
- 后续实物接入另写固件/协议Spec与回退；当前无需烧录或改桥接配置。BLE授权另设专项方案。

## 后续执行记录

用户于2026-10-29明确授权独立profile验证，已按[p1-host-spec.md](p1-host-spec.md)执行。Config/React/slots及Web profile加载/热重载/卸载通过；[实际报告](../../reports/2026-10-29-isolated-host.md)覆盖本页第二步。第三步pet真实来源、Electron desktop、设备及BLE仍未执行。
