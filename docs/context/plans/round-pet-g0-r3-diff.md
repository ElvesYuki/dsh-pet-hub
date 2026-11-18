# G0-R3 Diff（实现前）

- 新增独立闭合wire契约表、core codec/错误表/有界往返关联；旧A4/A3/lease/生产入口不放宽或改名。
- 新增原创C++宿主解析/验证器、无秘密正反字节golden及Node专项/监督CLI；不接设备/网络或固件工程，不引入依赖。
- 明确新状态版本：deferred_local、already_available库存证据、取消gate结果、unknown、维护与触摸，完整hello能力/包及HTTP错误/路径/分页/Range边界。
- 对照canonical字节/长度/SHA、范围/关联/旧流拒绝，运行check/test和正常/取消临时环境清理；不把宿主C++等同固件互操作或资源准入。
- 更新提案/交接/当前摘要/待办并归档旧wire缺口；正式runtime/固件签核、独立许可批准及G1/G2仍待完成。[完整Spec](round-pet-g0-r3-spec.md)。


## 实施状态（2026-11-02）

本轮范围已实施，见[报告](../../reports/2026-11-02-round-pet-g0-r3.md)：24专项、78正/62反Node-C++宿主字节对照、check与含构建811/811回归、正常/SIGTERM临时清理通过。正式runtime adapter/固件签核、真实素材批准、G1/G2及设备窗口未完成；旧wire缺口已[归档](../history/round-pet-g0-r3-evolution.md)。本Spec/Diff保留实现前范围与回退依据，不把管理端单方提案写成联合G0关闭。
