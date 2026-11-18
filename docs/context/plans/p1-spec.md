# P1 Spec：本地服务、来源装配与管理界面骨架

2026-10-29，实施前。沿用P0固定上游参考8963384e33400d0c83965bd82f98bd8f81d22863的公开HTTP/Cordis契约和host/client/shared结构，不升级本机pet。

## 范围

- 本轮是P1基础设施切片，不包括真实设备调度/身份/心跳固件接入、BLE和素材分发。
- macOS/Linux用户私有目录内固定Unix socket由内核bind原子选主，无TCP监听，不使用现有桥接端口。第二启动者只能附着现有实例；启动中的描述文件未就绪可短暂重试，不回收/覆盖他人socket。崩溃遗留不可达socket明确阻塞，先离线检查再人工恢复，不凭PID或超时删除。
- HTTP-over-UDS IPC：随机实例ID和随机Bearer仅在0700目录、0600描述文件；socket 0600。目录/文件必须属于当前用户，拒绝软链及宽权限。单实例范围是同一用户同一canonical runtime目录；插件与未来独立壳使用同一路径。自定义路径仅用于隔离测试。
- 白名单：GET status/config，PUT config（schema/CAS/原子替换），POST page-state。无远程停止、任意URL代理或设备写入。配置仅保存管理标题；不持久化状态、来源URL、Wi-Fi或凭证。
- source mode默认disabled；显式HTTP来源由服务串行读取pet公开state，取消/断连显式诊断；page模式通过公开getState读取后仅推送语义，首拍pending不当空闲。每个服务固定单来源模式，多页面采用短租约首写者，防止重复来源；租约过期后其他页接管。HTTP和page不会同时启用，不自动探测本机DSH端口。
- 插件宿主只连接服务，挂载自己的API路由；停用只释放自身路由，不停止共享服务。客户端按上游ModuleLoader factory和settings.section结构；React由宿主提供，页面只展示设备空列表、来源诊断与未开放操作。UI定时器/请求卸载取消，无设备连接假象。
- 打包生成dist本地候选（未安装），零新增依赖。共享纯模块不能引入node:http；宿主HTTP和页面来源拆分。

## 验收与限制

真实临时UDS测试竞争启动/鉴权/错误协议/CAS/重启持久化/停止清理；独立进程竞争测试验证内核唯一所有者；模拟HTTP验证取消/恢复；page租约/未知状态/首拍；模拟Cordis注册与释放；生成client语法检查及隔离打包。管理界面需可视检查。所有测试不接现有设备，不改DSH配置。

Windows命名管道、OS peer credentials、设备端fencing、Keychain、真实DSH加载/授权尚未验，不宣称完成。相同用户进程可读IPC凭证，此权限边界不是对同用户恶意进程的隔离。
