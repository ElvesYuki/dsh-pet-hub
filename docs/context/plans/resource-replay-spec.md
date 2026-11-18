# PET4内存与核心回执回收 Spec（实现前）

2026-10-29，仅宿主/纯core/合成模拟，延续137测试基线。先记录现有50次换包/500次读帧的同机新进程基线，再优化；不接设备、不写外部仓库或现有配置、不安装/提交/推送。

## PET4分配与校验

当前readRegular分块复制后concat、decoder逐tile分配、全帧校验逐帧复制indices/RGB，会增加GC瞬态；worker全库校验只需要完整文件SHA和每帧CRC，却还计算整段indices/RGB诊断hash。

- 保留默认decode返回独立数组和默认inspectPet4完整摘要；新增调用方缓冲decodeInto，内部仅复用一个tile scratch。默认压缩输入仍独立复制，不开放外部可变内存借用。
- readRegular按已校验stat长度一次分配，分段填充并探测多余字节，保持链接/类型/大小/改动拒绝。
- worker校验/prepare固定使用不生成全段indices/RGB诊断hash的完整帧校验：仍验文件SHA、header/table/每tile格式/每帧CRC及几何/时序，绝不因缓存存在跳过。build不保留player；prepare保留当前decoder和单帧复用RGB缓冲。pixels返回独立缓冲供转移，不转移复用scratch。
- 不使用强制GC、放宽解码检查或跨版本信任缓存来降低测量。记录前后RSS/耗时/worker与应用缓冲指标，RSS只是采样，硬内存包络待验；未改善也如实报告。
- 审计脚本明确使用player=false保留诊断摘要，不将新增pixels函数闭包混入长期records而持有整库decoder；这个审计工具的引用生命周期不等于worker仓库缓存。

## 核心回执与高水位

- DeviceModel命令保留最近256条FIFO回执，已接受revision保持单调。窗口内同ID同内容幂等、不同内容冲突；淘汰后旧revision不得再次接受/下载/计时。desired、actual和槽保护独立，不因回执淘汰而丢失。新lease重置命令高水位，旧grant仍由epoch/session fencing拒绝；窗口外复用ID并携新revision不承诺永久识别，生成方必须唯一ID。
- acquire仅保留最近一次成功grant操作回执，绑定原expectedEpoch；相同operation_id不同expectedEpoch拒绝。续租更新此回执、重复不递增epoch；过期/释放/旧epoch请求拒绝。只在持久提交成功后替换回执，不淘汰当前唯一可恢复的成功操作。持久撤销凭据/回执不作普通缓存回收。
- DeviceModel最多16个认证session，满时只淘汰非活跃lease持有者的最旧session；被淘汰上下文stale_session，不能影响当前lease或授权未认证方。绑定/发现容量保持原约束，不自动删除。
- IntentScheduler保留最近256条意图回执，淘汰后仍受当前意图revision CAS。已有缓存命中只返回原结果，不再次改模式/计时。
- 新sequenced触摸模式提供规范uint64 event_seq，以已验证输入会话为范围，高水位只前进，旧/乱序/重复事件不再次触发；冷却内合法新事件也消耗seq并记回执，防延迟重试绕过冷却。最近256条记录用于同ID/内容冲突检查。首个触摸确定模式，不能混用无seq以绕过高水位。旧无seq入口保留256条上限并失败关闭，无法在没有新鲜度依据时安全淘汰；不宣称旧设备已支持seq。
- 内部resources只给计数/高水位，不给凭据。所有修改在纯core，生产wire仍未实现；新触摸seq承载需后续协议适配。

## 虚拟耐久、验证与回退

模拟时钟/故障事件的诊断历史保留最近1024条并报告丢弃数，避免长时间测试日志本身无界；认证fixture仍排除候选包。补充超过256条的命令/意图/触摸、超过256次租约获取和超过16个session，验证老请求、冷却、存储失败、epoch/会话切换、actual/槽保护均不倒退。虚拟多日推进不是多日墙钟/RSS验收。

执行方案：临时目录测基线；独立单元/宿主测试及S1清单；同一探针参数优化后对照；只读审核来源的完整360校验/当前帧核对；完成即清临时副本/worker。回退仅停止独立测试并撤回本轮代码，不删除用户确认指针、持久绑定或素材缓存。真实集成仍另备方案/回退，不在本轮授权中。
