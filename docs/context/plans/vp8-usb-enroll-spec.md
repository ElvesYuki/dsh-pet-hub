# VP8 直连 USB 一键绑定 Spec

2026-11-17。用户选择在当前已打开的 DSH 中点一次绑定，设备无需 BOOT。管理端本轮交付默认关闭的候选，保持当前安装、免码查询、历史 BOOT 和固件 0.1.4 回退。只验证隔离宿主及合成设备，保持真板串口关闭。

## 线协议和状态

- 一次明确的 `enroll-usb` 操作才启动。沿用指定 USB callout、IORegistry 身份前后复查和独占 fd。已明确登记的物理 USB 是信任边界。应用启动、页面 GET 和新设备插入本身不发命令。
- Type 6 的成功、未绑定状态必须同时声明 bit2 和 bit3（在现有 bit0、bit1 之上，当前掩码要求低四位为 15）。无 bit3 提示 USB 一键绑定不支持。历史 `enroll` 独立使用 op1，候选操作不降级。
- 持久写入 pending 和精确目标后才发 Type 7 op3。Type 130 校验 op3、非零 reference 和 32 字节挑战。签名仍为旧 `PBP1/persist/enroll/v1` transcript、同 boot、设备/控制者/绑定/新代数、该挑战及公钥。Type 8 保持原布局、原 reference 和 P-256 签名。
- Type 132 必须为 OK/Bound、同 boot／设备／ref 和新代数，另核对控制者、绑定及公钥摘要前缀。随后立即以同一次受信 Type 6 和同一 pending 目标生成 Type 10 fence（mode=1、reference=0、新 nonce）。通过 Type 133 的完整状态、nonce、身份和 32 字节公钥摘要核对才原子提交 bound。
- 中断、丢 132、错回执、fence Unbound／故障或持久提交不明保留 pending。下一次显式 recover 走已知 Type 6／10／133，既有规则允许成功 fenced Unbound 清除 pending。重开后的 verify 不发挑战或提议。本地 schema、Keychain 引用和历史 BOOT 事务保持兼容。

## 候选装配和回退

候选由受信宿主显式启用 USB 模式，设置页只展示该模式的写入按钮。复用 rc.3 精确 Connection 路由、owner 鉴权和实例／修订。运行时真实串口不接受页面传入设备路径。当前日常 DSH 还需要单独审查热加载和权威 USB／Keychain owner 接线，通过后才能启用此按钮。现有签名 Desktop rc.3 支持既有查询插件的热加载，先评估在同一实例按独立候选包安装的边界。隔离验证使用宿主夹具，不另开 DSH。回退关闭候选，保留 pending 及原签名引用供对账。
