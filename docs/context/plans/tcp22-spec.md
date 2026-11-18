# TCP22 Spec：已授权隔离宿主动态准入与持续状态评审（执行前）

2026-11-06。用户通过终端交接明确授权在全新home/profile/runtime装载自有0.2.2候选、动态验证，再探测真实pet只读能力；不再次以缺隔离授权停工。不动当前profile/服务/账号，不复制凭据，不接ESP/USB，无子智能体。

## 执行方案与回退

- mkdtemp创建唯一pethub-tcp22临时根，DSH_HOME指向其home，profile=tcp22；不改HOME/CODEX_HOME。所有私有配置/端点/token/原始日志只在临时根或.cache/tcp22，Git仅摘要。
- 用实际安装DSH0.2.2-rc.1 Electron Node-mode CLI；先help/dump/schema，再官方web模板生成自己的profile。候选只用dist-dsh022自有本地链接，无下载/包管理器安装；单Connection bundle、来源disabled、独立hub runtime、设备关闭。WebServer明确127.0.0.1、动态port0、no-open，禁用遥测/分析条目，不登录、不发模型任务。
- 先验证Config运行投影、真实React/slots与Connection registry、加载/停用/重启/卸载；仅保存本次自有PID，停用不停止共享hub。默认只读基础通过后，在测试shim显式注册Connection适配器，以临时可信授权绑定原创fixture来源和已有shared client；不解析宿主cookie secret，不网页发权。
- 真实pet探测：优先只读已知安装插件公开服务能力/确切公开端点；不扫描端口、不读取账号配置，不启第二份pet会话监听。无法从不扰动现有服务的上下文取得则如实记录阻塞，不把fixture pending/ready当真实变化。真实来源仅过滤semantic/counter，不保原响应。
- 使用Playwright技能验证自己的浏览器context，绝不刷新现有窗口。退出先关闭自有页面/shim/来源桥与临时授权，再停自有DSH PID、hub，await资源退出；只移除自己的profile/link，未知结果保现场，不按端口/名称杀进程，不修旧profile。

## 持续状态合同评审

TCP21为事件桥：相同working/counter不续默认5秒TTL，过期回本地；新counter事件才发新BASE。先做虚拟时钟真实IPC/loopback对照，验证此表现与人工优先/授权/来源期限。设计可选持有模式：只在新鲜成功只读采样、原bridge command_id/revision仍属自己、同实例/组及权限/来源窗口有效、未unknown/暂停/人工覆盖时，在剩余TTL低水位申请新有界BASE；不能延长来源/页面权限，不在未知时换body重试，不用GET/重挂续期。本轮先记录具体proposal及负例证据，不默默改变TCP21默认语义/共享owner租约。协议变更另按Spec实施。

验收分静态/构建/宿主模型/真实DSH/真实pet；动态资源与清理单独记录。修改后check/test/build，更新上下文并归档被替代“未获授权”入口。设备自动闭环、素材流/保存/V3/长测不并入。

执行状态：已完成授权内动态Web宿主、真实pet空闲只读及事件期限评审，4专项/隔离CLI、check/1824全量、两候选build通过。回退完成，真实语义迁移/page运行API/Desktop scheme/hold实现/资源长测仍待，见[报告](../../reports/2026-11-06-tcp22.md)。
