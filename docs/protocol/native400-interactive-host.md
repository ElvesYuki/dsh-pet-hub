# 400-14 临时交互宿主与私有审阅通道

2026-11-03。[Spec](../context/plans/native400-14-spec.md)/[Diff](../context/plans/native400-14-diff.md)、[报告](../reports/2026-11-03-native400-14.md)。仅原创临时源的离线候选，默认关闭，未安装到DSH，无真实设备或生产listener。复用[400-13控制器](native400-review-controller.md)、[400-12选择](native400-source-selection.md)与原reader/journal；不改设备wire、素材recipe或持久格式。

## 装配与可信方法

`prepareNative400SourceReview({...独立批准输入, createJournal, controls:{sessionMs,jobMs}})`：只有显式提供controls对象才交互；sessionMs默认300000、范围1–300000，jobMs默认30000、范围1–30000。原缺省只读descriptor保持；新增controls profile/预算进入sourceKey，同目录不同模式/策略不能attach或原地升级。clock/timers/beforeRead/beforeCheck仅可信运行依赖/离线故障注入，不是页面或配置参数，不进入sourceKey。只有UDS bind赢家创建原controller；attached无授权issuer。

owner的`sourceReview`包装保留`snapshot()`为原sourceReview/1，另有`resources()/idle()/close()`；交互owner不向外开放旧不带授权的review/revalidate/cancel。唯一可信能力入口是`sourceReview.reviewChannel`：

| 方法 | 语义 |
| --- | --- |
| authorize() | 可信宿主显式调用，发单会话与独立256bit随机review凭据，内存保存；不写descriptor |
| choose(credential, {file, expectedRevision, sourceName?, minimumSequence?, lifetimeMs?}) | 可信宿主提供明确私有文件，经原selector元数据捕获与原reader首读前绑定；异步实际退出前不可重选 |
| revoke(credential) | 撤销当前精确通道/会话，并取消该会话任务；旧凭据不能撤新会话 |
| request(token, method, path, body?) | 已授权私有RPC，仅以下三种；返回白名单结果 |
| close() | 立即失效通道，复用controller关闭且等待真实I/O退出，幂等 |

凭据交接给受信宿主内存中的`createNative400ReviewClient(client, credential)`。scoped client在建立请求前检查descriptor实例与expectedInstanceId，换主不发送旧凭据。会话/任务期限、一次选择/高水位/最近ACK/unknown门禁沿13，不靠拉长期限处理排队。

## 私有IPC与响应

所有UDS请求先核既有Bearer+X-Hub-Instance，再核X-Hub-Review。global `/v1/status`不含review凭据/选择引用，不发放授权。

| 请求 | 输入与返回 |
| --- | --- |
| GET /v1/source-review/controls | 返回`{controls, selection, sourceReview}`；selection为先前可信choose登记的私有引用或null，不创建/续期 |
| POST /v1/source-review/start | 原13闭合body：protocol/service_instance_id/reviewer_session_id/selection_id/request_seq/request_id/expected_revision/kind；仅返回受理ACK |
| POST /v1/source-review/cancel | 原13闭合body：protocol/service_instance_id/reviewer_session_id/job_id；返回取消待退出ACK或精确最近终态摘要 |

私有grant白名单为service_instance_id、reviewer_session_id、selection_id、selection_seq、next_request_seq、expected_revision、source_name、approval_inputs_sha256。纯core `native400ReviewEnvelope`重建并交叉校验session/selection/high water；grant不进公共hubViewModel或渲染树。start/cancel ACK分别校验；cancel `io_exited=false`不能写成任务结束。旧start ACK重发不能消费新选择。

POST在代理/UDS分别严格解析UTF-8/重复键/闭合请求，最多4096B，body独立2.5秒期限，超量不继续缓存；abort/body超期不创建任务。错误仅安全枚举；400无效请求、401未授权/到期、403代理来源拒绝、404无路由/默认只读、409冲突/任务截止、413超量、503结果/通道暂不可用。字节接收期限不替代13的会话或提交门禁。

无authorize/choose/approve/path/upload/reopen/repair/clear-lock的IPC或HTTP路径。opaque preparation不能从plugin config/ledger反序列化。

## 宿主代理与页面

程序化`createHostPlugin(client,{reviewAccess:{origin, resolve(req,{signal})}})`才注册三条对应HTTP操作。origin必须精确固定http(s)的127.0.0.1或[::1] origin，不能是localhost别名/任意网站/带路径凭据；Host每次精确匹配。GET也须resolve授权；POST还须精确Origin、Content-Type application/json、X-Pet-Hub:1；Sec-Fetch-Site若有须same-origin。resolve返回受信scoped client或空；解析body后及异步返回后再核卸载/abort。Origin、随机client_id与全局status均不产生权限。

默认`apply`仍只注入原客户端，无provider，页面操作404/只读。没有新CLI开关、配置项或自动启动。临时测试用内存随机cookie绑定单scoped client，证明的是该候选边界，不是DSH登录用户授权、真实浏览器cookie策略或原生picker。

共享组件只经既有transport/白名单代理读取选择和发start/cancel；无路径输入、fs/凭据读取、批准上传或设备指令。状态展示来源名/批准输入摘要、运行/取消待实际退出、终态/blocked，并保留独立只读source card。未授权/无选择/结果未知时禁用新操作。

一次start仅生成一次uint64 seq与随机request_id/body。网络/503或非法ACK保留私有pending，提供手动“确认上次请求”，重复完整body查原ACK，无自动写重试。明确拒绝后读取最新状态；轮询只读。generation隔离迟到poll，发现实例/审阅会话变化使旧pending不可确认。unmount取消自己的HTTP和timer，不取消共享任务；宿主卸载也不stop service或代替可信revoke。

## 退出、回退与待验

卸载自有proxy→可信revoke/close→等元数据/内容真实I/O退出→释放自有UDS。原源和journal保留；unknown须关闭后新实例历史重开与新批准/选择/复验，不删坏档/残锁、不开自动重试。若回只读，使用原prepare选项新实例重开；无格式/分区/现有配置迁移。

42项原创专项/独立临时CLI覆盖UDS/HTTP与构建设置槽JS hook宿主。**14阶段只验JS hook宿主；后续[400-15](native400-provider-review.md)已补独立浏览器/真实React DOM的既有链路验证与安装rc.5静态评审。DSH用户身份/native picker及交互DSH profile加载/重载/卸载仍未验**，旧P1只读结果不替代这些授权验收。下一400-16先做可信本地broker交接适配器，缺可信身份继续只读。真实用途/G0/N_boot/Flash writer/proof/可信时间与凭据/ESP TLS/G1-G2/24fps独立；外部仍400-06文件快照，无现场操作。
