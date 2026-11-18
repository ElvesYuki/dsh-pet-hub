# A4 主动拉取与分段调度候选

2026-10-30。[实现前Spec](../context/plans/round-pet-a4-spec.md)/[Diff](../context/plans/round-pet-a4-diff.md)、[48专项/563全套报告](../reports/2026-10-30-round-pet-a4.md)。本实现只供独立临时loopback；profile=round-pet-pull-candidate/1，不是当前v5或共同定版的设备wire。没有service/CLI/plugin默认装配或生产listener。[A5](round-pet-a5.md)已补内部显式默认OFF的UDS owner/磁盘reader/只读UI集成，以下独立A4证据范围保持。

## 入口与复用

- core/round-pet-pull：4KiB canonical候选codec与PullControlQueue，严格UTF8/重复字段/整数/完整context，uint64字符串不转Number；[golden](vectors/round-pet-a4-exchange-v1.json)仅原创Node候选向量。
- runtime/round-pet-pull：createRoundPetPull注入现有sessions、同步readView、clock、caps、manifest、packageRef、同步只读readAsset和可选readBudget；createPullHandler只返回handler，不listen。caller负责server/socket/metadata生命周期，元数据输入被复制。A3 proof只从当前真实TLS request产生，WeakMap绑定完整record/context；不信wire verified布尔。
- runtime/pull-request-owner：无队列的实际请求owner及literal-loopback HTTPS客户端。测试client只连动态127.0.0.1端口、临时私有CA，maxSockets=1、maxCachedSessions=0，沿用TLS1.2/P256/AES128GCM。生产LAN客户端/配置/自动重连退避仍未实现；A5只补显式离线恢复。

scoped binding-store、createSessionRuntime、lease guard/encodeLeaseV5、assetRange/validateSegmentResponse直接复用，未改旧认证/缓存/动态检查。每个同步业务栈复用一个完整metadata revision；新请求及每4KiB块另开视图，绝不跨await。source/pet未接入，不重复监听DSH。

## 候选握手与两个HTTP周期

隔离路径为/offline-round-pet/v1/{hello,exchange,manifest,assets}。hello外层闭合为{profile,schema_version:1,versions,hello}，versions必须显式声明round-pet-native360/1及playback/display/storage/inventory各version=1；begin/confirm在同socket回显同选择。缺失/未知版本拒绝，不默认升级。内层仍用现有hello.begin/confirm/challenge/ready闭合合同，没有修改生产hello接受字段。

exchange.request={profile,schema_version:1,type,context,request_id,request_seq,observation}。observation=null或至多一个：lease（关联dispatch_id及已有候选grant字节base64）、record（A3对象及dispatch_id/null）、ack（cancel/revoke的关联确认）。响应原样echo request/context，control和read_permit最多各一个且不能同时存在。旧seq/上下文/错误dispatch/错误grant request_id/request_seq均拒绝并失败关闭。

owner显式lease(acquire)排队→设备exchange得到请求→设备应用并在下一exchange回传grant→旧guard确认后才能派发base。sent_at由beginLease在实际派发调用时登记，队列等待不重置deadline或抬高TTL。playback.set响应后，下一exchange的accepted才清该pending并允许素材；本地requested/sent或HTTP200均不等于accepted。旧已派发base的合法接纳可被丢弃而完成关联，随后派发最新queued base，不使旧目标复活。

公开协调API：open(socket,selectedVersions)、lease(kind,absoluteDeadline,expected_epoch)、base(target,absoluteDeadline)、save/query/cancel/revoke、exchange、HTTP/read ticket方法、observations/resources/waitForIdle/close。owner控制API是受信内部接口，无页面/UDS控制写入口；只有已认证候选设备exchange可回传事实。save的operation ID、dispatch ID、read ID在owner内单调生成，不保留全历史ID集合。query由A3生成唯一查询ID。绝对deadline均为宿主本地量，不发给设备。

## 有界控制与失败

同时1 pending control、1 latest base、1普通操作/查询；acquire/renew/cancel/revoke各至多1旗标。顺序revoke→cancel→acquire→renew→base→普通。已派发不可替换，普通副作用溢出queue_full，save在途不再接第二save；相同lease旗标去重不延长原截止。latest只替换未派发base。控制deadline=min(原入队截止,派发时刻+ackMs)，每个准入点检查；没有后台自动过期线程，空闲不执行操作，下一调用超期即失败关闭。

pending未确认时不重发控制、不发读取许可；到期/认证失败/取消中旧读失败使session失效、清队列/许可。dispatch attempt未得到确认记本地outcome_unknown，不合成设备storage报告；不能当未保存或自动重试。收到storage outcome_unknown后阻止后续save，跨新TLS open仍保留这一阻塞，直到新认证完整known库存确认；未知库存不能解锁，历史unknown不被改成saved。

重连由caller在旧client/handler实际退出后显式新TLS/hello/acquire/查询，队列/base不自动重放。自动重试次数为0；幂等Range/查询的有限重试和退避不自动开启，未来需另证明总deadline/清理预算。candidate revoke ack只做会话fencing，不代表durable binding/NVS撤销；真实撤销沿用现有控制平面另行装配。

## 分页/分段和双时钟预算

控制无待发且当前target已认证接纳、guard控制权有效才可取read permit；readBudget缺省null即NO_GO、不发许可。显式预算={segment_ms,exchange_ms,cleanup_ms,margin_ms}；horizon剩余须≥四项之和，不能延TTL掩盖不足。本轮1000/500/100/10只是宿主负载向量，仍非ESP硬上界。

wire permit仅{id,target,package_ref,remaining_ms}；宿主私有deadline=min(发放时刻+segment_ms,horizon-exchange-cleanup-margin)。模拟设备从**发送exchange前**本地时刻，加已有leaseSendBudget对remaining_ms/漂移余量的收紧结果，建立本地截止；不使用宿主绝对clock，不从收到许可时重新计满TTL。device与host各自校验本地deadline，client请求总截止取自身deadline与许可本地截止较小值；server请求timer也收紧到私有许可截止。大偏移验证不是实物漂移测量。

每个page或Range消耗一个许可；下一次读取必须重新exchange。因此段间renew/cancel/latest先于素材，不能拿旧permit绕过控制。许可绑定当前context/target/P/M/N/代数，只准当前asset hash，不接受URL。manifest 46动作分6页，每页≤8条且body≤4096B，带固定P/M/N与页号/总页，不改变原actions顺序。host持完整已批准manifest，真实ESP只保留所需descriptor/页的资源策略仍待G2。

Range≤32768B，If-Range/ETag/Content-Range/长度严格一致，拒绝redirect/压缩/chunked/多Range/越界。server以≤4096B逐块读取；每块前后重新验证当前session/动态日期/撤销、lease、target、deadline，同栈共享revision，不跨await；写入/等待drain仍保持HTTP owner。新target/cancel使旧read失效。device最终完整F与全241帧CRC独立核对，不把HTTP完成当verified/playing/saved。

## 实际退出与清理

createPullRequestOwner.run({deadline,signal,operation})无隐式队列。abort/超时只失效结果；busy直到operation真正settle才释放。忽略abort的operation会让close继续等，禁止开新请求/连接，而非Promise.race假清理。Node适配等待req.close；失败销毁并等socket.close，之后blocked须显式close重建。服务端HTTP/read ticket等response.close及handler真实结束才回收，waitForIdle/close不会把客户端已收完当服务端已退出。

关闭清理caller自有Agent、client、server sockets、handler、coordinator、session、store，最后删临时PKI/目录。没有自动接触现有端口/运行配置或清理其他进程。A3接到的首帧/本地/保存/库存是Node mock peer声明的事实，仍不证明真实面板/Flash提交。

## 验证与未完成项

```sh
node scripts/verify-round-pet-a4.mjs --output .cache/round-pet-a4/results.json
npm run check
npm test
```

48项专项，全套563通过；临时CA真实mTLS、原创241帧PET4/46合成描述、A2 recipe/F/M/P/N和A3真实socket proof均验证。host样本不作物理最坏时延。本A4专项readAsset为原创内存provider，saved只是mock报告；A5已另行接A2磁盘CAS、同UDS owner/只读UI和初始库存/写门禁，不改变本阶段证据。A1执行actor/设备仍未接入，共同固件准入未关闭。

共同wire/Node-C++互验、真实46包/许可、ESP TLS/可信时间/凭据/维护让出、单连接清理硬上界、自动重连/设备恢复物与生产准入仍待验证。回退close自有临时owner/端点并撤回专用入口；旧service/Registry/scoped/A1/A2/A3与外部固件/pet/bridge/DSH无迁移。

## A5新增受信扩展

createRoundPetPull可选onOpen(context)同步hook用于每新session查询库存，authorizeOperation(kind,payload)同步hook在playback.set/storage.save入队和派发再次执行策略。未传不改变A4独立候选行为；Promise hook拒绝。不可信设备不能提供hook。save(deadline,{victim_action_id})可选非0/4整数字段只进入候选闭合storage.save；实际victim必须由A5当前完整根验证，不是通用固件许可。详见[A5](round-pet-a5.md)。

## A7内部恢复扩展

createRoundPetPull可选rootCheckpoint传给A3，resources.error保留首个失败的稳定原因，新open清除当前失败；错误hello仍清managed session，未成功open的观察状态不会阻止回收。默认null不改变wire/现有默认装配，真实恢复门槛见[A7](round-pet-a7.md)。

## A8可选rootAuthority

显式rootAuthority把inventory/storage处理拆为readonly准备→scope外同步CAS→新scope核session/控制截止→投影/ack/派发。Promise authority拒绝，pending保持到durable完成，超期不继续下发；缺省路径不变。新增锁/fsync成本尚待负载复评，见[A8](round-pet-a8.md)。
