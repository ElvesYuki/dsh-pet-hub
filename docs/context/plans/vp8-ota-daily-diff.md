# VP8 日常 DSH OTA Diff

2026-11-16。

- app CLI 接签名发布读取器，缺发布仍启动原 VP8 owner。测试材料仅在临时宿主自己生成。
- runtime 将当前硬编码升级对抽成发布目标及允许来源，添加当前状态准入并保留执行时重新探测。维持 USB、LAN HTTP、签名检查与 receipt 规则。
- 既有插件白名单和共享设置页增加可用状态。Launcher 的动态端口可显式选择直接 loopback listener 校验；固定配置继续兼容。原 rc.1 构建产物新增固定客户端摘要，历史客户端摘要继续有效。
- 用 active rc.1 的官方 Web profile 启动入口在临时 DSH_HOME 复验安装、查询、缺发布和卸载。签名、同版本、未知与无自动命令通过宿主测试覆盖。保持本机日常 profile、Launcher、pet 和服务不写入。
- 日常迁移入口先核对 Launcher active/peer，备份 profile、隔离 Hub runtime 与私有配置，再加载精确候选。取得发布方独立公钥、签名元数据和镜像才解锁升级。回退先关闭操作入口，确认 Hub 终态再退出，只恢复备份中的 Hub/plugin 差异。未知写入由设备侧核对。
