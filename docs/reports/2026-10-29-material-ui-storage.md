# 每设备素材选择与持久保存验证

2026-10-29。先补[Spec](../context/plans/material-ui-storage-spec.md)/[Diff](../context/plans/material-ui-storage-diff.md)。仅显式simulation、临时UDS及loopback预览，无真实设备或DSH实例接入，不修改固件/pet/bridge/现有DSH配置，无子智能体，无提交推送。

实现：MaterialAssignments增加严格恢复及提交前persist；runtime素材管理器在唯一owner取得socket后加载materials.simulation.json，默认disabled完全不读写。模拟A提供466显示/360与240候选，B提供240候选；这些是素材偏好测试profile，原动作actor仍为240合成fixture。POST /v1/materials/selection经鉴权、实例核对、每设备CAS、目录摘要/兼容检查及原子写文件后才成功。插件同源代理与真实React每设备select/保存按钮已接入；推荐不会自动保存。

持久范围：仅已确认选择、required_actions和各设备revision。0600，128KiB读写上限，最多64记录；临时文件同目录、fsync后rename，成功后更新内存。损坏/缺字段/过大/不安全权限/符号链接启动拒绝且原文件不覆盖。磁盘失败503、内存不改、临时文件清理。没有目录fsync/真实掉电验证，不能声称断电绝对耐久。单写者保证依赖同runtime目录服务仲裁，外部手工编辑不受支持。

验证：npm run check、npm test（含dist候选构建）79/79通过，新增9项测试覆盖重启恢复/不恢复播放、A/B独立及并发CAS、旧instance/非法字段/摘要/不兼容拒绝、写失败和真实rename失败不改内存、损坏/权限/符号链接不覆盖、disabled隔离、能力变化保留unsupported、输出大小限制、真实插件HTTP代理与组件事件。

浏览器使用现有本地React种子、全新临时服务和dist/client.js：A选择360并保存、B选择240并保存，分别显示已保存；空草稿保存按钮禁用，B没有360候选，交互期间浏览器控制台0错误/0警告；停止临时服务后尚未关闭的页面继续轮询，产生预期连接失败日志，随后已关闭测试标签。截图目视检查通过，证据在忽略目录.playwright-mcp/material-selection.png，不含真实配置。预览已停止并移除其临时目录；服务同目录重启恢复由自动测试验证，浏览器没有运行真实DSH或刷写。

运行方法：npm run preview:simulation每次新建临时目录，退出删除偏好，适合UI试用；需要跨进程恢复的离线测试，应显式启动apps/service/main.mjs --device-mode simulation --runtime-dir <同一私有测试目录>，不要指向现有运行目录。退出服务保留该独立文件供下次恢复；这不是安装/启用插件指令。

未覆盖：真实角色目录导入/许可审核、素材安装分发、Flash激活/掉电、schema2固件协商、多manifest生产播放装配、解绑删除偏好、跨平台存储、真实pet状态、实体设备认证/资源测量。偏好保存不改变actor manifest，不会发任何设备动作。回退：停止本轮独立测试服务后，可删除其专用materials.simulation.json及撤回新增代码；不要删除现有运行配置。存档损坏时保留原文件人工检查，不自动重建。
