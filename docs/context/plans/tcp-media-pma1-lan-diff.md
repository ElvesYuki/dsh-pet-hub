# PMA1 LAN 联调改动范围

- 增加 PBP1 type 5、RAM 配对作用域和 HMAC 编码，扩展独占串口的显式 ARM 请求能力。
- 为现有发送状态机提供独立、单次、仅动作 1 的 RFC1918 入口和不可变 BEGIN 预览。新增单次监听／USB 交接及人工 CLI。保留原 PTM1/PMA1 loopback 入口。
- 增加宿主回归与命令报告，注明 STATE 关联限制及单连接 Unknown 边界。回退关闭调用者并撤销 RAM 配对，无持久配置迁移。
- 专用 LAN socket 启用 TCP_NODELAY，LAN 返回附加仅含耗时和样本数的聚合统计。定向覆盖慢 ACK 和截止前未确认块。普通 loopback API 和协议字段保持。
