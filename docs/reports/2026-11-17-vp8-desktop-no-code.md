# Desktop 已登记设备免输入查询

2026-11-17。[Spec](../context/plans/vp8-desktop-no-code-spec.md) · [Diff](../context/plans/vp8-desktop-no-code-diff.md)。

已打开的签名 DeepSeek Harness Desktop 0.2.2-rc.3 加载新版 Hub。配置只增加 `vp8DesktopNoCode: true`。同一进程、pet 0.4.8、登记身份和 0600 私有授权文件保留。新路由由原 Desktop Connection 验证 owner，并只对本插件实际托管的实例开放。服务端按固定实例与 revision 使用原凭据，页面不收取、保存或回显凭据。退出或停用托管撤销该查询能力。外部 owner 和手动挥手继续使用原授权码。

## 验证

打开真实设置页后，未显示授权输入或挥手按钮，页面轮询仅更新 IPC 状态。查询前 revision 为 0，USB 无持有者。未用剪贴板，在「实体宠物设备」点一次「查询设备」，确认唯一操作为 STATUS2，页面显示 `0.1.4`／`ota_0`，随后确认串口空闲。Hub 继续由现有桌面托管。脱敏证据在 `.cache/hub-desktop-rc3-no-code/proof.json`。

宿主负例覆盖错误实例、错误 revision、命令或非查询路径、缺少 POST 头、额外字段、显式凭据出现在免输入分支、托管撤销、外部 owner 与替换 USB 身份。模拟替换 USB 在打开前被拒绝，设置页相应提示接入已登记设备。没有为未知设备写入登记。现有 0.1.4 没有 VP8 BOOT 配对接口，新板短按 BOOT 登记留给后续固件和联合验收。

`npm run check`、标准构建、rc.1／rc.3 候选构建通过。全量 `npm test` 通过 2,039 项，零失败、零跳过。本轮未触发挥手、OTA、素材写入、Flash、配网或重启。

## 回退

停用 Hub 后，移除该插件配置中的 `vp8DesktopNoCode` 并重新启用，即恢复授权输入和自动托管。完整回退可用私有 `.cache/hub-desktop-rc3-no-code/profile-before/package.json` 记录的上一版 Hub 本地包。保留原授权文件、登记身份和 pet。已经存在的 `start-wave` 命令不随本次开关变化。
