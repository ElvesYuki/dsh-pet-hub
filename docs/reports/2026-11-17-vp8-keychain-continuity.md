# VP8 绑定凭据长期保存与原路径恢复

2026-11-17。macOS 27.0.1（26A434）、Node 24.14.1、npm 11.11.0。合成验证使用独立文件 Keychain 与唯一作用域，沿用原生助手的不可导出 P-256 生成、非交互签名与按标签读取。 [Spec](../context/plans/vp8-keychain-continuity-spec.md) · [Diff](../context/plans/vp8-keychain-continuity-diff.md)

## 合成 Keychain 实测

| 组合 | 结果 |
| --- | --- |
| 保留原助手，原路径 | 新 Node 进程实际签名通过，索引、keyRef 和公钥一致。 |
| 新编译的不同助手，原路径及同作用域长期副本 | 签名退出码 `3`，均为 `OSStatus -25293 (errSecAuthFailed)`。复制数据库未解除 ACL 限制。 |
| 保留原助手，且助手支持长期路径 | 同一助手字节、相同索引、keyRef 和公钥。长期副本与原址均通过独立进程的随机挑战验签。 |
| 保留原助手，但助手只接受 `/private/tmp` | 在长期路径的完整合成数据库对照中，原助手由自身路径检查拒绝，退出 `4`，无 OSStatus。换允许该路径的不同助手仍遭系统拒绝。迁移返回 `vp8_migration_signer_unavailable`，删除目标，原址继续签名。 |
| 原址缺失后从长期副本恢复 | 替换助手的坏副本无法签名，失败撤销新目录。换回原助手字节后，精确原路径恢复，新进程用原 keyRef 签名通过。公钥与完整索引同原件。 |

现有工作目录与副本均受独占创建保护，已有写锁保留，测试未改变用户 Keychain 搜索列表。设备 CLI 和插件仍沿用原 ACL。此前对现场旧助手的长期路径判定来自静态核对，长期目录中的签名只在合成对照中验证。

## 现场凭据备份与重开复查

2026-11-17，固件任务先使用原作用域和原助手完成 P-256 随机挑战验签。签名 DSH `0.2.2-rc.3` 正常退出，登记 owner 释放后，现场用当前 Hub CLI 的 `backup` 在用户家目录生成权限为 `0700` 的长期私有副本。六项文件与源逐项核对内容和权限，既有私有备份保留。

重新打开同一签名 DSH 后，原 profile 和绑定索引均与备份前逐字节一致，原作用域再次验签通过。「设置 → 桌面宠物设备 → 验证绑定」显示「本次已从设备核对持久绑定」，随后确认串口已释放。活动目录继续使用原址。现场恢复、重新绑定和烧录均未执行。原路径恢复的证据仍来自同机合成 Keychain。对应固件仓库报告为 `apps/round-pet/reports/2026-11-17-vp8-usb-enrollment.md` 的「现场凭据备份与重开复查」。

## 现场操作与回退

在单独约定的操作窗口执行。先记录正在使用的原作用域路径，停止使用这份作用域的登记插件 owner 和 CLI，确认在途操作结束。保留现有 profile、原始目录和原有私有备份。使用当前仓库版本的脚本，`vp8_active` 取已知的绝对原路径；命令不打开 USB。

```sh
node scripts/vp8-boot-review.mjs keychain-verify "$vp8_active" &&
vp8_recovery="$(node scripts/vp8-boot-review.mjs backup "$vp8_active")"
```

记录成功返回的私有副本路径。该目录包含受保护的原数据库、解锁文件、原助手、完整索引及已有的 USB 选择文件，继续在本机同一用户下保护。活动目录继续使用 `$vp8_active`。已有目标返回 `vp8_migration_destination_exists`，已有写锁时停止并确认实际 owner。验收以真实签名命令为准。仅用 `health` 可能读到公钥，但它不会签名。

原活动目录实际缺失、owner 仍停止且副本对应最近一次有效绑定时，按原路径恢复。保留副本用于后续恢复。

```sh
test "${vp8_active##*/}" = "vp8-boot-review-${vp8_recovery##*-}" &&
test ! -e "$vp8_active" && test ! -L "$vp8_active" &&
vp8_restored="$(node scripts/vp8-boot-review.mjs restore "$vp8_recovery")" &&
test "$vp8_restored" = "$vp8_active" &&
node scripts/vp8-boot-review.mjs keychain-verify "$vp8_restored"
```

只有成功后才恢复原插件入口。若原目录仍存在、迁移或恢复失败，保留剩余原件与副本，维持现有配置并核对原因。恢复为旧助手使用的同一绝对路径，不在 DSH 配置中填入恢复副本目录。对于支持长期路径的助手，`migrate "$vp8_active"` 另有选择，仅在新路径实际验签成功时返回；可通过原目录回退。现场旧路径助手走 `backup`／`restore`。

本机试验只覆盖原 macOS 安装及同一用户。macOS 26.4 起文件 Keychain 可能依赖系统保护的额外数据，因此结果不能用于推断换 Mac 或重装后的恢复。流程不读取或变更系统保护数据及 SIP。[Apple TN3137](https://developer.apple.com/documentation/technotes/tn3137-on-mac-keychains)

## 验证命令

- `node scripts/verify-vp8-keychain-continuity.mjs` 在真实 macOS 用户会话用随机合成作用域执行。测试结束删除自建作用域，输出 OSStatus 和布尔结果。
- `npm run check`、`npm run build` 和全量 `npm test` 通过。2,073 项通过，无失败或跳过，另有上述原生 macOS 对照。
