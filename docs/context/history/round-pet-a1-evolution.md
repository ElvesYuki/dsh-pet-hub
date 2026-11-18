# A1资源模型演进

2026-10-30。本轮只替代“纯core Flash执行模型未实现”的当前结论；旧schema1 DeviceModel保持，新Native360DeviceModel独立入口已完成35项/全套434项。G0联合定版、真实wire、A2/A3/A4和G1/G2/实体Flash仍未实现或未验。当前证据见[报告](../../reports/2026-10-30-round-pet-a1.md)和[契约](../../protocol/round-pet-a1.md)。

## 原当前能力/摘要

以下链接沿用原文件语境，通过上方报告进入。

```text
- 多规格目录、推荐、每设备确认/CAS及持久偏好已接simulation IPC/UI；schema2区分屏幕、素材、RAM与Flash容量。466/360中心偏移53已离线验证；旧DeviceModel不接受schema2，Flash模型未实现。见[素材契约](../protocol/material-variants.md)、[偏好报告](../reports/2026-10-29-material-ui-storage.md)。

2026-10-30单设备G0：仅完成管理端文档审查、[Spec/Diff](plans/round-pet-single-device-spec.md)、[profile提案](../protocol/round-pet-single-device-v1.md)与[固件交接C01–C12](plans/round-pet-g0-handoff.md)，联合G0未关闭。parser/推荐支持schema2，但DeviceModel仍拒绝schema2、Registry.expect本地accepted不等于设备接纳、UI仅synthetic、无实体Flash执行／saved库存／维护状态。新recipe区分F/M/P和固定N，10项数学核对不等于新协议互操作；现有check/test399项通过，未新增生产实现或开启通道。[报告](../reports/2026-10-30-round-pet-g0.md)、[替代记录](history/round-pet-g0-evolution.md)。
```

## 原下一入口

```text
1. **联合G0确认与A1执行模型**：[管理端审查/差异](round-pet-hub-baseline-alignment.md)及[Spec/Diff](plans/round-pet-single-device-spec.md)已交付，不重复scoped优化。先等固件答复[C01–C12](plans/round-pet-g0-handoff.md)，独立离线实施A1单RAM＋Flash模型，保留schema1回归；不是只删DeviceModel的schema检查。G0未共同定版不发新wire。
```

## 原对齐表执行行

```text
| schema2执行 | **待实现**：DeviceModel构造只准schema1，用cache.slots的RAM LRU，reboot清cache | 已有单encoded、V2根／暂存／read lease；不是四RAM槽 | A1单工作集＋Flash事务模型，不删除保护后硬套旧actor |
```

399项是复验减量/G0基线阶段结果，不被改写为设备测试。新的资源模型不装配runtime/UI或真实通道，不能据核心测试升级整条实体闭环状态。
