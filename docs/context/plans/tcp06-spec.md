# TCP-06 Spec（2026-11-05，实施前）

已读规则/当前摘要、TCP05代码及终端socket-owner合同与最新status/todos。终端owner已完成，仍无真实arm/link/STA调用者，三候选未部署；不重复实现或运行固件脚本。本片不扩大offline-loopback用途或监听范围，不读真实素材/cache，不接ESP。

分析：TCP02只限制监听地址，无单peer选择及网络epoch入口。未来LAN入口若仅靠同mapping HELLO不能隔离非目标地址/快down-up；mapping/IP均不是认证。先做可复用纯core网络准入，接既有owner和TCP05可选路径，保持默认行为与七消息。真实LAN/STA/资源窗口仅写具体执行回退方案，不执行。

新增纯core网络策略：可信本地固定单个规范IPv4 peer，不接受DNS/通配/CIDR/端口/前导零/IPv6（仅入站支持标准::ffff:IPv4表示）。初始link未就绪；本地非零u32严格递增epoch更新，旧/同epoch不改变状态，UINT32_MAX耗尽哨兵强制down。每次新epoch即使up/up也使当前socket失效，防错过down；down阻止连接和动作。策略快照不输出地址。IP只作路由选择，不声称设备认证。

owner可选peerAddress配置后启用策略；networkLink(epoch,ready)由唯一可信生命周期发布者调用，不从设备消息或页面取得。新代先失效活动会话并实际destroy，重连新session，旧BASE不重放，原剩余TTL/reapply规则保持。旧epoch必须在任何时钟/会话变更前丢弃。默认未配置策略时旧行为保持，networkLink拒绝；pause/resume不能使down变up。TCP05仅转交可选地址和本地networkLink，无新配置/CLI/UI接口。监听仍强制127.0.0.1/port0。

验证：纯格式/epoch/u32/隐私，实际loopback匹配/错peer、未up/down/up-up、旧事件、pause/resume、重连新session不重放、close资源收尾；复用原模型与fixture。npm check/test含build，独立CLI；仅合成对象，宿主样本不外推ESP时延。回退省略可选参数；已启策略先close等socket/timer退出，再销毁对象，无持久格式或外部配置变更。下一按执行方案审真实配置/用途、LAN候选/STA发布者及动态资源，不把本片作为设备准入。

实施状态：本片12项专项通过，新增/关闭路径保持offline；换代使首个连接前排队目标也需显式reapply，原截止不延长。最终check/build/全套见[报告](../../reports/2026-11-05-tcp06.md)。
