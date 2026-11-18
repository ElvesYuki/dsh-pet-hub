# 服务装配、电源与会话回收 Diff（实施前）

状态：先行切片已于2026-10-30实施并在独立临时环境验证，见[报告](../../reports/2026-10-30-service-power-capacity.md)。下文保留执行前范围；没有生产部署、物理睡眠周期或设备接入。

- runtime/service：显式managed review选项、去敏装配描述入sourceKey、选主后初始化、启动就绪门禁、owner级资源清理；默认/CLI/插件不启用。
- runtime/managed-sessions：只读打开既有元数据、构造session-runtime、接电源源、去敏快照与关闭所有权。
- runtime/power-source＋native/macos-power.c：严格NDJSON子进程源、实际IOKit只读观察、就绪/失败/退出语义；测试期临时clang构建，不引入运行依赖/自动安装。
- runtime/mtls-peer、session-runtime：显式一次性owner admission替代managed路径的全生命周期历史集合；旧直接context入口保留256上限，core wire/预算/元数据不变。
- fixture/专项：既有TLS harness支持受服务owner提供的协调器，真实loopback超过256重连；UDS owner/attach、电源fixture流、native注册及回退清理。
- 独立CLI/报告/协议/Spec状态、README/index/current摘要/待办/决策及被替代历史。保留并行L3角色成果。

无新生产LAN监听、蓝牙/设备、正式密钥或旧配置迁移；回退步骤见[Spec](service-power-capacity-spec.md)。
