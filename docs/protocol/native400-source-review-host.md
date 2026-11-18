# 400-10 临时宿主来源审阅装配

2026-11-03。仅内部显式候选，[Spec](../context/plans/native400-10-spec.md)/[Diff](../context/plans/native400-10-diff.md)。复用[400-09 journal/owner](native400-source-review-storage.md)、原service UDS选主/鉴权客户端/宿主代理及共享slot，不另建认证或设备承载。无新CLI参数、插件config或自动启动；没有生产listener/设备/真实素材/固件读取。本仓库新代码MIT。

## 准备与赢家创建

`prepareNative400SourceReview({package,catalog,approval,mappingApproval,createJournal=false,beforeOpen?,fault?})`只校验/快照四份独立输入，不访问文件。复用400-08 inspector核身份/用途/许可边界；两份批准仍由调用方给出。返回冻结的模块内WeakMap识别对象，不可JSON序列化恢复，不接受任意id/create回调。相同规范内容即使key顺序不同也相同身份，后续修改原input不影响已准备选项。beforeOpen/fault仅内部测试注入，不入配置或磁盘批准。

`native400SourceReviewDescriptor(option)`返回schema1/profile `native400-source-review-host/1`/scope `offline-source-review`、`inputs_sha256=SHA256(C({package,catalog,approval,mappingApproval}))`与create_journal布尔值。描述进入既有service sourceKey，磁盘仅sourceKey哈希，不含批准原文或源文件选择。profile、输入、create策略不同，同runtime不能attach；新实例重开可明确换create=true为false，但仍须原批准匹配历史。

`startOrAttach({directory,sourceReview:option})`要求显式非空目录，deviceMode/source mode均disabled，且无materialImport/managedSessions/observationReview/roundPetAssembly。默认模式未选择该选项，仍无sourceReview status字段/账本。仅bind成功的赢家调用工厂，路径固定为服务私有目录下`native400-source-review/`；createJournal默认false，无目录/文件就失败，不隐式创建；显式true才创建该子目录和空journal。非私有/符号链接、坏档/残锁不修复，启动失败保留字节并清自有UDS/descriptor。

赢家返回的`hub.sourceReview`是原400-09 owner，内部代码可显式调用review/revalidate/cancel；attach者不返回owner，仅既有client和无副作用close。工厂本身是运行层内部入口，由service约定仅赢家调用；选主保证不等于防恶意同用户代码直接调用其他API。

```js
// 只示意程序化装配；不是可直接运行的命令或已批准的真实输入。
const option = prepareNative400SourceReview({...independentInputs, createJournal: true});
const hub = await startOrAttach({directory: explicitPrivateTestDirectory, sourceReview: option});
// 无源扫描/自动复验。只有赢家的可信内部调用才可显式指定源：
// await hub.sourceReview.review({file: explicitPrivateOriginalFixture, expectedRevision: '0'});
// await hub.close();
```

## status、代理与界面

仅GET `/v1/status`可用；新模式下其他所有IPC路由404，包括旧PUT config、POST source/page、素材/角色/模拟写路由及虚构review/revalidate路由。读取status只取owner快照，不读源或journal、不推进revision。phase=`400-source-review`、source=disabled、deviceMode=disabled、devices=[]、capabilities.deviceTransport/bleProvisioning=false，session/role/catalog未装配。

服务用publicNative400SourceReviewView重建sourceReview；坏/空快照503 `source_review_unavailable`，不缓存回旧current。代理沿原GET `/dsh-pet-hub/status`再次重建该slot，明确带null/非法内容503安全通用错误；私有扩展丢弃。原serviceInstanceId仅作既有请求代数，不暴露descriptor/token/sourceKey、源路径、批准原文或设备上下文。

共享UI采用原400-09只读slot，页面阶段标题为400来源审阅候选；本次端到端是构建JS候选在JS宿主发真实fetch→临时动态loopback代理→鉴权UDS→owner快照，再渲染文本树。未使用真实浏览器/DOM、DSH profile或安装插件，不据此宣称发行宿主兼容已验。页面没有选文件、批准、review/revalidate/cancel或设备控制入口。

重开只显示historical；原source缺失也能读历史，显式revalidate才读取并失败，不能自动退回“当前”。失败/取消/unknown投影均保来源证据等级，media_validation=not-performed/device_evidence=false，不变设备actual/saved/库存。current仅指某次完整源检查，不持续监听源文件/另一owner写盘。

## 退出、并发与恢复

ready=false或closed时status503。初始化beforeOpen测试gate期间已绑定UDS/写descriptor，但不提供current；attach等待就绪，不初始化第二owner。复用原5秒attach总计时器/单IPC 2.5秒超时，未知/挂起socket超时后失败，不删除socket/descriptor、不重试抢占。JS event loop/同步I/O停顿仍非硬墙钟上界；测样本仅宿主观察。

service.close幂等：先置closed/ready=false，先调用owner.close立即失效任务，等待真实reader/hook退出，随后停止disabled source、删除自有descriptor并释放UDS；不因timer/abort返回便假退出。等待期间既有status503，UDS仍被占用，旧任务不提交/发布current。挂起的底层I/O需真正退出才能完成close，没有强制接管/硬终止保证。

attach.close、HTTP客户端取消、临时代理卸载只释放自己的请求/注册，不关闭或取消共享owner。新服务实例有新instanceId/token，旧descriptor鉴权401；正式设备session/fencing并未因这个宿主代数实现。

unknown继续遵循400-09：当前owner冻结，显式close后新实例读取已提交或旧历史，重新提供批准/实际源复验；坏档/残锁不自动修复。初始化失败清IPC而不删除journal目录/历史；没有盲重试或物理断电恢复承诺。

## 复现、回退与下一入口

先`npm run build`，再`node scripts/verify-native400-10.mjs --output .cache/native400-10/results.json`。只用原创MIT sparse28MiB/.fixture和临时私有元数据，双进程测试原批准仅在自有临时根，不入Git。CLI监督子进程组并清理环境；不探测运行DSH/pet/bridge或设备。

回退顺序：卸载自有临时代理→cancel/close自有赢家→等待busy=false/open_files=0与UDS释放→保留源和journal，必要时隔离自有目录。unknown或残锁需人工核定，不能强删或复用现有服务目录。撤回sourceReview装配分支即可回400-09内部owner，无格式/分区/配置迁移。

后续[400-11操作评审](native400-source-review-controls.md)、[400-12内部选择](native400-source-selection.md)和[400-13控制器](native400-review-controller.md)已完成相应离线范围；[400-14](native400-interactive-host.md)另加显式默认OFF交互profile/私有IPC/受信临时proxy/UI。本页原400-10缺省只读行为保持，无provider不发权限；真实浏览器/DSH身份/native picker仍待验。无任意路径/自动批准/扫描或账本修复。共同G0、真实用途、N_boot协议/当前库存、Flash writer/proof、可信时间/凭据/TLS、G1/G2/24fps仍另审，外部沿400-06快照。