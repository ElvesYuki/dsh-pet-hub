# VP8 BOOT macOS 原生适配与隔离 rc.3 Diff

- 新增 BOOT 专用 TTY 会话开器和有界文本交换，复用现有 raw/exclusive helper 与 IOKit USB 查询。测试使用独立 PTY，覆盖身份变化、并发、关闭和坏行。
- 新增独立 Keychain 的 Security.framework helper 与 Node 签名适配。覆盖持久化重开、错独立目录／标签、未找到、同钥签名、禁止原始私钥输出。数据路径和签名行为与上一片索引事务复用。
- 新增仅隔离 rc.3 的包构建与准备命令。候选设置页复用既有 UI，依据真实 Host 重建 URL 装配授权。检查标准客户端摘要、隔离目录门禁和进程释放。
- 在 bound 上新增显式新会话对账，包含 fresh type 6／10／133 与原 Keychain 引用，结果独立于本地绑定记录。
- 保留日常挂载、查询、配置和回退版本。真机、驻留固件和原 profile 不纳入验证。
