# 400-14 Spec：默认关闭的临时交互profile、IPC、代理与共享界面

状态：2026-11-03已完成本页离线范围，见[报告](../../reports/2026-11-03-native400-14.md)。真实浏览器/DSH身份/native picker仍待验；原实施前边界如下。

2026-11-03，实施前。依赖[400-13内部控制器](../../protocol/native400-review-controller.md)/400-11契约。已核AGENTS/README/context/规则与既有service/客户端/宿主代理/React设置槽。保留修改、不用子智能体；仅原创临时文件、私有UDS、动态loopback代理及隔离宿主验证，不读真实素材/cache/固件/备份，不接设备/生产listener、不安装/烧录/提交推送，不改现有DSH/pet/bridge配置或服务。MIT新代码、零项目依赖。

## 具体装配与权限方案

- 复用prepareNative400SourceReview的opaque选项，新增显式controls策略（默认无）。独立controls profile/策略入sourceKey，同目录只读与交互/不同预算不能attach。只bind赢家创建400-13 controller和私有通道；旧descriptor/只读API默认行为保持，无CLI/plugin config开关。
- 只有service owner返回的可信本地方法可authorize、choose显式私有路径、revoke；IPC/HTTP不提供发放授权、选任意文件、批准上传、reopen/clear-lock。选源仍复用400-12；metadata hook/任务退出由controller负责。
- 私有review通道为独立随机256bit凭据、单会话，owner经受信交接持有，绝不写descriptor/磁盘/global status/DOM/URL。UDS仍需原Bearer+实例，再核review凭据；scoped client固定expectedInstanceId，descriptor换主前拒绝，不把旧凭据送新实例。
- 新IPC只GET controls及POST start/cancel。私有GET可返回此前可信登记的选择引用，不新发选择/续期；start/cancel闭合body仍由controller核，严格JSON/4KiB与独立2.5秒body期限；超过期限/取消只退出本次请求，不生成任务。受理不是完成，body同seq重发走原ACK去重。
- 宿主代理仅程序化注入reviewAccess（固定loopback origin+受信resolver）时提供新路径。GET也必须被resolver授权；POST另需精确Origin/Host、JSON/X-Pet-Hub和Sec-Fetch-Site（若有须same-origin）。Origin/client_id不产生身份。无resolver/无权限/卸载后失效均拒绝，默认apply不注入，现有DSH继续只读。
- 临时验证resolver使用独立私有页会话/随机cookie绑定到scoped client，经真实HTTP检验，不能将其写为已核DSH用户身份/native picker。provider缺失时明确只读；实际原生选择和DSH权限交接仍另验。

## 共享界面与异步不变量

新增共享审阅操作组件，经既有transport/白名单proxy调用，界面不读fs、不拼授权、不输入路径。显示可信宿主选定的安全来源名、用途/批准输入摘要、历史/当前复验、运行/取消待退出/失败/unknown；显式“开始审阅”“按历史复验”“请求取消”，未选择/未授权/unknown时禁用。选择引用留transport/组件私有内存，不进渲染模型或DOM。

每次start生成一次固定request_seq/request_id/body，网络/503结果未知时保留原请求并提供手动“确认上次请求”，不自动换ID/重试。ACK/终态和source view分别核验；定向cancel只用显示对应job，迟到响应/轮询用generation fence。HTTP断开/unmount只取消自身请求/定时器，不误撤共享任务；可信宿主显式revoke才取消授权。关闭服务等真实I/O后释放UDS。

全局status只含原sourceReview/1，无review凭据/选择引用。新增私有响应由core白名单重建，非法/过期/跨实例失败关闭，不回旧current，不泄路径/批准正文。浏览器字段不替代设备证据；device_evidence=false始终保持。

## 验证与验收

原创28MiB实际controller/selector/reader/journal→真实UDS→临时HTTP私有resolver→共享JS宿主/可用浏览器验证：单owner/身份互斥、只读默认404/不自动授权、额外凭据/实例固定、坏token/过期/跨scope、Origin/Host/fetch-site/JSON/超限/未知字段拒绝、全局/DOM无秘密、实际review/revalidate/取消/unknown/历史重开、丢受理响应同body确认不重读/重写、迟到/unmount/代理卸载不误伤、元数据与内容I/O实际退出。静态构建包含组件，无安装。

先专项/独立CLI，再npm run check（语法）与npm test（含构建），仅新问题重跑。若浏览器依赖不可用，明确只验证JS宿主，不用模拟树冒充真实DOM；不得安装依赖/改本机服务来补证明。400-03固定字节、400-07和13逻辑不重做。

## 回退

先卸载自有临时代理/撤私有会话，再close owner等待实际capture/read退出；源与journal保留。未知提交/坏档/残锁不删不重试，已提交不回滚。以原只读选项新实例重开，不原地升级权限，无持久格式/设备分区/现有配置迁移。恢复实际集成前另备具体窗口与回退。真实用途/G0/Flash/TLS时间凭据/资源/G1-G2/24fps仍独立，外部沿400-06快照。
