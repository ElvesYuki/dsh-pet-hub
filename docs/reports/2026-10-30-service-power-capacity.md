# 服务装配、电源源与会话回收评审

2026-10-30。按用户授权先写[Spec](../context/plans/service-power-capacity-spec.md)/[Diff](../context/plans/service-power-capacity-diff.md)及回退，实施契约见[协议](../protocol/service-power-capacity.md)。仅独立临时存储/UDS/loopback TLS/自有进程；不接设备、不改固件/pet/bridge/DSH配置，不安装插件/系统服务、不提交推送。并行角色宿主工作保留。

## 已确认结果

- 现有startOrAttach在赢得UDS后装配元数据、session-runtime和电源源；真实两进程竞争只有一个owner/一个观察源，attached只读连接、detach不影响owner。默认无managed装配，CLI/插件无自动开启入口，deviceTransport=false。
- 公开配置摘要进入sourceKey；不同信任/模式拒绝，字段顺序不同仍可attach。初始化ready门禁和单一5秒managed attach abort已验证；未知/损坏旧元数据不自动迁移，初始化/释放失败也清自有UDS资源。
- 实现macOS IOKit只读观察helper，临时clang编译后接入真实服务owner，收到ready，关闭确认子进程退出及二进制目录删除。没有触发电脑睡眠或修改电源设置。
- 受控电源源验证暂停→租约/任务失效→新TLS/hello/acquire；可信时间未知保持blocked，观察源坏帧/失联后不自动恢复，关闭后迟到事件不复活旧权威。
- managed一次性admission替代生命周期历史集合，320次真实TLS重连越过旧256上限，回收与旧proof/context拒绝通过；旧直接context路径保留默认256防重放限制。

## 验证与环境

| 检查 | 结果 |
| --- | --- |
| npm run check（仅.mjs语法） | 通过 |
| npm test（含候选构建） | 376/376通过 |
| 本轮专项 | 17/17通过：服务选主/装配/回滚、电源源、native注册、320重连与admission |
| P1＋原会话＋原TLS专项回归 | 51/51通过 |
| 隔离CLI取消 | interrupted=true、passed=false、临时根已删除 |

测试不重复计算：专用CLI复用上述验收；全套还包含并行角色工作，不把其增量算成本切片。未重复未受影响的浏览器、真实素材全库或30分钟墙钟测量。C helper通过本轮真实编译检查，check本身仍仅检查.mjs，不是C/架构/契约自动门禁。

执行Node24.14.1/npm11.11.0、Node OpenSSL3.5.5，macOS arm64；native测试使用现有Apple clang21.0.0（clang-2100.3.34.2）、SDK27.0，-std=c11/-O2/-Wall/-Wextra/-Werror，链接IOKit/CoreFoundation。运行时不自动编译或下载。新代码/原生helper为本仓库MIT，无上游实现/动画复制。实际API依据本机IOPMLib.h/IOMessage.h；官方在线文档检索服务本轮不可用，未据此推定其他宿主版本兼容。native源SHA256为91d6a087b509ec82d29d21caf3b6896306c6163c97428d5d285a883b4132d060。

## 负例与回退证据

覆盖并发/跨进程选主、配置不匹配、默认禁用、缺失/坏元数据、源启动失败、半初始化503、坏disposer仍释放所有权、挂起已有UDS超时不回收；状态不暴露指纹、路径、nonce或秘密。电源源覆盖严格顺序、坏起始/字段/UTF-8/超长、错误序号、EOF、启动超时和不存在的可执行文件；坏源保持blocked，无后台自动重启。

TLS固定P-256/TLS1.2候选继续沿用；320循环每次确认managed session/pending/task均为0、历史集合为0，测试末旧proof/context和伪造admission不能授权。最终全套运行中的固定串行case观察约1.61秒；这只是本机并行测试环境的一次短样本，不构成吞吐或调度保证。隔离CLI还记录observed_wall_ms（包括编译、负例等待和整个测试过程），不能代入租约预算。

首轮隔离CLI根嵌套后超过既有UDS路径上限，已缩短本轮临时测试前缀并重新验证；没有放宽生产路径检查。初始化关闭采用共享Promise与逐资源收尾，即使power disposer失败仍释放会话、存储和UDS；不吞错。退出清理通过自有资源/进程，未按端口结束其他服务。

所有正常测试的TLS/socket/请求/定时器、会话及UDS已关闭，power helper退出，临时编译目录删除。取消由独立POSIX监督器终止自有测试进程组并确认临时根删除。结果仅在.cache/service-power-capacity忽略目录，不记录运行端口、证书原文、私钥或原始状态。回退按Spec停准入→关源/helper→关会话/TLS/UDS→删本轮临时目录；现有绑定/角色及外部配置无需恢复。

## 未覆盖与下一入口

未验证真实电脑睡眠前Node能否及时清权威、唤醒与网络事件先后；IOKit observer先确认系统通知，不能据ready声称物理时序安全。没有睡眠/veto/assertion操作。正式发行helper签名/打包、Electron/其他OS适配、系统密钥/时间、旧数据迁移、生产LAN listener、16设备满载、多日内存及每块证书/磁盘查询负载仍待验。

下一先准备物理主机睡眠/唤醒验证的具体方案、可观测事件与回退，再评审实际承载队列/复验成本和签名/秘密引用；不自动睡眠或启用现有服务。175C v5能力/设备事务、Flash安装/激活/掉电与ESP TLS资源另按门槛推进，1900ms/500ppm仍非实测，NO_GO_UNTIL_MEASURED保持。被替代的装配/OS源/256历史集合当前描述见[归档](../context/history/service-power-capacity-evolution.md)。
