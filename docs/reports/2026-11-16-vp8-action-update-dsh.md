# VP8 动作 1 独立 DSH 与真机查询

2026-11-16。已安装 DSH CLI、WebServer 和 Connection 均为 `0.2.2-rc.3`，Cordis 4.1.0、Schemastery 3.19.0。锁定 rc.1 的候选被正常版本门禁拒绝。新增独立构建目标 `node scripts/build-dsh022.mjs --host-version 0.2.2-rc.3`，使用相同插件代码，精确声明 rc.3 的宿主 peer，保留原 `dist-dsh022` 和 rc.1 的历史 pin。[执行 Spec](../context/plans/vp8-action-update-dsh-spec.md) · [Diff](../context/plans/vp8-action-update-dsh-diff.md)

只在新 DSH_HOME 与独立 Web profile 本地装载候选，WebServer 绑定数值 loopback，停用四项遥测。本次配置 schema 投影 `runtimeDirectory` 与 `vp8UpdateOrigin`，官方模板的既有 Loader carrier 诊断仍出现。首次尝试禁用了 DSH UI 依赖的 `remoteAccess` 服务，页面出现缺依赖提示。在测试 profile 恢复模板默认项后页面正常加载，未登录或创建任务。

| 操作 | 观察 |
| --- | --- |
| 候选加载 | 设置区出现“实体宠物设备”，Hub 已连接。缺 `vp8UpdateOrigin` 时 VP8 面板隐藏，路由 404。 |
| 重载显式配置 | VP8 动作 1 面板出现。未授权请求 401，错误授权码显示拒绝，查询和安装按钮保持禁用。 |
| 合法授权后点击查询 | 真机 `STATUS1` 被管理端确认为 `compatible=true, saved=true, existing=true`。浏览器显示“设备已保存”，安装按钮禁用。未触发安装、取消或素材 HTTP 发布。 |
| 停用插件 | 设置入口移除，health 与更新路由均返回 404，独立 Hub 仍能经 UDS 查询。 |

固件任务已完成中途拔电，确认首块写入后试验区无提交标记，原动作离线播放 241 帧，恢复 `56644ffd` 后在独立代理宿主验证重复安装无下载。本轮使用已释放串口。两条本机 USB 串口分别由 Espressif JTAG 与 STM32 STLink 枚举，只查询前者。首次查询因执行沙箱打开设备返回 EPERM，改用单独获准的 Hub 查询进程后通过。浏览器也使用获准的独立临时会话。固件来源为 `apps/round-pet/reports/2026-11-16-vp8-power-cut.md`。

浏览器、两份独立 Hub 和测试 DSH 已退出。确认临时 Web 监听关闭、两份 UDS 及描述文件释放、串口无占用，再删除临时 profile、候选副本和含一次性授权码的诊断数据。现有 DSH／pet／bridge 和设备素材均未调整。真实 DSH 从空库存首次安装仍待固件任务划定不覆盖已保存对象的测试窗口，成功与失败场景继续由 PTY 回归覆盖。[首次安装联调步骤](2026-11-16-vp8-action-update-plugin.md#下一轮实际插件联调)

`npm run check`、rc.1 与 rc.3 两套构建、两份 manifest 的精确 peer 核对、带固件只读素材目录的 `npm test` 均通过。全量 2029 项，零跳过。
