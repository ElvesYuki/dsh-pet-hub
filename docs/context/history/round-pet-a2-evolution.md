# A2三摘要导入演进

2026-10-30。仅替代A2候选recipe/离线适配尚未实现的结论；真实包P/ID/许可批准、联合G0、A3/A4和设备门槛保持。当前证据见[报告](../../reports/2026-10-30-round-pet-a2.md)及[活动API](../../protocol/round-pet-a2.md)。以下链接保留原文件语境。

## 原当前摘要

```text
2026-10-30 A1资源模型：check（仅.mjs语法）和test（含构建）全套434项通过，新增35项；独立CLI正常/取消均清临时环境。新增纯core Native360DeviceModel/FlashModel，schema2固定候选支持单encoded、4活跃＋1暂存、0/4保护、read lease/退休generation、双root/不确定提交恢复及工作/帧票据；旧schema1入口保持。verified不自动playing，save冻结最后画面，提交不自动恢复；saved与当前库存分离，reboot清RAM/命令保留有效Flash。[报告](../reports/2026-10-30-round-pet-a1.md)、[API](../protocol/round-pet-a1.md)、[替代记录](history/round-pet-a1-evolution.md)。

G0管理端审查/[Spec/Diff](plans/round-pet-single-device-spec.md)有效，联合C01–C12未关闭；A1只完成资源参考层，模型accepted/显式submitFrame不是设备回执。Registry.expect/UI/实体库存尚未接入；A2实际P/M/N/来源许可适配、A3/A4及G1/G2门槛保持。真实Flash格式/扇区时序/掉电、实际CRC渲染/可信时间/凭据、物理RAM准入和新设备通道均未验。
```

## 原下一入口

```text
1. **A2三摘要/namespace导入适配**：A1独立纯core资源模型已完成[35专项/434全套](../reports/2026-10-30-round-pet-a1.md)，不重复RAM/Flash原型或scoped。下一先补A2细化Spec/Diff，按[G0 recipe](../protocol/round-pet-single-device-v1.md)实现F/M/P/N provenance、真实46/241/许可与streaming桥接；使用原创小向量，不默认导入大库。联合[C01–C12](plans/round-pet-g0-handoff.md)仍待确认，候选模型不是wire定版或设备授权。
2. **A3设备观察与管理界面**：在A2身份适配和共同schema/golden冻结后，实现设备accepted、首帧、saved／库存、local实际画面及维护冻结UI。复用现有PC角色包／streaming，但不能把PC预览、导入指针或A1本地调用当设备确认。
```

## 原差异行

```text
| 包runtime导入互操作 | **待实现**：index.json严格字段、自算M；MaterialCatalog只验外部sha形状 | media_contract导出catalog.sha=P；旧check_hub_contract只测pure core | A2适配，不把纯core报告当runtime导入通过 |
| F/M/P/N | 文件F和hub M计算**已实现**；P→M/N桥接**待实现** | 固件P包含catalog/timing/semantics/source；N固定；实际P**待固件确认** | 明确recipe、typed tuple、假向量和真实文件审计责任，不改V2 N |
```

434是A1阶段宿主结果；新469项包含A2原创数据，不是设备测试或真实46动作的联合核定。旧限制仅在离线映射层被替代。
