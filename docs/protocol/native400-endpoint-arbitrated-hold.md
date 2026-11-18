# TCP25：端侧仲裁的有限自动保持

2026-11-06。用户选择方案A；[Spec](../context/plans/tcp25-spec.md)/[Diff](../context/plans/tcp25-diff.md)/[宿主证据](../reports/2026-11-06-tcp25.md)。仅显式离线装配；默认event和observed-local不变，没有启用真实设备hold。不是优先态查询实现，也不表示host知道屏幕正在播放什么。

## 明确的装配边界

可信本地调用者在原构造参数上显式传入：

```js
createNative400PetBridge({
  enabled: true, mode: 'hold-state', arbitration: 'endpoint-arbitrated',
  source, client, expectedRevision
})
```

source仍须原HTTP收据的opaque句柄，client须独立genuine素材/用途/lane/shared授权；此API不发权、不启动owner、不新增profile/config/UI开关。arbitration缺省observed-local，priority缺省unknown；endpoint-arbitrated仅适用hold-state，禁止同时传priority（即使固定clear）。A声明设备仲裁权，绝不制造clear观察。B的provider/轮询草案保留可选历史，autoRecover:false只约束B草案，不作为A前置；A没有新增HELLO尾部、type或字段。

原[TCP23](native400-pet-hold.md)的三期限、收据<=1500ms、controls往返扣除、各余量>7500ms、2秒低水位、新5秒BASE、单串行poll、CAS/seq/request_id、unknown原body确认、有限窗口与过期不复活保持。poll默认500ms，但不假定轮询及时；已过期即停，不用旧语义重建。只映射null/thinking/working（对应0/1/11），本地4不远控，人工目标不接管。source或授权结束不自动延长，不是永久会话。

## 仲裁、确认与退出

| 情况 | host行为 | 端侧要求／证据边界 |
| --- | --- | --- |
| touch跨多个租期 | 新鲜、受权且自己目标仍有效时继续有限BASE，支持更新最新语义 | 保持touch stamp和本地4，ACK Deferred/code3/token0；不得抢播或发remote Presented |
| touch EOF | 不发送伪touch-clear | 回最新尚有效remote；已取消/过期/断线回本地；旧touch EOF无效 |
| Deferred ACK | 清原2秒ACK在途；accepted不等于播放 | 不另设Presented到达期限，仍有BASE、session和source截止；PING维持session |
| 新BASE/旧回执 | 清旧accepted/首帧观察；旧seq/source不推进最新目标 | 首帧必须实际提交，token/source/session/request关联 |
| 来源/预算/人工/暂停/失联 | sticky停止并尽力只撤自身已确认目标 | 无法送达取消不代表设备已执行；原有限TTL/断链收敛，touch不中断 |
| shared取消且网络down/paused | 仍须原授权/实例/组/seq/CAS；允许清逻辑desired/recovery | BASE仍拒绝；legacy不变；不能绕过已到期权限或lane窗口 |

core/owner无需修改：原code3已清ACK pending，无等待首帧超时；token0允许EOF后最新request的实际token，旧连接callback及旧seq已有栅栏。纯模型的prepare/presented由测试驱动，**不构成SHA/屏幕实证**；shared view仍verified=null/current_display=unknown，历史首帧只报告不升格。

## 重连与共享会话

共享的是Node后台逻辑组；每条TCP连接仍新HELLO/OPEN，socket/session/首帧证据不复用。autoRecover:true只恢复当前intent句柄及其原剩余寿命，不增加组revision或原deadline；false不自动重发。若bridge先发现断线，它停止并撤自身目标；没有自动重建bridge。若重连先于下一poll，可恢复未过期旧目标，后续续租仍重新核全部门禁。pause/cancel/人工替换/过期均不能借旧recovery复活。进程退出、来源/权限结束不提供跨进程持久会话。

## 同目标保位续租已由TCP26采纳

[TCP26合同](native400-preserving-renewal.md)已同步终端候选及管理端设备/播放oracle，替代这里的“尚未实现”与最小提案。最新命令request与起始stamp分离，续租保位/每cycle消费/严格绘制时间及loop准备均已宿主验证；END16已改为保位正例。旧重播反例与提案见[归档](../context/history/tcp26-evolution.md)。这不等于原板上f553/af5b已更新或实屏通过，仍不得自动启用设备hold。

## 验证与回退

`node scripts/verify-native400-endpoint-hold.mjs --output .cache/tcp25/results.json`：当前24项（TCP25当时20，TCP26补4），原创HTTP＋真实UDS/loopback TCP＋同一个跨连接端侧模型/虚拟时钟。触摸14.5秒跨4次以上5秒续租、PING、最新11 EOF；三预算、权限/来源丢失、取消/down/paused、manual race、unknown原body、迟到首帧/旧touch、true/false剩余TTL与过期反例。旧event/B专项及全量回归另验。

无需安装、Python或serial。关闭bridge/source，await读/IPC退出；关闭自己fixture HTTP/TCP/UDS/owner，临时目录删除。省略arbitration回observed-local，省略mode回event；无wire/数据迁移，无现有服务变动。未接ESP/USB、真实pet自然迁移/加载身份、保位续租实屏、长期会话、媒体流/保存/V3均未覆盖。既有DSH隔离加载证据不重做，不重复空闲采样。
