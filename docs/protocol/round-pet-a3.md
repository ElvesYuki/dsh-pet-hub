# A3 单设备观察离线候选

2026-10-30。[Spec](../context/plans/round-pet-a3-spec.md)/[Diff](../context/plans/round-pet-a3-diff.md)、[46项专项报告](../reports/2026-10-30-round-pet-a3.md)。实现的是对象语义与只读管理界面，模型标识round-pet-observation-candidate/1；不是已协商设备wire，不能向当前v5发送。G0的C04–C07及实体认证装配仍待共同确认；[A4](round-pet-a4.md)/[A5](round-pet-a5.md)已另接真实loopback TLS证明与默认OFF共享owner。

## 受信owner与入口

core/RoundPetObservations构造注入caps、manifest、packageRef={namespace,firmware_package_sha256,hub_manifest_sha256}、clock及同步verifyObservation/sessionCurrent/controlCurrent。三个回调默认false；实际调用方应先由现有managed session/guard/A2完成身份、凭据、lease与来源批准，本模型不复制认证/证书缓存/续租。测试用WeakMap精确绑定对象proof，不是TLS设备证据。回调不得重入模型，Promise返回拒绝且消费其异步拒绝；输入在验证前复制，回调不能修改待提交原记录。

| API | 边界 |
| --- | --- |
| open(context,versions) | 受信owner提供完整7字段context；versions的profile/四流version均1才可操作，缺字段/旧版本仅diagnostic。未知version字段拒绝。新session清命令/查询/操作/流seq，不自动重放；同binding保留历史画面/root高水位，跨binding清除 |
| request(context,target) | 严格目标与revision高水位，产生requested；同当前命令同内容幂等，旧/冲突拒绝，不产生设备accepted |
| sent(context,target,control) | 仅当前目标和有效外部control，产生sent；不代表HTTP请求/设备已经执行 |
| query(context,kind) | display/inventory各1个。返回core生成的kind_uint64 ID，生命周期单调不复用，不接受外部指定ID；新查询替代旧查询。默认2秒相对期限只用于候选查询回收，不是实物延迟预算 |
| expectSave(context,operationId,target) | 登记已sent目标的保存操作，至多64；满时只淘汰终态。实际发送/租约检查由A4/A5受信协调器负责，这个登记不下发或授权设备写Flash |
| ingest(context,record,proof) | ≤4096B严格schema1对象，外部认证proof、完整context与流序列验证后更新；旧seq返回false，坏记录抛错且不推进流序列。不提供页面/HTTP注入路由 |
| disconnect/snapshot/resources/close | 断线使当前性失效，保留历史。session回调false或抛错后锁定离线，须新open才能恢复。close幂等清内存，无定时器/socket/worker |

四流版本键为playback_version/display_version/storage_version/inventory_version；profile=round-pet-native360/1。当前公开snapshot永远synthetic=true，并使用候选model profile。这里只支持一个设备，caps与素材仍遵守A1原生360固定约束。packageRef来自受信A2结果；reducer只核对关联，不重新批准P/许可。

## 四流候选记录

完整必需键和闭合校验在core/round-pet-observation-schema.mjs；[golden](vectors/round-pet-a3-state-v1.json)是原创对象状态向量，非C++/Node wire字节互验。

- playback.report：schema_version/type/report_seq/target/control/package_ref/phase/elapsed_ms/first_frame。phase沿用accepted/downloading/verified/playing/failed/cancelled/ended；playing需先verified及{refresh_generation,first_frame_seq}正uint64，其他phase的first_frame必须null。重复playing首帧标识不变、elapsed不倒退。终态或已被替代目标不能复活，control失效拒绝播放流。
- display.report：display_seq、kind(event/snapshot)、query_id、origin(remote/local)、asset_ref、source_command、refresh_generation/frame_seq、elapsed_ms、maintenance、display_state。remote event限当前非终态目标及控制权；snapshot必须匹配新查询，可以显示历史source但不补旧playback成功。local只观测4/idle0，不回发动作、不改base、不实现触摸寿命。unknown时asset/source为null，保留上次画面历史并标非当前。
- storage.report：storage_seq、operation_id、source_target、package_ref、status(saved/deferred/failed/outcome_unknown)、commit。saved必须有{evidence:root_commit,root_seq,object_generation}，其他commit=null。未知操作拒绝；终态重复必须同事实。晚saved只记原目标历史，不更新desired/actual；outcome_unknown使库存unknown并作废旧查询，不自动重试或假定未保存。
- inventory.snapshot：inventory_seq/query_id/known/namespace/root_seq/root_state/active。known=false时根/state=null、active=[]；known=true完整引用≤4、无重复、0/4与EMPTY/IDLE_READY/OFFLINE_READY一致、generation正且≤root。N固定但旧F允许存在；只映射同批准N/id/F/bytes为available。root不倒退，同root内容冲突拒绝；引用列表按ID规范化为集合比较，不改变包catalog数组顺序。

所有记录另有schema_version=1/type，所有seq/generation/root均uint64十进制串。每流单独高水位；所有读流仍需当前session/proof，但库存/查询事实不授予控制权。保存与库存同root时必须匹配同id/F/bytes/object_generation，矛盾消息拒绝不覆盖先前事实。已有新根的晚旧saved不让库存退回；新saved根使旧库存unknown，重新查询。

display是实际画面权威；playback的playing不直接更新actual。refresh/frame高水位拒绝旧帧，held_last_valid之后恢复playing须更高refresh_generation，防维护前晚帧解除冻结。维护同帧连续held的elapsed保持；host时间不累加动画elapsed，不根据loading/保存请求自行确认暂停。该刷新代数规则是候选防错约束，须C06确认设备钩子，不能称已实现物理刷新。

## 公共状态与只读界面

core/observation-view提供共享白名单，runtime/status→宿主代理→UI逐层重构嵌套值；只传device ID、目标动作/revision、本地request状态、播放phase/首帧序列、实际来源/相对elapsed、维护、16条存储简表和46个素材可用/最后确认项。完整context/control/proof、原始record、P/F全库或路径不出IPC。矛盾状态拒绝；UI坏候选显示明确错误，不降级为已确认设备。

库存断线或诊断时offline_available=null，last_confirmed_available仅历史；saved文案明确历史，不表示永真库存。实际画面is_current=false时标“最后观测，非当前”；维护明确“保留最后有效画面，动画已暂停”。没有从首帧推算面板FPS/时间，也没有候选播放/保存/触摸按钮。

service内部observationReview={id,create}仅允许deviceMode/source disabled，不与managedSessions/import/simulation混用；id参与选主配置匹配，只有UDS赢家执行create，close释放owner。没有CLI、插件Config或自动启用入口。现有GET status多一个observationReview字段、顶层devices仍为空、deviceTransport=false；宿主只增加GET白名单。默认服务响应无该字段；现有旧Registry仍是simulation参考，不转换其本地accepted为新设备回执。

资源上限：命令256、操作64、历史16、查询2、四个流高水位；core生成查询ID不保留历史集合。持久root高水位仅进程内证据，非新磁盘格式或设备防回滚。close清全部内存引用，A1/A2/既有选择与服务配置无迁移。

## 验证与回退

```sh
node scripts/verify-round-pet-a3.mjs --output .cache/round-pet-a3/results.json
npm run check
npm test
```

CLI只构建候选、创建自有临时UDS/loopback代理与进程组，不安装插件或触达现有服务。46项专项、全套515项通过；A3阶段未重新加载真实DSH/浏览器；后续[A4](round-pet-a4.md)已验证loopback TLS request proof接入reducer，设备首帧/触摸/持久提交仍未验。

回退关闭临时review服务、撤回内部工厂；旧simulation、A1/A2/scoped和外部固件/pet/bridge/DSH保持。下一A4先补实际device-pull/队列/截止的Spec/Diff和离线交互；共同wire与G1/G2未通过前不装配生产通道。

## A5私有库存视图

inventoryState()只供受信owner返回当前session已known的完整root/active副本，否则known=false；不在publicObservationView/UDS/UI暴露。A5据此计算旧F仍占用的活跃槽和显式victim，不从已批准映射的offline_available=false反推空槽。原四流版本/公共投影不变。

## A7检查点交接

构造可选rootCheckpoint及内部rootCheckpoint()导出见[A7](round-pet-a7.md)：绑定scope、floor、最后完整根、尚未查询saved的对象证据。新owner库存仍unknown，同root/提交对象冲突与低root继续拒绝；检查点不复活命令/控制/历史回执。仅受信临时caller交接，非签名批准/生产持久化，不进入公共view。

## A8事务候选

prepareIngest/commitPrepared/discardPrepared仅受信持久路径使用：验证候选后恢复旧投影，至多一个opaque ticket，公开读取在候选期间拒绝，close丢弃。磁盘CAS和当前session/截止通过后才发布；旧ingest路径保持。详见[A8](round-pet-a8.md)。
