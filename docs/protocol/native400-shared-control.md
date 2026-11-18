# TCP-19：共享后台会话与有限自动恢复

2026-11-05。[Spec](../context/plans/tcp19-spec.md)/[Diff](../context/plans/tcp19-diff.md)/[报告](../reports/2026-11-05-tcp19.md)。复用[TCP18](native400-node-control-channel.md)的私有IPC、HTTP权限和Node窗口，不新增wire消息或生产启动入口。

后续[TCP20](native400-connection-controls.md)已补默认OFF Connection承载候选与独立浏览器共享验证；实际DSH rc.5 profile认证/动态加载仍待，未自动安装，TCP19有限后台窗口/剩余TTL边界保持。

## 三层寿命

`prepareNative400NodeControlAccess({request,shared:true,autoRecover:true,sessionMs:60000})`显式选择共享模式；`shared`缺省false，`autoRecover`缺省等于shared，非共享不得启用自动恢复。策略和16个attachment、32条receipt容量进入descriptor/sourceKey；不能附着既有服务并偷偷升级权限。原sessionMs上限120秒不变，共享模式将其用作每个页面凭据的权限期限。

后台逻辑组归同一Node赢家/来源窗口，保存全局seq/revision、最新意图及32条最近完整请求/ACK。页面分别领取随机bearer，复用逻辑组ID；没有共享页面token，也没有网页authorize接口。设备每次连接仍产生新的HELLO/OPEN与wire session/controller。页面、后台逻辑组和设备连接互相独立，均不能给动作延长原始TTL。

| 事件/可信本地方法 | 共享模式行为 |
| --- | --- |
| authorizeControls() | 增加独立页面凭据，复用逻辑组；最多16个，不取消原目标 |
| 页面关闭、HTTP暂断或页面凭据到期 | 保留后台意图，过期凭据不得继续访问；新页面由宿主重新授权 |
| detachControls(credential) | 仅撤销该页面凭据，不停止后台目标 |
| revokeControls(credential) | 撤销整个逻辑组及所有凭据，取消仍由该组持有的目标 |
| endControls() | 可信赢家结束整个逻辑组；所有页面凭据到期后也可调用 |
| 来源/独立窗口失效、时钟异常、窗口关闭 | fence并清除共享组及凭据，保留原失败关闭约束 |
| Node服务进程重建 | 新实例/新组，不从磁盘恢复旧命令或凭据 |

旧非共享模式继续按TCP18授权轮换/权限到期取消目标。新增detach/end仅共享模式可用；attached客户端没有issuer权限。组结束只取消持有的唯一intent key，外部可信调用者后来提交的同动作也不会被旧组误认。

## 重连与幂等

默认共享策略的25ms维护器仅在来源/窗口有效、网络ready、新wire会话open、最新目标未过期且其opaque handle仍有效时调用原owner剩余TTL恢复；GET状态轮询不执行restore。恢复后同一连接不重复下发。该间隔是调度频率，不是设备响应或最坏延迟保证。设备主动重新连接，hub没有扫描/拨号实现。

恢复不重置原deadline；例如原5000ms目标断线200ms后新会话只收到4800ms。断线期间的新BASE替换旧目标；cancel、revoke、end、到期、source/window失效均禁止复活。pause使原意图不再自动恢复，resume本身不重新授权；需新显式意图或可信人工reapply。后台持有唯一intent key，不按action编号猜测所有权。

全局CAS拒绝多页面旧revision覆盖。32条缓存内同seq且完整规范化body一致，返回原ACK，不调用BASE/不续TTL；同seq异内容拒绝，已淘汰seq拒绝。页面结果未知时保留原body，仅用户明确确认原请求；不会自动重试。更换页面token不改变组ID，仍可确认旧请求；真正组/服务换代清掉旧pending，接受新授权状态供后续明确操作。

## 可选状态扩展

`native400-node-control/1` envelope可选增加`shared`，缺省保持TCP18旧格式：

| 字段 | 范围与语义 |
| --- | --- |
| profile | native400-shared-control/1 |
| attachments | 0–16，当前有效页面凭据数 |
| desired | null或action=0/1/11及remaining_ms=1–60000，只是后台意图 |
| recovery | enabled、pending布尔；attempts为十进制uint64本地恢复计数 |
| last_command | null或最近operation/request_seq/request_id/revision/command_id白名单；不含bearer |

剩余顶层remaining_ms仍是当前页面权限寿命。seq/revision与last_command关联严格复验，边界重建展示字段，额外输入不直接透传。UI重新挂载同步后台目标，HTTP读取恢复后清除旧不可用提示；未知请求仍保留待明确确认。

本地submitted ACK、后台desired和恢复次数均不是设备accepted、完整SHA验证或frame0。`verified=null/current_display=unknown/device_evidence=false`保持；frame0_history仅收到报文的历史，本轮来自独立模型，不能外推为ESP实屏。

## 验证、边界与回退

专项入口：`node scripts/verify-native400-shared-control.mjs --output .cache/tcp19/results.json`。使用原创audit/独立窗口、真实UDS/HTTP/loopback TCP与React hook；[29项结构化证据](vectors/native400-tcp19-results.json)。没有浏览器DOM、实际DSH授权provider或ESP验证。

共享仅存在于当前有效后台窗口（原上限120秒）；不是跨服务崩溃持久会话或生产无限续租。不新增配置/持久格式、不需要Python，不碰pet/bridge/DSH服务。回退先end/revoke，卸载自有代理/页面，await窗口/request/audit实际退出后清临时资源；unknown保现场，不抢锁/重发。下一次构造省略shared恢复legacy，省略controlAccess保持只读；运行中不热改已有服务策略。
