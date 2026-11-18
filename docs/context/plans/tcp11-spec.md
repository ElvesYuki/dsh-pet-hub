# TCP-11 Spec（2026-11-05，实施前）

已读规则/当前摘要/TCP10实际代码和终端新增真实输入离线预检、USB合同与实际firmware_arm。终端完整78 raw index与四记录mapping已核，历史e738完整备份含57ae N400，但均不是当前设备库存或新用途批准。本片解决可复验来源证据，不再添加transport/USB/凭据入口。

新增显式离线createNative400LanInputAudit：调用方提供manifest/index两个明确文件、historical cache来源（28MiB文件或32MiB容器中的明确偏移）及独立expected四SHA（source manifest/raw source index/cache/mapping）。不用文件自带批准，不创建approval_id、LAN option/request、设备配置、journal或监听；输出只为历史PC来源审计证据，不能传作用途准入。

复用native400SourceCandidate核完整78元数据、42号118帧/其余241、geometry/视觉引用和raw index域。从原bootstrap inspector抽取纯header检查（CRC/namespace/geometry/双根/五物理对象/slot/gen/四F/length），原有带独立批准的inspector与map schema不变，不开放其批准入口。新审计仅使用已验证candidate，拒绝降级/较新坏根；两根相同代数/uint64 floor沿旧实现。完整28MiB cache与四payload以单64KiB缓冲流式SHA，与expected匹配才发布结果。cacheSource offset显式，范围不超固定来源，不猜分区、不读取容器外或其他区。真实历史备份只读，不复制到Git或重建镜像。

metadata文件各≤1MiB，普通/current user/nlink1/无组或其他写权限，允许原只读公开metadata；cache来源还须私有权限。O_NOFOLLOW/O_NONBLOCK，每fd读前后及最终所有fd/path指纹一致，保持最多3fd直到实际读取结束；最后fd关闭、alive检查后发布。绝对路径显式，expected/cacheSource/index沿闭合schema，重复字段与坏UTF8沿严格解析；原source manifest扩展字段仍按既有candidate处理且影响原字节SHA，不新设更宽/更窄来源格式。hook只可信代码。metadata最大2MiB+单64KiB流缓冲不是RSS硬预算。超时/abort/close立即失效，忽略abort的hook仍需真实返回再关fd，close幂等等待。不输出路径/原始头/凭据，失败不发布部分证据，不修复/重试源。

输出native400-lan-input-evidence/1，包含派生N_boot/source manifest/raw index/四记录/mapping、historical cache SHA/范围、选根uint64序列和检查等级；self SHA只用于重现不等于签名。明确historical_only=true/current_device_inventory=false/material_usage_approved=false/device_evidence=false/media_validation=not-performed。此片不重做全78解码/画质/压缩，也不把SHA检查标为whole-media proof。

测试使用原创fixture/私有临时源：正向完整链、双根诊断对照、错误expected和域/记录/floor、metadata与payload损坏、同字节路径替换、后读期间改先读metadata、非私有cache/符号或硬链/偏移与边界、关闭/abort/超时/真实hook退出、重复审计必须重读/历史结果不升级。真实输入只运行本仓库审计器，独立预期取既有身份与终端交接（不是动态发现配置）；读取已批准metadata和历史32MiB中cache段，不运行固件脚本或读取Wi-Fi文件。

先专项/隔离CLI，再check和单套test含build。补共同交接中当前TCP/R0事实，选完整78原始index为本次管理端候选、明确端侧无独立compiled index pin的职责仍待共同确认。记录历史来源已核与用途/现时库存/资源未验；终端报告中凭据存在仅引用去敏结论，不输出路径/字段/摘要。文档/当前摘要替换并归档旧入口。

回退close等待所有fd真实退出，仅清理自有临时fixture/报告；源/历史备份/已有批准不改。省略新审计入口保持TCP10/09，未授设备窗口权限。后续用来源证据与单独真实用途决定装配，fresh同设备备份与实际NIC/peer/私有凭据/单USB窗口按授权另做。无LAN/USB/STA/ESP/生产服务/插件/profile/固件修改、素材复制重编码、提交推送；STATE/媒体流/保存/V3后置。

实施状态：18专项/独立CLI、check及含build单套1586通过，另完成本仓库真实历史cache来源审计；无LAN/USB/STA/ESP或新用途批准。见[报告](../../reports/2026-11-05-tcp11.md)。
