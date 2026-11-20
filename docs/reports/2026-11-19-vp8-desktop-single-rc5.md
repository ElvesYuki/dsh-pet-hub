# DSH rc.5 桌面宠物设备单包

2026-11-19。`dsh-pet-hub` `0.0.8` 为 DSH Desktop `0.2.2-rc.5` 单包候选。沿用原包名和 `dsh-pet-hub-settings`，提供同一个「桌面宠物设备」入口。原两包的查询、传感器、绑定、Wi-Fi 和天气地点路由归同一宿主插件。rc.3 的两份兼容回退包保持可构建。[Spec](../context/plans/vp8-desktop-single-rc5-spec.md) · [Diff](../context/plans/vp8-desktop-single-rc5-diff.md)

## 加载原因与验收

- 现场 rc.5 加载器已将 profile 内的主 Hub `0.0.5` 和登记 `0.0.2` 判为不兼容并跳过，两份声明均锁定 rc.3。实际桌面 profile 仍登记两个包。本次用真实 rc.5 parser 只读解析现场 profile，在内存生成迁移结果，确认原登记目录和其他 patch 均可保留。现场清单与 patch 的前后字节一致。
- 临时 profile 从两份实际 rc.3 tarball 切换到 rc.5 单包。使用已安装 rc.5 的 `dsh-app-boot` 复现旧包跳过、新包成为唯一 Hub bundle。用真实 Cordis、Connection 的 Cookie 准入及安装包 Desktop 转发函数验证状态路由，客户端 tarball 驱动设置槽。Electron 使用 Node 模式运行，完整设置窗口及真机待验。
- 单包读到合成绑定，原索引字节一致。设备查询和登记身份同目标，电池、Wi-Fi 和天气能力可投影。另一个登记 owner 同时挂载时遭拒，卸载解除原路由和 UDS，重挂生成新实例并拒绝旧请求。临时 profile 备份可字节级恢复。此处 USB 和 Keychain 的现场凭据没有使用。
- 首次全量回归的历史导入检查发现原宿主入口的固定摘要变化。新入口改为从原 schema 扩展，原已审核入口文件恢复逐字节一致，沿用固定摘要并通过专项复验。
- `npm run check`、`npm run build`、`npm test` 和 `git diff --check` 通过。最终 2,100 项通过，无失败或跳过。本次为 `DSH_DESKTOP_RC5_APP` 指定已安装 rc.5，打包测试额外执行真实宿主夹具。

## 现场安装与回退

2026-11-19 获用户授权后，先在临时副本通过 DSH CLI 预演离线安装、旧包移除与配置归并。完整 Desktop profile 已私下备份在 Git 忽略目录。随后用同一 CLI 在已打开的 `0.2.2-rc.5` 中更新 `dsh-pet-hub` 到 `0.0.8`，移除 `dsh-pet-hub-boot-review` 依赖、bundle、锁文件条目和专属 patch，并把原 `enabled` 和 `enrollmentDirectory` 转入主包 `vp8Enrollment`。原登记目录和其余设置沿用。新装没有旧登记配置时 `vp8Enrollment.enabled` 默认关闭。

实际 rc.5 加载器核对单一 Hub bundle，确认 `dsh-pet`、QQ 机器人依赖及其包清单未变。无需重启 DSH，原窗口设置列表出现唯一「桌面宠物设备」入口。该次验收止于设置列表，真机只读和 Wi-Fi／天气提交另验。回退先关闭单包并排空 USB 和 UDS，再恢复私有备份。希望重新使用旧双包时，需同时恢复对应的 rc.3 宿主。原绑定索引、Keychain 与设备网络不参与恢复。

安装后复跑 `npm run check`、`npm test` 和 `git diff --check`，全量 2,100 项通过，无跳过。

复建使用 `npm run build`、`node scripts/build-dsh022.mjs --host-version 0.2.2-rc.5 --combined`，再对 `dist-dsh022-rc5-combined` 打包。`dsh-pet-hub-0.0.8.tgz` 共 196 个文件，SHA-256 为 `dec2a7c0943523097507fb061a415a63a5288e900796d2a0d40086716feb5697`。
