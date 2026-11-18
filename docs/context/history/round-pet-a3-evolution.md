# A3观察投影与只读界面演进

2026-10-30。只替代A3离线候选未实现的描述；真实wire/认证装配、设备首帧/持久库存、A4与G1/G2仍待验。[当前报告](../../reports/2026-10-30-round-pet-a3.md)、[活动合同](../../protocol/round-pet-a3.md)。以下保留原文件链接语境。

## 原当前摘要

```text
2026-10-30 A2严格离线导入：check（仅.mjs语法）和test（含候选构建）全套469项通过，新增35项；独立CLI35项及SIGTERM均清临时环境。F/M/P/N/I独立映射、受限canonical/闭合包、外部批准、固定241/全帧CRC/index SHA、逐源文件校验已复用streaming worker/CAS；provenance在CAS外有界不可覆盖发布，重开重新提供批准并复验缓存。使用原创真实241帧及46合成描述（同F去重），不是当前真实46动作批准或跨端互操作。[报告](../reports/2026-10-30-round-pet-a2.md)、[API](../protocol/round-pet-a2.md)、[替代记录](history/round-pet-a2-evolution.md)。

A1纯core Native360DeviceModel/FlashModel能力保持：单encoded、4活跃＋1暂存、0/4保护、read lease/退休generation、双root/不确定提交恢复及工作/帧票据。verified不自动playing、save冻结最后画面、saved不同当前库存；旧schema1入口不变。[A1资源报告](../reports/2026-10-30-round-pet-a1.md)。A2仅专用API，不接服务/IPC/UI或A1真实通道；生产deviceTransport=false。

G0管理端审查/[Spec/Diff](plans/round-pet-single-device-spec.md)有效，联合C01–C12未关闭。A2机制已离线完成，但真实P/M/N/ID/源SHA/许可共同批准仍待C02；Registry.expect/UI/实体库存、A3/A4及G1/G2门槛保持。模型accepted/显式submitFrame、宿主prepare或来源记录均非设备回执。真实Flash格式/扇区时序/掉电、实际CRC渲染/可信时间/凭据、物理RAM和设备通道均未验。
```

## 原下一入口

```text
1. **A3设备观察与管理界面**：A2候选recipe/独立批准/严格流式导入已完成[35专项/469全套](../reports/2026-10-30-round-pet-a2.md)，不重复A1或scoped。下一先补A3细化Spec/Diff和状态golden，以合成输入实现requested/sent与设备accepted分离、首帧、saved/库存、local实际画面及维护冻结UI；A1/A2宿主事件不能直接当设备确认。新wire/版本须共同冻结，未决时只实现明确标注的离线候选。
```

## 原差异行

```text
| Registry能力／状态 | **已实现（基础）／待实现（扩展）**：connect收schema2；summary不输出Flash／维护；expect本地置accepted | 新命令、首帧、存储／库存流**待固件确认** | A3拆requested与设备accepted、actual/display、storage/inventory |
| 真实设备UI／IPC | **待实现**：hubViewModel仅simulation/synthetic才有devices；roles.actual是PC worker解码 | 无新管理端通道可供UI声称已连 | 新实体投影不复用PC playing，设备／来源／管理服务连接分开 |
| accepted | **待实现（真实接纳）**：现有expect本地accepted只能当历史模拟内部phase | 新设备应在身份／lease／目标接纳后报告 | UI先queued/sent，认证accepted后才显示“设备已接纳” |
| playing／actual | **已实现（模型／PC）／待实现（实物）**：Registry只在playing更新remote actual | animate刷新提交后记presented；旧played仅ID/32位revision | 固件绑定完整新context/generation/token；actual允许本地触摸且不伪报远端成功 |
| saved／offline_available | **已实现（A1模型）／待实现（实体流）**：模型分离保存历史和root库存；旧report不允许saved，无设备库存流；PC确认指针不是设备root | Store.commit写对象／新root成功；saved只有日志，淘汰按root refs | 新storage/inventory schema1协商，旧版unknown；历史saved不代表当前库存 |
| 本地触摸 | **已实现（旧模拟）／待实现（实体观测）**：宿主scheduler有1秒冷却，不能套设备physical反馈 | 物理touch计数、LocalPlayback寿命／P1/P2已实现；新event字段**待确认** | 设备为权威、只更新base；不回发触摸命令／二次冷却；结束核对最新有效base |
| 维护画面 | **已实现（A1模型）／待实现（设备与UI）**：模型load/save冻结，保存不自动恢复；旧草案“保留旧缓存播放”不能保证当前板 | load/persist会freeze且encoded复用；Flash4持read lease不能persist | 接受held_last_valid维护降级，elapsed暂停；具体钩子／上报待固件确认 |
```

469是A2阶段宿主证据，新的515包含A3合成/临时服务/VM验证，不是新增真实设备功能或真实DSH重新加载结果。旧Registry保留simulation内部accepted，不转换为新设备确认。
