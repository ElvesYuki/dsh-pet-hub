# PMA1 收尾分段计时 Diff

2026-11-13。先保留原 sender 的报告指纹，再在共用实现添加默认关闭的诊断采样。新代码的诊断对照独立标记，原发布包或基线 SHA 不重新标注。

- `packages/runtime/native400-tcp-media.mjs`。复用现有 ACK、复核、END 回调、结果校验与截止钩点。按阶段一次采样，只记录数值与缺失点，返回现有结果的附加字段。端点、认证、批准及截止控制沿用当前实现。
- `scripts/native400-pma1-lan.mjs`。接受显式诊断开关，继续使用已有运行门禁和一次性 ARM。实际联调需独立安排。
- `tests/native400-pma1-lan.test.mjs`。用临时 loopback 验证默认结构、成功、最后 ACK 后源文件复核失败、END 已发后 RESULT 缺失和部分 ACK 到期。确认成功必须来自合法 RESULT。
- 回退取消 `--tail-timing` 或不传 `tailTiming`。继续保留旧运行包与五文件 SHA 证据。无持久数据迁移。仅运行本仓库宿主验证，固件只读，不操作设备或真实服务。
