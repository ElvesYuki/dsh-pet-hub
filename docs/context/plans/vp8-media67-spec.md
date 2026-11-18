# 1.75C-EN STATUS2 与 MEDIA2 管理端 Spec

2026-11-16。独立 DSH `0.2.2-rc.3` 对接 `ota_1`／`0.1.3`。可信 runtime 私有配置以 `protocol: "media2"` 选择新模式。默认不启用 VP8，既有 VP8 配置缺省时继续使用 STATUS1／UPDATE1，PET4 保留原入口。

- 通过已核定的独占 Espressif USB 发 `STATUS2`，解析 busy、selected、实际槽及运行版本。面板只显示当前版本、槽和维护状态。STATUS2 不声明动作库存。安装入场重新核对设备未忙且未选择待启动槽。
- MEDIA2 本轮固定角色 0、动作 67、素材版本 1、241 帧、440,248 B，SHA-256 `8a5f277f72213615a722f230047888e8adf60191cb4e19ad2c8d1b75b11b60c8`。复用外部只读对象校验和短时 HTTP，精确 `GET /asset.ivf`。素材及秘密留在私有位置。持续复用同源授权、服务实例及 revision 约束。
- 本次命令的 `ACCEPTED` 后收到相应 `MEDIA_SAVED`／`MEDIA_EXISTING` 才显示已保存。保存状态不由 STATUS2、HTTP 或 ACCEPTED 推断。断线、超时及回执缺失均保持 Unknown，允许用户显式重新发起以取得真实结果，不自动重发。新面板只提供查询和安装，不发固件升级、播放、重启或取消命令。旧模式取消语义保持。
- 先跑真实 PTY 和临时宿主，查固件 `ready.json` 且 `released=true` 后才碰真机。用独立 DSH profile 和浏览器点击查询及一次安装。仅使用已核定 USB 设备和私有测试 Wi-Fi。结束后关闭临时 HTTP 与 USB，验证退出及写脱敏交接文件，固件任务接手验证离线读回及播放。若失败，保留真实未知结果并等待固件核对，不补发安装。
