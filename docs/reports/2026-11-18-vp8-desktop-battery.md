# VP8 Desktop USB 电池查询

2026-11-18。主 Hub `0.0.4` 已在签名 DeepSeek Harness Desktop `0.2.2-rc.3` 安装、重开并现场验收。「设置 → 桌面宠物设备」主卡实读电量、电压与充电状态。归属待核对时在「USB 查询结果」独立展示，明确冲突时隐藏电池数据。 [Spec](../context/plans/vp8-desktop-battery-spec.md) · [Diff](../context/plans/vp8-desktop-battery-diff.md)

## DSH 页面现场验收

- 现场通过原 CLI 更新主包 `0.0.4`，核对安装包摘要与本报告一致。登记包仍为 `0.0.2`，原 profile 补丁逐字节一致。`0.0.4` 留驻，原主包 `0.0.2` 已备份。
- 重开后主卡自动显示电池。手动「查询设备」读到 `0.1.6-battery-usb-pair-test`／`ota_0`，「验证绑定」读回持久绑定。电量和电压随采样从 13%／3666 mV 更新至 14%／3667 mV，显示恒流充电。
- 离开再进入设备页，重新读取 14%／3670 mV。再次离开后，在连续 6 秒内做了 12 次宿主检查，均未见串口占用。轮询间隔与退出取消另由宿主专项测试覆盖。

现场证据见固件仓库 `apps/round-pet/reports/2026-11-17-vp8-battery-usb.md` 的「DSH 页面现场接入」。

## 固件和管理端证据

- 终端当前在 `0.1.6-battery-usb-pair-test`／`ota_0`。固件任务首轮十次实读为 99%、4190–4192 mV、恒压充电，紧接查询返回 `rate_limited`。后续 60 秒内 13 次 5 秒采样全成功，低电量时读到恒流充电。串口证据覆盖 USB 挥手，实屏确认实体触摸后挥手并回待机。终端证据见固件仓库 `apps/round-pet/reports/2026-11-17-vp8-battery-usb.md` 的「真机电池和轮询数据」。设备保留 `0.1.5-usb-pair-test`／`ota_1` 回退及 `0.1.4` 本机槽备份。
- Hub 宿主验证使用模拟串口、可控时钟和实际 npm tarball。覆盖随机请求 ID、短写、分片、迟到和畸形回包、0%、na、无电池、旧固件、节点消失、权限、忙碌和限流。取消用请求标识关联，旧请求不会恢复页面状态，实际关闭后才释放共享 USB。650ms 快照不发硬件请求。普通 Desktop 客户端审核摘要保持一致。
- UI 首次读取免码 owner 后才采样，各次完成后约 5 秒重试。宿主复核批准的 USB 身份，单请求占用，忙碌就跳过。退出清定时器、取消请求并发送独立关闭信号。响应等待上限 900ms，宿主路由截止 4.5 秒；原生串口初始化及实际关闭收尾期间仍持有互斥。上次成功值在采样失败或超过 7.5 秒时标为旧值，15 秒后隐藏；断开被发现后立即清除。板端仅用既有 USB。

## 根入口修正（历史）

现场安装 `0.0.3` 并关闭重开 DSH 后，设备页经 STATUS2 读到实际 `0.1.6`，电池区未出现，现场先恢复主包 `0.0.2`。`main` 已指向合并宿主，`exports["."]` 仍指向 `host-022.mjs`，rc.3 从该根导出进入普通宿主。此前测试直接导入路由模块，绕过了这一装配。`0.0.4` 将合并包的两项都设为 `./apps/dsh-plugin/host-desktop-combined-rc3.mjs`。实包逐文件比较只见 `package.json` 变化。

解开发布 tarball 后，通过 `import('dsh-pet-hub')` 加载根入口。在 rc.3 自带的 Electron Node 模式、Cordis 和 Schemastery 下启动临时 Hub，仅用临时 Unix socket 和注入 Connection。`0.0.3` 对照得到只读查询的初始状态，缺少 `batteryAvailable` 和电池路由。`0.0.4` 得到 `batteryAvailable: true`，并通过电池路由的取消及已取消请求回执验证，卸载后路由与 socket 均释放。常规 rc.3 包名导入回归维持普通宿主和原查询路由。`npm run check`、构建和全量 `npm test` 通过，2,077 项通过，无失败或跳过。

## 已验收安装包与回退

| 文件 | SHA-256 |
| --- | --- |
| `dsh-pet-hub-0.0.4.tgz` | `888bc9acad30565a5ef2494b8152331cb49c9604afd791045b0d5fae6cb25926` |
| 历史 `dsh-pet-hub-0.0.3.tgz` | `233cf466ef465cb00e34e92b5f56832c3a200f6aac93f58a02b1759ad49e09a0` |
| 原 `dsh-pet-hub-0.0.2.tgz` | `5fa234bbfb8d7666fee7271c270678ca50ee959934999fb3dea792c4c660958b` |

现场在现有 Desktop profile 执行以下命令更新主包。`hub` 指向已核对摘要的 `0.0.4` 本地包。

```sh
dsh plugin --profile desktop add "$hub"
```

回退前离开设备页并确认 USB 释放。以同一命令恢复已备份的主包 `0.0.2` 本地文件引用。[原主包和登记包记录](2026-11-17-vp8-desktop-device-page.md)
