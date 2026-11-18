# 独立双时钟、延迟与断线离线验证

2026-10-30。先按新规范建立[Spec](../context/plans/dual-clock-spec.md)/[Diff](../context/plans/dual-clock-diff.md)。未接设备、未改固件/pet/桥接/现有DSH配置，未安装/提交/推送。并行动画修改保留，未重新制作或采样动画。

## 根因与实现

旧Registry直接比较设备expires_at与host.now，且要求设备elapsed≤host uptime，只有同钟参考模型有效。新增严格的host发送时刻+可信设备剩余TTL观察，保留设备原grant身份、本地deadline与观察高水位；拒绝过期响应、降级为绝对时钟、旧观察及旧grant。设备时钟仍最终决定租约有效性，host只维护本地估计。

另修复新lease首命令被旧revision拒绝：Registry.expect现在依据commandControl所属lease比较高水位，而不是已提前更新的新control。显式disconnect令会话离线、拒绝迟到结果，保留最后actual；新认证hello/acquire后仅最新目标成为actual。相对elapsed不跨域比较，started仅接收估计。详见[契约](../protocol/dual-clock.md)。

新simulator/dual-clock使用三条独立虚拟时间线（host、device、link），消息发送时复制，无socket/worker/定时器/素材文件。可信认证fixture不进入候选包。没有新建生产网络/自动重连器或IPC路径。

## 验证

npm run check、npm test（含构建）通过，全套207项；新增13条双时钟用例全部通过。另因修改核心控制边界运行test:sim：SIM-01–30+4通过。check仍仅.mjs语法检查，没有新增架构/契约自动门禁。

| 范围 | 离线结果 |
| --- | --- |
| 双向启动偏移 | host=0/device=800000及反向偏移均可播放，设备elapsed大于host uptime也可接收 |
| 延迟grant | 3秒后收到仍沿用发送时期限；收到时到期拒绝，原期限边界相等即失效 |
| 重复响应 | 不从接收时续满期限；已过期的响应不建立控制 |
| 续租重排 | 先接新观察再接旧观察，旧观察/旧报告拒绝；相对会话不能省略观察 |
| 快设备/暂停host | 设备先过期拒绝旧命令，更高epoch可立即接管，首命令revision从1有效 |
| 慢设备/暂停device | host先失去控制估计，旧报告拒绝；新续租观察显式恢复 |
| 断线 | 最后actual保留但offline、不受控；旧set/report晚到不覆盖新会话最新目标 |
| boot/host重启与丢包 | 旧上下文拒绝，丢弃set不产生actual；新hello/acquire后收敛到新目标 |
| 快照/报告顺序 | 改发送方对象不影响排队副本；重复playing不重置计时，旧目标不能覆盖 |
| 输入/关闭 | 未来发送时间、坏TTL、未知字段零修改；关闭后回调拒绝 |
| 速率差 | 4秒:6秒与6秒:4秒两组，各100次续租，持续有效且不重置首帧估计 |
| 心跳 | 仅host本地15/30秒边界判断，重复seq不刷新在线，断线后旧心跳拒绝 |

13条包含两个偏移独立用例。可执行scripts/verify-dual-clock.mjs生成忽略目录.cache/dual-clock/results.json；它复用上述用例，不算第二套独立验证。第一次全量构建期间出现dist/package.json缺失，重跑通过；不据单次失败推断根因或改并行工作。其他初次新增用例的重启/重复返回断言已修正，新的lease目标比较失败已在core修复。

## 未覆盖与墙钟测量方案

没有时钟漂移硬上限/TLS/证书/实际链路/设备Flash或多日墙钟运行；上述倍率只是确定性扰动，不是ppm安全包络。旧同钟接口未迁移生产，已有角色streaming/图层预览不使用新接口，故本轮未机械重复PET4全库和浏览器采样。

下一墙钟测量拟采用独立临时runtime/原创固定240与360素材、真实worker/IPC、30分钟窗口、每秒采样RSS/heap/ArrayBuffer/在途/worker数、按固定速率换包与读帧；报告初始/峰值/末10分钟趋势、取消/退出后回收，禁止强制GC。失败/超时/预算异常立即停止，确保finally关闭进程并清临时目录，不读取真实配置。该长测本轮只准备方案，尚未执行，也未创建自动任务。

后续先补可信TTL承载、独立时钟安全margin/最坏延迟预算与v5互操作Spec；真实集成仍须具体方案与回退，NO_GO_UNTIL_MEASURED保持。回退仅撤回本轮core及模拟改动，无持久格式变化，不清用户绑定/素材/指针。
