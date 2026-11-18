# hub-device/1 管理消息契约

2026-10-30首实体闭环采用待共同定版的[round-pet-native360/1提案](round-pet-single-device-v1.md)：schema2执行／Flash、保存库存和维护冻结不能直接套本页旧四RAM槽模型。现有实现状态见[差异表](../context/round-pet-hub-baseline-alignment.md)，新增字段尚未实现。

版本：0.1设计草案，2026-10-29。**本仓库已实现S1离线参考模型，现有固件/生产transport均未实现此协议。** 本文用于下一轮离线模拟；不是已开放HTTP API。PET4是文件编码、旧bridge v4是单设备接口、hub-ipc/1是本机IPC，三者独立版本。

## 1. 承载与认证边界

以下为逻辑消息名，不是HTTP路径；不默认设备提供HTTP服务器，也不默认继续旧轮询。承载适配器负责分帧、认证、机密性/完整性和连接限制，core只接收校验后的消息及可信peer上下文。裸JSON的device_id、认证布尔值或广播不是身份凭据。模拟器的可信认证fixture不得进入生产transport路径。

- 发现候选只能进入discovered，经过设备侧限时确认、密钥证明及绑定持久提交后才进入bound。P1实验可用明确授权的USB开发绑定；不能省略为“首次连接自动绑定”。
- 设备与controller双向校验对方，拒绝重放；秘密、任务正文、SSID和密码均不属于消息摘要/普通日志/UI。Wi-Fi配网另立P2协议。
- 未绑定、认证失败、协议不兼容不得注册为online或下发命令。认证失败使用认证层通用错误，不向未认证方泄露设备详情。
- 承载/认证未决前不得以明文Bearer或验证码代替安全通道上线；旧v4明文共享Bearer不继承为新协议的安全性。

## 2. 类型与通用信封

UTF-8 JSON仅为模拟参考编码。标识符为1–80字符ASCII `[A-Za-z0-9_-]`；摘要为64个小写十六进制字符。设备/boot/controller/service/session/command/report/operation标识均用密码学随机源生成，生产不得使用示例短名。

`binding_epoch`、`control_epoch`、`revision`、`seq`为规范非负十进制字符串（除0外无前导0），最大2^64−1；不得转JS Number比较，模拟器用BigInt。溢出须显式拒绝，不能回绕。时长和像素/字节数为有界整数；不以设备/主机墙钟决定所有权。

| 字段 | 作用 |
| --- | --- |
| protocol | 恒为hub-device/1；协商不相交时拒绝，不自动降为v4 |
| type / message_id | 消息类型/传输去重追踪，不等于command_id |
| device_id | 设备持久随机身份；IP/MAC/名称均非主键 |
| boot_id | 设备每次启动更新；复用旧boot消息拒绝 |
| binding_id / binding_epoch | 双方绑定关系/凭证代数，撤销后旧epoch失效 |
| session_id | 每次认证重连由设备确认的新会话，旧连接消息拒绝 |
| payload | 按type解码，未知必需版本/消息拒绝；可选扩展只允许放extensions且有大小上限 |

hello协商前仅能提供认证所需的最小身份线索，不按未认证hello更新注册表。认证成功后device.hello确认boot及session；其余消息必须匹配可信上下文中的device/binding/session，不能只按信封内容选设备。

action_id为0–2^32−1整数且必须存在于角色包；duration/elapsed/uptime_ms为0–2^53−1安全整数，单次命令/交互时长另受业务上限约束。

建议控制消息最大16KiB、嵌套深度8、extensions最大1KiB。注册表只保存允许字段；设备拒绝超过能力/编译预算的输入，不能因合法JSON无界分配。大文件单独流式传输，不塞入控制消息。

## 3. 身份、绑定与重连

| 标识 | 保存位置/重启语义 |
| --- | --- |
| device_id及身份密钥 | 设备持久；普通重启保持，恢复出厂换身份/重新绑定 |
| controller_id及绑定秘密引用 | 服务私有持久元数据/系统安全存储；插件与未来独立应用共享 |
| service_instance_id | hub每次启动更新，区别同controller的旧进程 |
| binding_id/epoch | 双方持久；解除/重配递增epoch并撤销旧凭据 |
| boot_id/session_id | 设备启动/认证重连更新；session只存内存 |

暂态IP变化仅重新认证/协商，不新建身份、不重写Wi-Fi。相同device_id但密钥证明不匹配为identity_conflict，不能覆盖原绑定。能力报告变化更新带摘要的快照并重新匹配素材，未知字段不启用外设。

解绑为持久操作：管理端先写pending_revocation，立即停止新命令；设备认证处理binding.revoke(operation_id, expected_epoch)，持久写撤销标记/新epoch后确认，随后管理端清秘密引用并保留最小撤销记录。幂等operation_id不重复递增。应答丢失后旧凭据失效不能被解释为“已确认解绑”；若未取得可信撤销回执/后续身份确认，UI显示“设备撤销未确认”，由设备侧确认或重新配对收敛。

离线移除只为本机forget_pending，不能标成设备已撤销；不得删除唯一恢复信息后假称安全解绑。恢复出厂走物理确认，旧注册记录标成失效，不合并新旧身份。

## 4. 能力与角色包

能力快照schema1保留旧模拟兼容；schema2在离线核心已实现，新增presentation_modes及RAM/Flash分层，见[素材变体契约](material-variants.md)，尚未在固件上协商。schema1包含：schema_version=1、支持协议/编码、firmware_version、board_profile、display(width,height,shape,pixel_format)、cache(slots,slot_bytes,persistent)、max_asset_bytes、可用inputs/outputs、可处理的消息/同时下载上限。未知扩展不视为启用能力。

当前正式目标为175C原生360 production，**期望而非自动填充**：屏幕466×466/circle、素材360×360/RGB565/PET4；源码单动作压缩RAM缓冲5865472字节、V2 Flash四激活加一暂存，须分别报告volatile播放容量与persistent素材容量，不能套旧四PSRAM槽模型。素材最大长度、实际安装范围和持久能力须由已认证设备能力报告确认，不从构建目录自动授予。旧128的240/四槽仍作历史兼容profile；输入按固件实际报告触摸，无音频/IMU默认值。能力不兼容则标unsupported，禁止静默缩放/重编码/降画质。

角色目录独立于设备：character_id、package_version、manifest_sha256、屏幕/编码变体、action_id及帧数/fps/文件大小/sha256、语义映射、许可/来源元数据。首版46动作沿用0–77原编号子集，不能按数组顺序重新编号。实际清单来自审核过的本地manifest，不复制动画或任意URL到配置。

原catalog-lossless语义核对：idle=0/thinking=1/working=11/result=43/success=58/waiting=7/error=55/touch=4；不得误用早期五动作STATES默认映射替代最终角色包。正式调度始终由包manifest验证映射完整性，未列出的动作拒绝。

## 5. 消息及方向

H=唯一hub服务，D=设备。响应与请求用message_id关联；认证/绑定/控制状态不匹配先拒绝，再处理业务。

| 消息 | 方向 | 核心内容 |
| --- | --- | --- |
| device.hello | D→H | 身份/boot/session确认、能力与能力摘要、当前控制epoch、实际播放摘要 |
| control.acquire | H→D | controller_id、service_instance_id、operation_id、expected_control_epoch |
| control.granted | D→H | 当前epoch、lease_id、设备允许lease_ms、当前session |
| control.renew / release | H→D | 匹配全部控制上下文；release幂等，不清绑定/素材 |
| device.heartbeat | D→H | seq、uptime_ms、控制lease状态、实际播放/下载/缓存摘要 |
| playback.set | H→D | 控制上下文、command_id、revision、角色包/变体/动作完整身份、意图 |
| playback.report | D→H | report_seq、目标身份、阶段、错误/打断原因、设备播放已用时 |
| interaction.report | D→H | 独立递增seq、去重event_id、本地触摸/恢复标记 |
| binding.revoke / revoked | H→D / D→H | operation_id、expected_binding_epoch、持久提交结果 |

## 6. 设备端控制仲裁

Unix socket保证同目录的hub唯一，不足以阻止另一目录/旧进程下发；设备必须最终仲裁。

1. 新认证session起初无控制权；acquire只有匹配当前binding、expected_control_epoch且无有效异主租约才能成功。
2. 设备把control_epoch递增并持久提交**后**才发granted，生成内存lease_id并绑定controller/service_instance/boot/session。持久失败拒绝，不能先授予后补写。
3. 活跃租约仅同一持有者renew；其他service_instance即便controller相同也返回lease_busy，不通过“我是更新进程”抢占。新进程等过期或显式设备侧确认，不能靠更大自报epoch夺权。
4. 同session下同operation_id的acquire重试仅在原lease仍有效时返回原grant，不重增epoch；原lease已过期/释放则返回lease_expired，新申请必须用新operation_id；不同请求若expected值过期返回stale_control。重启后旧operation不能复活旧lease；重新hello再申请新epoch。
5. lease_ms允许5000–30000，默认15000、每5000ms续租，以设备单调时钟计时，范围后续实测调整；续租不写NVS。acquire/撤销等持久提交才写，需测写入次数和掉电恢复。
6. 租约到期/释放/认证session断开即禁止新远程控制；已完整校验的当前缓存动画可继续。不得继续自动串入旧队列。新会话需要重新申请控制；boot变化使全部旧session/lease失效。
7. 命令和回执都必须匹配binding、boot、session、controller、service_instance、control_epoch、lease_id。超时旧消息、旧服务复活不能改变新会话状态。

## 7. 目标、下载与播放回执

playback.set必须提供command_id、revision、character_id、manifest_sha256、variant_id、action_id、asset_sha256。revision仅在当前控制租约内严格递增；切换到同一action但新revision表示明确重播。首版不承诺offset续播或跨包预取。

- 同command_id同内容重发：返回当前阶段，不重启下载/播放、不重置展示计时。同command_id不同内容：idempotency_conflict；不生成第二命令。
- 新目标替代旧目标时取消过时下载，旧verified/playing回执不得推进最新目标。旧RAM模型目标未就绪时保留旧缓存播放；当前原生360 load/persist会冻结，首闭环按新profile展示最后有效画面／维护中，并分开desired与actual，不能用“请求成功”冒充已播放。
- accepted→downloading（可跳过：缓存命中）→verified→playing；任意非终态可转failed/cancelled。ended仅用于明确单次完成；循环不每圈创建新command。乱序低report_seq忽略；终态不能被迟到playing复活。
- verified必须完成文件长度、SHA、编码/头/尺寸/fps/偏移等格式校验。SHA不是签名或认证，必须与经认证目录相匹配。失败丢弃候选，不替换旧播放槽。
- **playing定义：解码成功且首帧实际提交给显示刷新路径后**，报告该命令首帧提交；不是下载结束、绑定decoder或入队成功。此定义仍不宣称面板物理扫描已经完成。
- 展示计时从该命令playing开始；设备报告elapsed_ms（单调相对时长），hub用本地单调收包时间及有界elapsed估计，不用墙钟。重复playing不重置，重连后无可信elapsed则展示进度未知/等待新命令，不能伪造连续时间。
- PET4当前四槽保护正在播放槽/已缓存目标，其他LRU；不把缓存模型当永久存储。失败继续已验证当前缓存，冷启动无缓存不得声称离线可播。
- 素材请求只引用经验证manifest中的摘要/ID；下载仅走认证的asset通道，禁止设备请求任意主机URL、路径穿越或将DSH loopback地址暴露到LAN。首个实现每设备最多1个下载，控制/心跳不被大文件阻塞。

## 8. 调度、本地输入与心跳

调度优先级：设备物理安全/本地用户接管 > 有冷却的临时触摸（默认冷却1秒、去重event_id；单次上限30秒，实际完成时长来自包manifest，超时恢复基础目标） > 当前手动预览 > 自动pet语义 > 空闲。手动模式不被新来源覆盖，触摸结束回最新手动/自动目标，不回旧修订。状态源断开后2秒宽限维持当前展示，超过宽限停止过时任务续播并提出空闲目标；手动保持，触摸按本地规则结束。source_status和device_status分别显示，空闲null是合法已连接语义。

心跳5秒；超过15秒无**新的有效seq**标stale，超过30秒offline，均以hub本地单调时间计时。过期/重复/乱序seq不刷新在线时间。心跳能证明认证会话活性，不能替代playing回执。心跳只含资源/动作摘要，不含任务正文或网络秘密。

重连退避1/2/4/8/16/30秒加抖动；恢复需认证→hello→能力重核→acquire→查询实际播放摘要→按当前意图收敛。暂态IP或连接变化不销毁绑定，旧session回执全部拒绝。schema1设备重启清PSRAM槽；schema2须重建单RAM工作集并恢复有效Flash root，不能清空持久库存。两者均重建boot/session、核对素材；hub重启保留绑定/用户映射，清瞬态队列和计时，不复用旧lease或盲重放持久队列。

### 服务侧用户意图（未来IPC，不是已开放路由）

设备命令只能由服务从已接受意图生成。插件与独立客户端提交intent_id、client_id、device_id、expected_intent_revision及kind（manual/auto/stop_preview），不直接提交control_epoch/lease或任意素材URL。服务为每设备维护intent_revision：相同intent_id同内容重试回原结果，相同ID不同内容拒绝；不同客户端同时修改相同expected值只有一个成功，另一方明确revision_conflict并重新读状态，不能静默覆盖。intent_revision与设备命令revision分开；自动来源更新也在同一设备串行调度队列中处理，但不覆盖manual模式。

意图去重缓存仅当前service_instance有效，客户端重连必须先核对实例；旧实例请求不允许跨重启盲重试。绑定/角色映射等用户配置持久化，当前下载、播放命令、lease和计时不持久重放。重启后的手动预览先显示“需重新确认”，不自动重发；已缓存actual状态需经过新认证会话核实。

## 9. 拒绝语义

协议业务错误码固定：unsupported_protocol、invalid_message、identity_conflict、stale_binding、stale_boot、stale_session、lease_busy、stale_control、lease_expired、unknown_action、incompatible_asset、idempotency_conflict、stale_revision、revision_conflict、asset_integrity_failed、storage_failed、revocation_unconfirmed、sequence_exhausted、capacity_exceeded、cache_busy。承载自行映射状态码，不能沿用“HTTP 200都算成功”。

对未知必需schema/超限/未认证输入不改变注册表、租约、计时或目标。明确拒绝结果与丢失应答分开，超时仅重试幂等操作；不能自动解除绑定、降级v4或覆盖用户配置。

## 10. 模拟/实物门槛

S1已实现纯内存device actor、虚拟单调时钟、认证fixture和可控丢包/乱序/持久写失败模型；[模型结果与未覆盖项](../reports/2026-10-29-s1.md)单独记录。覆盖[验收清单](../context/plans/device-simulator-acceptance.md)后才装配simulation模式；模拟不能证明密钥交换/TLS/NVS耐久、真实帧率和蓝牙能力。

## 11. 合成消息示例（非真实凭据/配置）

下例的短标识和全零摘要仅用于测试，不代表真实素材。完整信封头由认证会话确认；payload.control必须与device当前grant一致，不能靠消息自行授予。

```json
{
  "protocol": "hub-device/1",
  "type": "playback.set",
  "message_id": "fixture_message_1",
  "device_id": "fixture_device_A",
  "boot_id": "fixture_boot_A1",
  "binding_id": "fixture_binding_A",
  "binding_epoch": "1",
  "session_id": "fixture_session_A1",
  "payload": {
    "control": {
      "controller_id": "fixture_controller_C",
      "service_instance_id": "fixture_hub_H1",
      "control_epoch": "9007199254740993",
      "lease_id": "fixture_lease_A1"
    },
    "command_id": "fixture_command_A1",
    "revision": "1",
    "character_id": "fixture_character",
    "manifest_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
    "variant_id": "fixture_circle_240_pet4",
    "action_id": 11,
    "asset_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
    "intent": "manual",
    "extensions": { "synthetic": true }
  }
}
```

playback.report保留同一完整目标身份/control及command_id/revision，另加report_seq、phase和elapsed_ms；phase=playing必须满足首帧提交定义。device.heartbeat用独立seq，不与report_seq互相覆盖。预取仅作为可选缓存提示、没有展示计时和播放成功语义；首个模拟实现可不做预取，不得把预取verified当playing。

实际承载候选已在[HTTPS/mTLS与凭据子Spec](device-transport-auth-v1.md)细化；这是离线评审，未改变本协议在真实设备尚未实现的状态，资源/安全门槛未通过前不开放deviceTransport。

目标说明：上面的fixture_circle_240_pet4为历史合成示例；S1/S2测试仍使用240 fixture，尚未验证正式360变体。[当前正式基线](../context/native360-baseline.md)。

后续离线参考模型新增[回执窗口/有序触摸子契约](resource-replay.md)：命令/意图最近256条加高水位、单当前acquire回执及受保护session回收；sequenced触摸需可信输入会话event_seq。旧无seq接口仍安全封顶，不是已落地的设备wire字段。上述更新不改变本协议在真实固件/transport尚未实现的状态。
