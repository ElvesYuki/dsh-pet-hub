# VP8 一键绑定同进程实装验收

2026-11-17。[Spec](../context/plans/vp8-usb-desktop-hotload-spec.md) · [Diff](../context/plans/vp8-usb-desktop-hotload-diff.md)。

固件任务在 `0.1.5-usb-pair-test`／`ota_1` 上通过管理端 CLI 完成免 BOOT 首绑，并验证 NVS 持久记录与管理端完整身份匹配。设备实际拔插、软件复位和管理端新进程均查回同一绑定与原 Keychain 引用。`0.1.4`／`ota_0` 和 57 个素材保留。设备侧证据见固件仓库的 `apps/round-pet/reports/2026-11-17-vp8-usb-enrollment.md`。

固件任务随后在已打开的签名 DeepSeek Harness Desktop `0.2.2-rc.3` 安装独立候选包与一条显式启用配置，原配置已作本机私有备份。安装前后的 DSH 主进程集合一致。「设置 → 设备登记候选 → 验证绑定」实屏显示「本次已从设备核对持久绑定」，随后释放串口。原 Hub 及免码查询配置保留。这次现场设置页验证覆盖已绑定设备读回，新板首绑的现场证据来自 CLI。

## 候选和启用方式

独立插件 `dsh-pet-hub-boot-review` 使用原生 Config，`enabled` 默认为 false，`enrollmentDirectory` 默认为空。显式启用后只接管一键 USB 候选路由，使用已指定的私有目录及其现有索引、密钥引用和串口身份。启动与状态页轮询都不会打开串口。关闭立即撤销路由并取消工作，替换实例等旧任务和串口完成关闭后再接手。旧实例的命令无法在新实例提交。设备启动时一次有期限的 Type 6 无响应显示可重试，收到合法能力应答后才判断固件支持情况。

构建产物为忽略目录下的独立 tarball，不含任何本机登记数据或凭据。复建与配置片段命令如下。它们不安装包或写 DSH profile。

```sh
npm run build
candidate="$(node scripts/build-vp8-boot-rc3.mjs --artifact)"
npm pack "$candidate" --ignore-scripts --pack-destination "$(dirname "$candidate")"
review="$(cat /path/to/firmware/.cache/vp8-usb-enrollment/review-root.txt)"
umask 077
node scripts/vp8-boot-review.mjs config-enable "$review" > vp8-usb-enable.yml
node scripts/vp8-boot-review.mjs config-disable > vp8-usb-revoke.yml
```

上面的命令供将来重建候选和配置片段使用。当前现场已有一条启用配置。已绑定设备使用「验证绑定」，一个新会话只发 Type 6／10。未登记设备通过「绑定设备」发起首绑。需要撤销时，只在同一个 App 停用独立候选，或使用撤销片段改该候选的 `enabled`，保留索引、Keychain 和原 Hub 包。若关闭未确认，先核对串口释放，再允许下一次加载。

## 密钥作用域连续性

现阶段使用固件任务记录的原私有根，保留原 `keychain-helper`。密钥标签中的作用域来自 `vp8-boot-review-<scope>` 目录名。长期候选位置为 `~/.dsh-pet-hub-enrollment/vp8-boot-review-<同 scope>`，父目录和该目录均为 0700。保留原目录名、`vp8-boot.json`、`enrollment.keychain-db`、受限的 `keychain-unlock` 和明确选择的 USB 配置。备份和恢复时还需保留原签名助手。引用、公钥摘要和索引需要一起核对。

现场尝试迁移时，目标 Keychain 的原引用未通过签名验证，返回 `vp8_migration_signer_unavailable`。迁移工具自动撤销目标副本，当前设置仍使用已验收的原私有作用域和原签名助手，现场保留本机私有备份。

后续在合成 Keychain 上区分了签名助手 ACL 与历史助手自身的路径检查，现场旧助手继续保留在原路径。长期私有备份、原样恢复和新进程验签已通过本机合成测试，新 CLI 尚未用于现场凭据。[凭据连续性与恢复命令](2026-11-17-vp8-keychain-continuity.md) 真实设置页对新板的首次绑定及现场停用仍待独立验收。

## 验证边界

- 实装前使用 rc.3 内的 Cordis 4.1.0 和 Schemastery 3.19.0，在 `ELECTRON_RUN_AS_NODE` 测试同一进程的真实 `handle.update`。验证 Config 默认关闭、显式启用、撤销、再次启用得到新实例及最终卸载。该阶段的 Connection 由夹具注入。
- 宿主负例覆盖错误 profile／目录、旧请求、半途取消、旧串口关闭前拒绝新 owner、关闭故障和启动期无响应。只读探测重试的报文为两次明确操作分别发 Type 6，未自动发挑战或 Type 8。
- 实装前的 `npm run check`、构建和全量 `npm test` 通过，2,072 项通过，无跳过。常规 Desktop 免码查询客户端的审核摘要保持原样。现场设置页核对单独以上述真机证据为准。
