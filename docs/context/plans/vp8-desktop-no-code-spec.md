# Desktop 已登记设备免输入查询 Spec

2026-11-17。仅 macOS Electron Desktop profile 的托管 Hub 可启用免输入。还需本插件实际持有该只读 owner。附着外部 owner 时提供原输入入口。仍由 DSH Connection 校验 owner principal，本地授权文件、已登记 USB 身份和实例／revision 保持。

免输入仅在专用精确 GET status 与 POST query 路径使用服务端 0600 文件取得的凭据。POST 需既有自定义头、JSON 和精确查询信封。后端持有固定实例、撤销信号与严格 operation，无通用代提交能力。禁用插件或结束托管撤销该能力。允许页面轮询已有状态，USB 查询只由用户点击触发。缺少设备或登记身份不匹配时提示接入已登记设备，不写入新登记。

原输入、显式挥手、Web、OTA、素材、配网均保持原权限。现有登记依赖主机与 USB 身份，BOOT 配对需设备协议另行实现。宿主负例、真机单次 STATUS2、同桌面会话、私有配置与旧包回退均纳入验收。
