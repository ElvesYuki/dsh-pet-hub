# 1.75C-EN VP8 动作 1 插件候选

固件仓库报告确认 `56644ffd` 留驻。设备已验证 USB 请求、LAN HTTP 下载、Flash 回读和提交、重复安装、停服及 USB 拔插后离线播放。当前维护对象固定为 400×400 VP8 profile 1 IVF，源 24 fps、241 帧。Hub 只读核对文件为 418,536 B，SHA-256 `c47eae037765066dfd9c5c632ee32019487d22f831a8e9a83e4ab1a51710838c`。固件报告记录导出沿用原动作与裁切。此次只按交接用于局部验证，没有给素材授予产品分发用途。[管理端 Spec](../context/plans/vp8-action-update-spec.md) · [Diff](../context/plans/vp8-action-update-diff.md)

## 宿主证据

用构建产物的正式 `apply` 和 `client.js`，在临时 WebServer/slots 宿主验证路由注册、设置面板、授权、卸载和共享 Hub 继续运行。HTTP 代理连接真实私有 UDS。设备替身经真实 POSIX PTY 和独占 helper，HTTP 素材下载走独立临时 loopback，读取原固件导出对象并逐字节比较。用例覆盖默认关闭、越权来源、过期 revision、串口日志与碎片、同长度坏 SHA、精确路径与长度、无 Range/分块、重复安装无下载、失败、取消、发出后断开、未知状态查回、到期清理。PET4/PBP1/PMA1 走原入口做回归。这里的插件宿主是可重复的夹具，真实 DSH profile 的加载与设备联动仍待验证。

```sh
npm run check
npm run build
node scripts/build-dsh022.mjs
ROUND_PET_MEDIA_ROOT=/path/to/ai-embedded-studio npm test
```

真实导出分支需要以上环境变量。未提供时只运行授权、查询和拒绝用例等不依赖原素材的分支。原始素材、凭据、网络配置和日志均留在私有本地位置。

首次全量回归发现，停用 VP8 时的空清理步骤改变了旧服务同步关闭顺序，新客户端和宿主 schema 也触发了历史 TCP26 产物 SHA 拒绝。已恢复旧关闭顺序，并在仅导入的准备脚本登记新版两件产物的精确摘要，原 TCP26 证据保持，混用或漂移继续拒绝。包含上述问题的定向复测 43 项通过。

最终 `npm run check`、标准包及 DSH 0.2.2 候选构建、Hub 独立导入审计通过，带真实导出的 `npm test` 通过 2029 项，零跳过。两个候选包均无 IVF／PET 文件。

## 下一轮实际插件联调

独立 DSH `0.2.2-rc.3` 已通过真实设置页和真机查询。实测本机使用 `node scripts/build-dsh022.mjs --host-version 0.2.2-rc.3`，产物为 `dist-dsh022-rc3`。剩余现场窗口为从空库存首次安装。[DSH 与真机查询记录](2026-11-16-vp8-action-update-dsh.md)

1. 等设备任务释放串口并确认应用版本和当前动作 1 的提交状态，固定本机这块 1.75C-EN 的 `/dev/cu.usbmodem…` 路径。设备命令不携带序列号或摘要，`STATUS1` 仅识别能力和固定对象状态。换线或串口重新枚举后，重新核对物理设备与候选。
2. 在独立目录构建插件，按测试宿主版本选择 `dist` 或 `dist-dsh022`。编译 `native/native400-pbp1-tty.c` 到私有目录，例如 `cc -std=c11 -D_DARWIN_C_SOURCE native/native400-pbp1-tty.c -o <绝对路径>`。创建权限 `0600` 的私有 JSON，包含 `port`、`helper`、`file`、`address`、`ssid`、`password`、`operatorToken`。`file` 指向批准用于本次验证的 IVF；`address` 为同网段本机 RFC1918 地址。授权码使用本轮随机 32 字节的小写 hex。空口令只用于开放网络。用 `node apps/service/main.mjs --runtime-dir <私有独立目录> --vp8-update-config <绝对路径>` 启动独立 Hub。
3. 只在独立 DSH 测试 profile 加载候选，配置 `runtimeDirectory` 为该 Hub 的目录，`vp8UpdateOrigin` 为实际数值 loopback origin（含端口，不带尾斜线）。在“实体宠物设备”设置内输入授权码，先按“查询设备”。出现设备尚未保存时才按“安装动作 1”。已保存的设备仅验证查询与幂等，需要真正写入的窗口由设备任务提供。
4. 记录 `SAVED` 与显式 `STATUS1` 查回。HTTP 200 及 `ACCEPTED` 只作进度证据。连接中断后点“查询设备”。取消等待 `CANCELLED`，已提交竞态可收到 Saved。屏幕实际播放由设备侧验收。
5. 退出时先取消活动作业并等终态，禁用测试 profile 的插件或清空 `vp8UpdateOrigin`，停独立 Hub、释放 USB／HTTP，移除该轮私有配置。已保存对象留在设备。若需要回退固件或 Flash，由设备任务按 `113f086e` 应用槽和保护区流程执行。

本轮未操作实体设备，未修改或启动生产 DSH、pet、bridge 或固件。PET4 与 VP8 使用各自维护入口。
