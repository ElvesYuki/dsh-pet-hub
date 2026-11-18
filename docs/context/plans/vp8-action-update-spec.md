# 1.75C-EN VP8 动作 1 插件接入 Spec

2026-11-16。`56644ffd` 留驻候选已验证 USB 控制、HTTP 下载、Flash 校验提交、重复安装和停服后的断电重开播放。Hub 首片仅接动作 1 的固定 418,536 B IVF，SHA-256 `c47eae037765066dfd9c5c632ee32019487d22f831a8e9a83e4ab1a51710838c`。素材仅由操作员指定的本地源文件提供，构建不包含素材。固件协议 `docs/protocol/round-pet-vp8-action-update.md` 与实测 `apps/round-pet/reports/2026-11-16-vp8-action-update.md` 为依据。

- 默认关闭。共享服务显式装配一个受控 USB 路径和私有配置，插件显式配置本地宿主 origin。浏览器只调用固定 IPC 代理，操作须持独立随机授权码，同源检查并绑定服务实例与 revision。Wi-Fi、端口路径、文件及设备原始响应只在 runtime。插件卸载只撤销页面和路由，不停止共享服务。
- 复用 POSIX 独占串口 helper、USB 端口 pin 和现有 Hub 单实例。当前实体 USB 定位只有显式端口，注册表发现是模拟能力。本片对指定端口发 `STATUS1` 作能力识别，无扫描。固件回复无序列号与对象摘要，查回证明当前指定 USB 对端的固定对象，物理换线应停止并由操作员重新核对板卡与固件。
- 显式查询和安装是后台串行作业。安装先查询，`committed=1` 直接报告已保存，无 HTTP 和写请求。空闲且未提交才加载并验证固定对象，在指定私网地址启动短时 HTTP，随后只发送一条 `UPDATE1`。HTTP 只提供精确 GET 路径、完整长度、无 Range、压缩或分块传输。固件 `ACCEPTED` 和 HTTP 200 只代表进度。
- 只有本次 UPDATE 的 `SAVED id=1 existing=0|1` 或查询的 `committed=1` 能进入已保存。取消只发一次 `CANCEL1`，等待终态，提交竞态如收到真实 Saved 仍报告已保存。断线、部分写、超时或退出时，若 UPDATE 可能已发，结果为 Unknown。应用或用户重连后显式只读查询；不自动重发。`busy=0 committed=0` 是查询时未保存，`busy=1` 保持处理中或未知。后台作业有界，退出后关闭自有 HTTP、USB 和 socket。无 SHOW1 自动调用。
- 先验证真实 PTY、临时 loopback、UDS、构建后的插件宿主路由与设置面板接线。固件仓库只读，不连接设备或调整生产服务。现场需单独隔离 profile 与恢复方案。PET4/PMA1 保持原入口。
