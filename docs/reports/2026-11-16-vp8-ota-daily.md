# VP8 日常 DSH 一键升级接入

2026-11-16。[Spec](../context/plans/vp8-ota-daily-spec.md) · [Diff](../context/plans/vp8-ota-daily-diff.md)。

## 日常入口及验证

本机 Personal DSH Launcher 为 `0.1.10`，内置回退包为 `0.2.1-rc.2`，当前 active 运行包为 `0.2.2-rc.1`（`fcc0ad4`）。active CLI、WebServer、Connection 均为 rc.1，Schemastery 3.19.0、Cordis 4.1.0。Launcher 用该包的 Web CLI 绑定 `127.0.0.1`，端口可变。Launcher 自己的 Web profile 没有 Hub，默认 `~/.dsh` 的 desktop profile 有 pet 0.4.8、无 Hub。日常 profile、Launcher 与后台服务未迁移。

从 active rc.1 的官方 Web 模板在临时 DSH_HOME 装载 `dist-dsh022`，使用 Launcher 同源 Web CLI 程序入口和 `loopback-listener` 配置。两次分别在不同的本地端口成功加载。已授权状态接口经真实 DSH WebServer → 私有 UDS → Hub，回显缺发布不可用。未授权返回 401，跨源返回 403，缺发布的同源升级 POST 返回 409，revision 始终为 0。带临时 Ed25519 夹具启动同一 CLI 后，设置页状态接口接收目标版本并要求先查设备。随后卸载临时插件，独立 DSH 路由返回 404，Hub 在卸载时仍可用，按序停服后 IPC 描述已移除。两个日常 profile 的 package、Cordis 根和 patch 文件前后摘要一致。实体 USB 和设备没有参与。

UI 与 PTY 回归覆盖缺发布提示、同版禁用、上次结果未知需先查询、拒绝未经批准的起始版本、真实传输前重查，以及历史一键 OTA 的单次重启顺序。签名夹具覆盖错误公钥、缺指纹、改签名字节、其他硬件、同版或回退起点、试验版本后缀、过大或摘要不匹配的镜像。正常 OTA 设备证据仍在 [rc.3 真机报告](2026-11-16-vp8-ota14-dsh.md)。

`npm run check`、标准构建、rc.1／rc.3 候选构建通过。带只读素材导出的 `npm test` 共 2,030 项通过，零跳过。最终 VP8 专项 3 项通过。rc.1 打包预检确认 167 个文件，含客户端与宿主入口，无固件、动画对象、公钥文件、签名文件或本机配置。脱敏宿主结果保存在 Git 忽略目录 `.cache/hub-vp8-ota-daily/host.json`。所有临时宿主与 profile 已清理。

## 日常安装与回退

1. 从 Launcher 的 active 注册表确认运行包仍为 rc.1。运行 `npm run build` 和 `node scripts/build-dsh022.mjs --host-version 0.2.2-rc.1`。用 `npm pack ./dist-dsh022 --pack-destination <私有暂存目录>` 打包本地候选。客户端与 host peer 必须对应同一部署。
2. 备份 Launcher 自有 Web profile 的 `package.json`、`cordis.yml`、`cordis.patch.yml` 和存在的 lockfile。按 Launcher 的 DSH_HOME 和 active CLI 入口运行 `dsh plugin --profile web add file:<包的绝对路径>`，检查与临时宿主相同的 bundle `dsh-pet-hub` 已登记。使用单独的 Hub runtime 目录，保留现有 pet 和其他插件。
3. 在安装 profile 中以插件 ID `dsh-pet-hub` 设置 `runtimeDirectory` 和 `vp8UpdateOrigin: loopback-listener`。Hub 随既有日常部署管理，以 `node apps/service/main.mjs --runtime-dir <私有目录> --vp8-update-config <0600 私有 JSON>` 启动。无可信发布时，可以保留固件查询入口。设置页需要本地授权码，查看状态或重启宿主均不发 USB 命令。首次现场查询等固件任务释放指定设备后人工执行。
4. 可信发布由实际发布方提供业务公钥、独立核定的 SPKI SHA-256、公钥对应的原始 JSON 分离签名及设备批准的签名镜像。按下方契约在 Hub 私有 JSON 中配置 `releaseSource`，检查 Hub 状态后再安排未来升级。当前没有可用于日常环境的发布信任配置和目标镜像，台架资料只用于历史取证。
5. 回退先撤掉该 profile 的 `vp8UpdateOrigin` 或 Hub bundle。确认活动作业终态再停止本次 Hub，按原备份恢复 Hub 所引入的差异并刷新 Launcher。停服或页面无回执后先只读查询设备，已知待启动槽、未知写入和设备回退交由固件侧核对。

## 发布契约

私有 JSON 的 `protocol` 为 `media2`。在已有私有设备配置基础上，`releaseSource` 使用 `manifest`、`signature`、`trustKey`、`image` 四个绝对路径和 `trustKeySha256`。指纹为独立核对过的小写 64 位十六进制 SHA-256，取 Ed25519 公钥 SPKI DER 字节。公钥文件为公开 SPKI PEM，签名文件为对发布 JSON 原始 UTF-8 字节生成的 64 字节二进制签名。发布 JSON 唯一字段集为 `schema: 1`、`product: round-pet-175c-en-vp8`、`version`、`fromVersions`、`bytes`、`sha256`。发布版本与允许起点均为稳定三段版本，起点必须早于目标。设备仍用内置公钥独立认证镜像。CLI 以只读快照载入发布信息，切换可信发布需要在无活动作业时重启 Hub。
