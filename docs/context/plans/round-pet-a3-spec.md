# A3 设备观察与管理界面 Spec（实现前）

状态：离线候选已完成，见[46专项/515全套报告](../../reports/2026-10-30-round-pet-a3.md)和[活动API](../../protocol/round-pet-a3.md)；共同wire/实体门槛未关闭。

2026-10-30。用户授权继续A2后的A3。只做明确标记的离线候选，不将未关闭C04–C07草案定为设备wire；不接设备、固件、pet、bridge或现有DSH配置，不安装/启用插件、不提交推送。已读当前上下文、协议、Registry、service、代理和UI。保留已有修改、不使用子智能体、零依赖、原创MIT。

## 根因、范围与入口

旧Registry.expect在本地置accepted，旧UI只展示synthetic simulation；A1显式帧事件、A2宿主解码/来源记录不能充当实体回执。新增纯core单设备观察reducer，使用独立candidate模型标识、版本及严格object记录；旧Registry/模拟调用和mTLS/scoped保持。真正的认证、lease、凭据仍由现有运行层负责，本reducer默认拒绝，由受信同步session/control/proof回调接入，不自行发证、续租或转换HTTP成功。

新增仅内部显式observationReview工厂，由UDS赢家在独立临时服务装配；只能deviceMode/source disabled且不混managed/simulation/import，配置identity参与选主匹配。没有CLI开关、页面注入、设备listener或设备写路由。默认状态不变。现有GET status→插件白名单→共享UI增加只读候选区；包带共享渲染器但不安装。现有simulation controls不指向候选设备。

## 状态和失效规则

- open由受信owner提供完整7字段context、profile与四流版本；缺版本为diagnostic，不默认支持saved。session回调失效会锁定离线，恢复必须新open，不能回调false→true复活旧数据。新session清目标/序列/查询/操作，不自动重播；同binding保留最后画面/历史保存和持久root高水位，但标非当前。
- request只产生requested，sent单独登记；只有当前context、完整target/package_ref、当前control及认证记录才能accepted/downloading/verified。playing另需verified与首帧refresh_generation/first_frame_seq，不能由PC预览/下载结束推动。playing流不直接替代display流；终态/旧目标不能被迟到报告复活。
- display独立display_seq及refresh_generation/frame_seq。remote event只接受当前非终态目标；新session只读snapshot必须匹配新查询，可展示历史source而不补旧命令playing。local画面不生成remote命令，不改latest desired；不实现触摸寿命/冷却/回发或推测回base已播。
- 维护none/loading/verifying/saving/recovering/blocked单独记录，display_state为playing/held_last_valid/unknown。只有明确报告才显示暂停；held不由宿主时间累加，旧refresh拒绝，连续held同帧elapsed不能前进。unknown/断线保留最后画面历史并标非当前。
- expectSave登记有界操作；storage独立seq，saved需明确root_commit证据、uint64根/对象generation、原target/P/M/N；晚saved只记历史，不提升当前目标/actual。outcome_unknown冻结库存当前性、失效旧查询，不推断未保存或自动重试。
- inventory仅完整同根snapshot、≤4个唯一引用、默认0/4/state一致，N固定，root序列不得回退或同seq改内容；经新查询确认后原子替换。根中的旧F可以存在，但只有与当前批准manifest同N/id/F/bytes才映射available。新saved根超过已知库存则标unknown并重查；旧saved不能覆盖新库存。saved历史不保证available，断线/诊断库存unknown。

每流独立uint64高水位，验证通过后才推进；拒绝坏字段/未知字段/旧context不部分写入。查询每种1个、相对宿主截止默认2秒（仅候选内存回收，不是设备时延预算），替代/过期/失效不能使用。命令窗口256、保存操作64（只淘汰终态）、历史16、查询2；close幂等清内存无后台资源。绑定改变清跨绑定历史，不将相同N当相同包。

## IPC/UI、安全与验收

公开summary仅单设备、目标动作/revision、phase、实际画面来源/相对elapsed、维护、保存简表、46动作可用/最后确认；不传完整context/control/proof/原始记录/路径。服务和宿主对新summary按白名单重构，客户端只读、有明确“离线候选·非实物”标签，无手动播放/保存按钮。即便伪状态带实体devices也不能绕开simulation控制门禁。

实现前固定原创JSON状态golden（对象语义不是wire字节互操作）。测试请求/发送/接纳分离、proof默认拒绝、版本诊断、终态/重放/大uint64、坏消息无变更、触摸与新base、维护暂停、首帧/画面分流、存储不确定、完整库存/淘汰/旧F、重连只读查询、容量与关闭；临时UDS→代理→渲染树及候选bundle加载/卸载回归，禁止新POST观察入口。跑check/test和隔离专项CLI；仅有新问题才扩大。

回退关闭临时review服务/工厂、清自有临时目录；默认/CLI/现有服务配置与A1/A2/scoped不迁移。实体认证装配、wire冻结、设备触摸事件、A4 pull/调度和G1/G2门槛均待验。本轮不重新核对固件部署或导入真实包。完成后更新当前摘要/差异/待办，并按主题归档被替代记录。

实现细化：query ID改由core单调生成，不接受调用方重用；held后恢复playing须新refresh_generation，保存/库存同root核文件与object_generation。它们是本地候选防错约束，需C04/C06确认后再适配设备。版本缺字段维持诊断，不默认支持。
