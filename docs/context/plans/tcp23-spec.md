# TCP23 Spec：显式hold-state、可信采样与真实来源观察（实施前）

2026-11-06。用户授权继续实现保活与真实自然任务只读观察，无子智能体，不改现有服务/账号，不接ESP/USB，不提交。本轮不重做TCP22的真实DSH动态准入。

新增mode=hold-state，默认event保持。hold只接受本机显式公开HTTP只读source opaque句柄：真实成功GET产生不可伪造采样收据，时间从请求开始计，<=1500ms且观测窗口有效；page缓存不作为活性凭据。HTTP新鲜仅指响应活性，不保证任务语义刚改变。独立source观察代/有限sourceMs<=120秒，重建不从页面发起。样本跨await后重验，关闭/时钟倒退/过期收据拒绝。

最小私有view扩展shared.limits/profile=shared-limits/1提供真正lane source_window_ms，与顶层页面权限remaining_ms分别验证；旧无limits view仍兼容event，hold拒绝缺能力。GET不续权，不能混用或延长两类窗口。

hold固定新BASE5秒，只0/1/11。首次必须无他人目标；后续仍为自己command_id/revision/同action且未过期、remaining<=2000ms才新请求。每次成功新鲜采样且网络open，权限/真实lane窗口/观察窗口均需>7500ms（5秒TTL+2500ms预算）。不因新counter绕过持有门禁。目标过期停hold、不以旧counter复活；人工CAS/实例组换代、陈旧/失联/倒退、暂停、撤权、预算不足、close/晚样本停止并尽力只撤自己目标。unknown冻结，显式confirm原body后重新核采样/所有权/预算，坏则撤自身，不自动换body重试。

触摸：不新增wire/STATE。现协议不能可靠报告整个本地触摸生命周期，因此hold必须由可信本地priority()提供clear/local/unknown，默认unknown失败关闭；本轮fixture从设备模型取真实本地优先态，实际ESP来源仍待，不能冒称生产触摸探测已具备。local/unknown时停止并撤自己的remote，不抢本地；设备原touch优先保持。

先genuine audit/window/shared IPC/loopback宿主正负例，再标准/独立构建与完整回归。只新增hold到已授权adapter路径，不直接owner.base、不扩LAN source/page门禁。真实观察工具仅从明确loopback公开API取过滤semantic/counter/单调时序，最多30秒，不扫描端口、不发任务或pet写接口；静态版本/进程start/PID与实际加载SHA区分，不能取得运行绑定即待验。未见自然迁移则不无限等待。

回退mode=event或关闭source/bridge，清理自己的测试HTTP/UDS/socket/grant/临时目录。默认不安装/启用任何profile。本轮候选需记录新SHA，不向终端自动开设备窗；Desktop scheme/长测/素材流/保存/V3不并入。

实施状态：代码/宿主合同已完成。24专项/隔离CLI、默认event20项定向、check及含构建全量1848/1848、标准与独立候选build通过；真实15秒观察无自然迁移，运行加载版本/真实priority provider仍待。见[报告](../../reports/2026-11-06-tcp23.md)。
