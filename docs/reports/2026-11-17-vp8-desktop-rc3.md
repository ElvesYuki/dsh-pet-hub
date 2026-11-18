# 签名 DeepSeek Harness rc.3 真机只读查询

2026-11-17。[Spec](../context/plans/vp8-desktop-rc3-spec.md) · [Diff](../context/plans/vp8-desktop-rc3-diff.md)。

本机目标为已安装且通过签名校验的 `/Applications/DeepSeek Harness.app` 0.2.2-rc.3。它的 renderer 为 `dsh-app://app/`，主进程校验原始 Origin 后剥离该头，认证 Host cookie 后转发。Hub 的 Desktop 查询走 Connection Fetch 的 owner 路由、独立 Hub 授权码与原 instance／revision。旧 Web 同源 POST 行为保留。Desktop 配置和 Hub 必须显式启用只读查询，Connection 与 UDS 都拒绝另行下发，页面只提供查询。

先启动使用独立 DSH_HOME 和 userData 的签名临时实例，确认它在指定目录生成了 Electron Preferences 和本地调试端口记录。该实例在 Playwright 连接前退出，未取得设置页证据。按用户随后指示，使用已打开的实际 Desktop。在备份 profile 后经同一 App 的 CLI 安装 rc.3 打包文件，默认 Desktop 热加载并显示「实体宠物设备」。原 `dsh-pet` 0.4.8 的依赖、bundle 和 patch 保留。实际 profile 只追加 Hub 依赖、bundle 与专用配置，包管理器更新了锁文件。

| 证据 | 实际结果 |
| --- | --- |
| Desktop 授权 | 错误授权显示「授权码未通过」，查询按钮禁用。合法授权后出现查询按钮，无安装或升级按钮。 |
| 同一 Desktop 的设备替身 | 点一次查询，记录 `STATUS2` 后释放，页面显示 `0.1.2`／`ota_1`。 |
| 真机首次查询 | Hub 返回 `io_or_unsupported`，页面显示失败。该次未取得版本、槽位或完整写入证据。 |
| 分段诊断重试 | 重新匹配交接 USB，打开和独占配置成功。唯一确认的完整写入为 `STATUS2`，读取到返回字节并关闭串口。同一设置页显示 `0.1.4`／`ota_0`。首次通用 I/O 错误未在重试中复现，具体原因未定位。 |

没有执行升级、素材安装、Wi-Fi 配网或重启写入。57 个对象沿用固件交接记录，这次 STATUS2 没有枚举库存。授权码已从页面清除，查询 Hub、临时配置、诊断进程和隔离数据已清理，USB 确认空闲。插件保留在原 Desktop 中，后续查询需启动只读 Hub。脱敏证据在 `.cache/hub-desktop-rc3-installed/proof.json`。

`npm run check`、标准构建、rc.1／rc.3 候选以及全量 `npm test` 通过，共 2,031 项，零跳过。回归还覆盖 Desktop 错授权、非查询、失效实例和 revision 的拒绝，以及原 Web/OTA 路径。可用 App CLI 的 `plugin --profile desktop remove dsh-pet-hub` 移除包，再移除本轮追加的 Hub patch。原 profile 文件备份留在私有的 `.cache/hub-desktop-rc3-installed/backup`，与后续用户修改对照后再恢复。
