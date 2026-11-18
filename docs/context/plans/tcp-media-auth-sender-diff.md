# PMA1 sender 改动范围

- 抽取既有 loopback socket 的定长读与写完成原语。增加 PMA1 hub 握手、收发记录和同步绑定租用，向现有 sender 提供相同 PTM1 语义。
- 新增显式 `prepareNative400AuthenticatedMediaTransfer`，共享原作业和回执逻辑。认证无效、错代、延期、撤销、取消、断线查询和资源退出纳入隔离 TCP 验收。保留向量验证与裸 PTM1 回归。
- 记录公开入口、USB 配对交接及测试证据。回退为关闭作业并撤下显式调用，无持久状态迁移或服务改动。
