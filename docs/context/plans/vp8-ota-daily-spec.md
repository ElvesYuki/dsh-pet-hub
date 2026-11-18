# VP8 日常 DSH OTA Spec

2026-11-16。Personal DSH Launcher 当前 active 为 `0.2.2-rc.1`，验证使用该运行包的 Web CLI 与临时 DSH_HOME。日常 dsh-home 的 Web profile 尚无 Hub，另一个默认 `~/.dsh` 的 desktop 有 pet。日常发布信任配置尚无证据。固件台架 release 只作为历史真机证据。

复用 Hub 单实例与私有配置、DSH WebServer loopback 同源代理、设置槽、USB 认领与设备 OTA2／SELECTED／REBOOT2／STATUS2。页面加载和状态轮询只读 IPC，设备查询和升级分别由人工操作。设备写入时继续使用本次批准的精确对象摘要、大小和签名格式，设备执行原有验签。仍只认领一台指定设备。

Launcher 使用 `127.0.0.1` 并可能分配新端口。配置显式选择 `vp8UpdateOrigin: loopback-listener` 时，从直接 loopback 请求的本地 socket 确定端口与协议，要求远端也是本地并继续精确比较 Host 和 Origin。原固定 origin 与空值关闭行为保留。不从转发头或浏览器提供的 Host 推导授权 origin。

日常 CLI 的私有配置可选 `releaseSource`，显式指定绝对路径 `manifest`、`signature`、`trustKey`、`image`，以及从发布方独立核对的 `trustKeySha256`（公钥 SPKI DER 的 SHA-256）。Hub 读取有界常规文件，拒绝符号链接。外部配置的 Ed25519 业务发布公钥与 ESP 内置镜像验签公钥分工独立。对签名发布的原始 JSON 字节验签后，严格验证 schema、产品、目标版本、允许起点、镜像长度、摘要和签名布局。当签名、元数据、镜像或任一路径缺失/错误时，继续提供查询，升级不可用。命令时重新校验将要发出的同一份镜像字节。旧台架的明文 release 只保留给既有程序化夹具，CLI 不采用。

发布版本和准入理由经原白名单投影。显示已是发布版本、等待查询、设备忙/待启动、来源不兼容、发布不可用及此前结果未知。未知后需要显式查回空闲状态，旧成功回执不复用。查回可显示实际版本；本次成功依然要求 SELECTED 后同设备、运行槽改变和目标版本匹配。只允许签名清单明确支持的较旧稳定版本迁移。物理设备保持交给固件任务。
