# A4 设备主动拉取与有界调度 Spec（实现前）

状态：按实现前范围完成候选，见[48专项/563全套报告](../../reports/2026-10-30-round-pet-a4.md)和[活动API](../../protocol/round-pet-a4.md)。生产/实体准入未关闭。

2026-10-30。按用户授权，独立临时环境离线实施；先读AGENTS/当前上下文及实际session-runtime、lease guard、mtls-peer、asset-segment、旧lane与A3。保留修改，不用子智能体，零新依赖/原创MIT。不接设备、不读写固件/pet/bridge/DSH，不安装插件或改变已有服务，不提交推送。

## 范围与既有能力复用

新增显式round-pet-pull-candidate/1对象/JSON合同、单设备调度协调器和单HTTP实际退出owner。只导出handler/适配函数，不在service/CLI/plugin默认装配listener。测试才在literal loopback动态端口创建临时HTTPS服务器/私有PKI，复用既有MTLS_OPTIONS、binding-store、createSessionRuntime(scoped)、lease guard/encode/decode及assetRange/validateSegmentResponse；不重做密码学或改变证书缓存/动态日期/撤销/同步revision视图。

hello沿用既有begin/confirm；候选exchange/manifest/asset另用隔离路径，不能对当前v5发字段。新profile只在候选context中工作；固件/Node共同wire尚未冻结，不宣称新hello扩展已互验。A2批准的manifest/P/N由受信caller注入，真实库批准另等C02；测试媒体原创PET4。A3通过当前真实TLS request的不可序列化proof与当前session/control回调接入，仍只代表loopback peer事实，不把HTTP成功/服务端写完当首帧或保存。

## 拉取、队列与回执

设备先exchange（完整context、单调request_seq、request_id、observation=null或1条）→响应至多1 control→设备执行→下一次exchange回传关联dispatch_id的receipt。lease begin sent_at在实际派发时登记而非UI入队；grant使用已有V5候选lease编码，guard确认后才可控制。playing/display/storage等沿用A3候选对象，分别验证；回执与pending control关联，不因HTTP200清pending。错误/缺失回执不自动重派有副作用控制。

一项在途control、一项未派发latest base、一项未派发普通副作用/查询；renew/cancel/revoke各至多1旗标（acquire显式单项）。latest base可替代旧queued，已派发操作不可覆盖；第二个不同save等明确queue_full。cancel/revoke/renew优先于base/普通操作，pending未解决时只等回执或截止，不为紧急动作开第二在途。所有项绝对deadline包含排队，超时失败关闭；save/acquire派发后丢回执结果unknown，不报未执行或自动重试。close/invalidate清队列/许可并失效session，重连新TLS/hello/acquire/查询且不重放旧base/副作用。

## 分页、分段与预算

无控制待发且控制权可用才下发一次性read permit，绑定context、当前target/P/M/N及代数；每页/每个Range消耗一个，随后必须再exchange，因而段间先控制。不接受任意URL或其他素材hash。manifest每页≤8动作且body≤4096B，绑定M/P/N/页号/总页；不让ESP驻留完整46包P。Range沿用If-Range/ETag/严格Content-Range、≤32768B、4KiB写块，每块重新动态session/lease/target检查，不跨await读视图；device最终F/CRC验证独立于HTTP。

read预算显式输入segment/exchange/cleanup/margin上界，未知时不发许可（NO_GO），不扩大TTL。需要剩余guard horizon覆盖本段、下一exchange、cleanup和margin；许可和请求都有绝对截止。样例参数仅宿主/虚拟测试输入，不是ESP硬上界，也不能据loopback max固定生产值。真正Flash维护/同步校验通讯让出、TLS峰值/可信时间/凭据仍待G1/G2。

## 取消、实际退出及隔离

实际HTTP owner无隐式排队、同时仅1请求/连接；共享Agent maxSockets=1/maxCachedSessions=0。绝对deadline/AbortSignal只使generation失效和请求abort；**实际I/O Promise退出前不清busy、不准新请求**，即使忽略abort。Node wire适配等待req.close，失败销毁/等socket.close；不把Promise.race超时当清理。失败blocked，重建前显式close完成，未解决控制回执不重试。生产重连退避/物理网络复原留A5，不在本轮自动启用。

服务端同session只1 HTTP占位，Range的async读写结束才释放；控制/新目标使旧read ticket失效，迟到块不能继续；清理/关闭需等实际handler退出。注入的迟到I/O负例必须证明超时后占位仍在。fixture清理server/Agent/socket/request/timer/PKI和自有目录，不能碰已有进程/端口。

## 验证、验收与回退

新增原创候选golden/严格JSON负例、队列/绝对截止/未知预算/uint64、两HTTP周期租约/accepted/播放和A3事实映射；单TLS/HTTP、分页/段间renew/cancel/latest、Range响应负例、错误身份/撤销/坏元数据、挂起/迟到清理、重连不重放。真实loopback最终F和原创241帧PET4全CRC可验，但不声称面板/实体Flash。运行check/test及自有隔离CLI和SIGTERM清理；保留515项回归。

回退关闭自有client/handler/coordinator/临时server与session/store，等退出再删PKI/目录；撤回专用入口即可，无service配置/设备/仓库格式迁移。A5实际生产装配、正式wire/真实包批准和G1/G2设备门槛不在本轮关闭。完成后更新当前摘要/差异/待办、按主题归档被替代记录。

实现细化：候选hello显式外层版本，不修改基础hello；read permit线上仅remaining_ms，宿主deadline私有，device从exchange发送前本地时刻按既有漂移预算收紧截止。自动重试0，超时在各准入点惰性检查；unknown写阻塞跨open保留至新known库存。A1资源actor/A2磁盘Range reader及默认service装配留A5。
