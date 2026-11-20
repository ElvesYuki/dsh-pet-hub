# 桌面宠物设备 USB Wi-Fi 配置 Diff

- 在 BOOT owner 的绑定核对分支中复用既有探测、fence、Keychain 与索引逻辑，接入小型 DESKNET2 编解码和同 fd 控制。既有只读 STATUS2 和电池路径继续共享原 USB lease。无新增后台任务或持久格式。
- 在独立登记包新增一个 streaming POST，保留旧 `/status` 与 `/command`。沿用同源 Cookie、授权及 no-store。请求体为 2 字节大端 JSON 长度、有界 UTF-8 元数据和原始密码尾部。页面现有设置槽内增加 Wi-Fi 项。
- 组合候选主包和零槽登记包各提升版本。固件继续使用原 NVS 配网记录。回退时恢复原主包和登记包组合，或停用登记候选并等待 USB 退出。插件回退涉及宿主文件，不会清除板上配置；设备配置变化由用户通过受支持的显式操作分别处理。
- 隔离宿主验收优先使用已构建包、实际 Cordis 及 Connection `/api` 组件。测试替身仅提供临时 HTTP 载体、凭据记录和 USB 设备回复。验收结束撤销两个包的挂载、核对临时 socket 回收并停止自有 loopback，无现场宿主变更需要回退。
