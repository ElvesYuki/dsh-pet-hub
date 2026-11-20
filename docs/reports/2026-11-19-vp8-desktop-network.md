# DSH 桌面宠物设备 USB Wi-Fi 配置候选

2026-11-19。`dsh-pet-hub` `0.0.6` 与零设置槽的 `dsh-pet-hub-boot-review` `0.0.3` 已打包，供 DSH `0.2.2-rc.3` 隔离验收。[Spec](../context/plans/vp8-desktop-network-spec.md) · [Diff](../context/plans/vp8-desktop-network-diff.md)

## 行为与范围

- 「设置 → 桌面宠物设备 → 设备 Wi-Fi」先手动读取状态。保存和清除各由独立按钮触发。每次通过同一独占 USB 描述符核对绑定、持久索引和登记密钥，再探测同设备的 DESKNET2。USB 电池、传感器和手动查询均沿用共享 lease；应用卸载等待 USB 实际释放。
- 按请求 ID 和操作校验 `ok`、`saved`、`cleared`，独立展示配置有无、写回执和 INFO 观察的连线状态。失去写回执时状态为未知。重新读取 INFO 可确认当下是否有配置，无法核实凭据是否为上次提交的版本。再次保存需用户重新填写密码并点击。
- 绑定后端缺少新路由时显示升级配网候选提示。固件未回 INFO 时在同一个串口只读尝试 STATUS2。若有版本则显示该版本未应答 DESKNET2。该观察也可能由暂时无响应造成。旧固件无页面写入降级。
- 无密码回显、日志、命令行或应用持久存储。浏览器使用非受控密码字段，点击后清空。Connection 承载有界二进制体，应用在读取、编码和 I/O 完成后清除自己持有的凭据缓冲。设备持久保存由固件处理。设备直接运行 SNTP 和天气同步。

## 离线验证

- 五项配网专项覆盖字段边界、请求关联、错绑定密钥、旧固件只读、分块体及取消、短写及分片回执、共享串口互斥、断开释放和写入超时后的只读恢复。
- Node 编码与固件只读 `desktop_internet.h` 的 C++ `desktop_network_command` 请求解析器对拍。SET 带多字节 SSID、合成密码及精确坐标。回执由测试夹具按固件格式生成。设备 NVS、STA 和 ESP 主循环未运行。
- 实际 npm tarball 解包验收单设置槽、已有设备查询、配网按键、旧后端提示、密码清除和未知结果锁定。候选包仅包含代码与许可文档。后续使用同一对 tarball 补齐实际 Connection 转发验证，见下节。
- `npm run check` 和 `npm run build` 通过。首次 `npm test` 有 2,090 项通过，旧素材 A6-25、R6-23、R7-26 命中校验或请求截止时间。三项单独复跑通过。随后用 Node `--test-concurrency=6` 执行同一全量用例及本机只读固件向量，2,093 项全部通过，无跳过。

| 候选包 | SHA-256 |
| --- | --- |
| `dsh-pet-hub-0.0.6.tgz` | `22e5ec1c8f80044d0b96a4c2fd3bdaa294be26e5c089761aa8c6d40b2a4366e3` |
| `dsh-pet-hub-boot-review-0.0.3.tgz` | `933b563b1a4fb7fe9b6c82dbadff014540eef3d90efab7d3ad83d1e7023740c6` |

## 实际 rc.3 Connection 隔离验收

2026-11-19。从上述 tarball 按导出入口解包加载。已安装 DSH `0.2.2-rc.3` 的 Electron `44.7.0` 以 `ELECTRON_RUN_AS_NODE` 运行，使用安装包内的 Cordis、Schemastery 和 Connection `/api`。从同一安装包读取并直接执行 Desktop 的 `forwardWebRequest`，由自有动态 loopback HTTP 载体挂载实际 Connection。凭据存储、USB 与 Keychain 为合成夹具。页面使用发布 bundle 的设置组件和测试 React 事件载体。完整 Electron 设置窗口和实体串口未参与。

| 项目 | 结果 |
| --- | --- |
| 请求准入 | 无 Cookie 返回 401，外来源和错误内容类型返回 403。使用真实启动票据交换测试 Cookie，分片二进制请求经过 Desktop 转发与 Connection 的 streaming 路径。 |
| 设备页与配网 | 查询状态仍可用，电池取消后同 ID 采样仍回 `cancelled`。实际客户端 bundle 点击 INFO 和保存可穿透整条宿主链，密码字段清空且页面快照无密码。合成设备区分 `saved`、后续 INFO `online`、`cleared` 和 `unknown`。 |
| 失败与退出 | 丢写回执和客户端中止均无自动重发。无 DESKNET2 的夹具只读查询版本。旧 revision 和重挂前实例返回 409，撤销后路由返回 404。九次合成串口打开均释放，主包退出后私有 `hub.sock` 消失。 |

安装包 `dsh-client-connection/lib/index.js` SHA-256 为 `0ebcca7583e082716f79b0b55bc1749d48269cc8db2989b043b321b57abd3684`。执行的 `forwardWebRequest` 函数 SHA-256 为 `e9cfb9d0b84cdd1a4c7ac5d5dc32c8068d7a66162e9fe9f78ed0c502c6c80eb2`。Electron 打出已有的 `task_name_for_pid` 警告，测试进程正常退出。

本阶段 `npm run check`、`git diff --check` 和 `npm test` 通过，2,093 项无失败或跳过。

## 固件侧实板与只读交接

固件任务使用登记包 `0.0.3` 实际路由、原 Keychain 绑定和独占 USB，在 `0.1.25-battery-usb-pair-test`／`ota_1` 观察到 INFO 未配置、一次 SET `saved`、再查 INFO `online`。软复位后板端自行重连并完成 SNTP，原绑定仍可核对。`0.1.24` 保留于 `ota_0`。天气未配置，证据见固件仓库 `apps/round-pet/reports/2026-11-18-vp8-usb-network-vpc1.md` 的「2026-11-19 真机验证」。

串口交接后，管理端在独立 rc.3 进程用发布设置页组件发起一次 INFO。真实 USB 节点存在，当前执行环境读写准入检查返回 `EPERM`。该次请求返回 `unavailable`，没有得到设备绑定或联网确认。绑定索引摘要一致，测试路由和进程已回收。本次合并采用上节的实际 Connection 转发证据及固件侧实板证据，完整设置窗口读回待验。

## 下一次验收与回退

1. 在具备已登记 USB 访问权限的 rc.3 窗口验收实际设置页入口和 INFO 状态文案。板上已联网，可以直接读取。需要覆盖设置页提交时，由用户显式操作并使用单独试验窗口。纯电池联网、实际天气、清除和物理拔插仍待实测。
2. 若宿主需回退，停用候选并等待串口释放，恢复主包 `0.0.5` 和登记包 `0.0.2` 的既有组合。设备配置由设备持久管理，剥离候选后须使用受支持入口另行恢复或清除试验网络。

管理端两包只加载到自有子进程。现有 DSH profile 和运行实例保持原状，管理端本轮未写 Wi-Fi 或执行刷机、复位。
