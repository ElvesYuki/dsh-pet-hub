# 1.75C-EN VP8 动作 1 接入 Diff

2026-11-16。

| 范围 | 变更与验证 |
| --- | --- |
| USB | 抽取现有 POSIX 独占打开与实际关闭，复用已有 raw helper。独立 VP8 行协议读取，保留 PET4 二进制解析。 |
| runtime | 固定对象身份、有界 HTTP、单作业状态、一次取消及显式查回。物理候选由 `STATUS1` 确认。 |
| shared service | 仅由可信启动参数启用，授权码和 instance/revision 双重校验，返回最小状态。退出关闭自有通道。 |
| 插件与 UI | 原正式 `apply`、Config、settings.section 及候选包接入显式按钮，浏览器不处理文件、串口或 Wi-Fi。卸载保留 Hub 所有权。 |
| 回退 | 停用候选控件，取消作业并待退出，停独立 Hub，恢复原插件配置或卸载本次候选。设备若已 Saved 保留作品，固件回退由设备任务负责。 |
