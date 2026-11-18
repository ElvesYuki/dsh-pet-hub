# TCP28：有限A hold运行器

2026-11-06。[Spec](../context/plans/tcp28-spec.md)/[Diff](../context/plans/tcp28-diff.md)/[报告](../reports/2026-11-06-tcp28.md)。可信本地运行层API，不是网页路由、发权器或设备准入证据。已完成临时HTTP/UDS/loopback与虚拟时钟/短墙钟验证；没有真实pet/ESP运行。

## 装配与资源归属

runtime/index导出`createNative400PetHoldRun`，参数闭合：

```js
const run = createNative400PetHoldRun({
  enabled: true,
  client: scopedSharedClient,
  base: explicitReadOnlyPetBase,
  expectedRevision: '0',
  runMs: 45000,
  sourceMs: 60000
});
await run.start(); // armed表示本机片段就绪，不表示首帧或设备准入
// 片段结束/退出时：
await run.close();
```

client必须由可信外层通过原genuine素材/audit/独立用途/window/shared授权提供；本API仅校验原envelope/实例与revision，不凭duck型client或JSON自行签发权限。base沿原显式loopback公开pet URL校验，只读GET/state。来源加载身份/fresh批准等仍由外层先取证。

构造必须enabled=true，无I/O/计时器启动；默认参数不启用。runMs为1–45000ms，sourceMs必须>runMs+7500且<=120000，pollMs默认500、范围100–10000。可注入可信单调毫秒clock及四个timer方法、外部AbortSignal；不传Wi-Fi/设备配置/issuer。start只创建本次唯一source及原endpoint-arbitrated bridge，沿用原5秒BASE/2秒低水位，不关闭借用client或外层窗口，不end/revoke共享组或页面grant。

启动前置GET核：shared、网络open/ready、精确expectedRevision、无既有desired；page权限与真正lane余量各扣GET耗时，均严格>runMs+7500，独立sourceMs也满足。45秒起点在start调用的同步阶段，不能因微任务、查询耗时或重复start后移。一次start失败/停止不能重新创建来源代；未关闭时重复start只返回原armed回执，不重启轮询。来源本身起点在首次创建，监管截止仍从更早的start计。

## 状态、截止与unknown

| 阶段 | 行为 |
| --- | --- |
| ready/starting | 构造未启动／等待原client GET，无素材或设备写入 |
| running | 仅一个串行poll，使用原A桥接的收据/三期限/CAS；设备保持touch优先/保位续租 |
| unknown | 停poll timer/冻结新读和新意图，保同一个source、原body及原监管截止 |
| stopped | 原bridge因来源失败/人工冲突/预算等停止，关闭自己source及poll；仍保监管截止以收尾 |
| closing/closed | 同步fence新操作，await启动/桥接活动读取和IPC退出，只撤自己已确认目标，然后关自己source |
| cleanup_unknown | 明确保失败，显式close可重试收尾；不发新控制/授新权限 |

显式confirm只在原截止内确认同一body。新鲜且仍持目标时可恢复原轮询；陈旧/人工冲突按旧bridge停止，绝不换request或TTL重试。到期后confirm不可执行，unknown可能已生效时只剩原有限TTL，不猜取消成功。

独立deadline timer最多45秒；每次poll/confirm/snapshot检查单调截止，所有BASE提交前还有一层截止检查，防止controls await返回时已跨截止。允许关闭期间原bridge只读查自身目标并提交cancel，不允许新BASE。迟到timer不能新读/延权，回退时钟失败关闭；不新增PRESENTED到达期限。

close/abort立即清本运行器timer并中止启动请求；调用bridge.close先中止其HTTP/IPC，然后等待实际退出，最后关闭source。unknown没有已确认所有权时不推测cancel。host_window_owned=false：人工新目标、其他页面和外层window继续存在；只有外层决定真正结束整个窗口时才另行await window.close。不能把“运行器已关闭”写成TCP/UDS或设备已关闭，更不能等同STA清理/固件回退。

snapshot只提供phase/稳定reason/监管剩余时间、原bridge过滤snapshot及device_evidence=false；resources给自己的deadline/poll计数、source/start/operation在途和host_window_owned=false，不含地址/凭据/原响应。首帧、完整SHA、当前display等级仍沿原host模型，不能由运行器armed/closed推出。

## 与外层窗口的具体关系

外层仍按[TCP27清单](../context/plans/tcp27-window-runbook.md)创建fresh audit/独立批准→reviewed request→shared controlAccess→NodeControlWindow，仅赢家开listener/得到实际link与新OPEN；可信外层授scoped client后才构造本运行器。它没有任何打开监听端口、猜peer、自动安装插件或读取旧配置的方法。

TCP28已补可运行的有限片段监管和来源/桥接装配；后续[TCP29](native400-pet-hold-host.md)已完成固定副本实际进程启动/本运行器构造start与原授权IPC闭环；实际DSH/pet加载身份、现场来源/用途/设备准入仍待。TCP27准备工具默认只import bridge，不能拿其prepared结果证明新运行器已在真实宿主加载；新模块/候选SHA单列在TCP28结果。

## 验证与回退

`node scripts/verify-native400-pet-hold-run.mjs --output .cache/tcp28/results.json`：24专项，真实原创HTTP/UDS/shared client/loopback端侧模型；虚拟45秒和触摸跨多个5秒租期、52.5秒门槛/独立预算、迟到timer/await栅栏、manual目标保留、来源失败、unknown fresh/stale/人工/截止、在途close/late启动、clock rollback及重复close。另用实际1秒墙钟timer核监管退出，不是45秒墙钟耐久或ESP/最坏延迟证明。

代码MIT，零新依赖。回退省略新API即可保持原manual/event/A构造；close运行器只清其自身资源，外层/设备分别由原所有者收尾。没有wire/存储/profile迁移。当前PTC1缺cycle/mail观测、真实pet身份/自然迁移、ESP动态资源/实屏和设备退出/恢复仍待；不据本片自动连接或上板。
