# 400-14 Diff（实施前）

状态：2026-11-03已完成本页离线范围，见[报告](../../reports/2026-11-03-native400-14.md)。真实浏览器/DSH身份/native picker仍待验；原实施前边界如下。

- runtime/native400-source-review-host：可选显式controls策略/独立descriptor，赢家创建原controller并包回原source view。
- runtime/native400-review-channel：单私有通道、owner-only authorize/choose/revoke，安全RPC/请求体/错误边界与scoped client；不另建认证服务/存储。
- runtime/service/client：新模式仅私有controls/start/cancel，原UDS鉴权上加review凭据；client固定实例，不改旧默认路径。
- core/native400-review-access：共享私有响应/ACK白名单，与公共渲染模型分离，原controls/source view复用。
- apps/dsh-plugin/index/client：显式受信provider+固定origin控制代理与既有transport方法；默认apply不发放权限。
- ui/native400-review-controls及ui/index/build：共享只读降级/显式操作/同请求确认、generation/退出，固定纯模块白名单打包。
- tests/native400-14/fixtures/verify CLI与docs/context/history：真实临时IPC/HTTP/UI、权限/异步/资源负例和证据；归档旧入口。

不改controller/selector/reader/journal事务、400-03 wire/golden、400-07、依赖/锁文件、固件/真实素材/旧尺寸、现有pet/bridge/DSH配置。不安装启用插件或自动选择真实路径。
