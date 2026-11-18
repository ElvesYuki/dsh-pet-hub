# VP8 BOOT macOS 原生适配与隔离 rc.3 Spec

2026-11-17。以前一片的 type 10／133、登记事务、私有索引和候选槽为基线。菜单和普通 Desktop 包沿用原审核摘要。本片只在私有临时目录、PTY、独立 Keychain 和隔离 DSH Desktop profile 中验证。正式设备端仍驻留 0.1.4，候选固件由固件任务处理。

## 原生 USB

真机候选仅接受宿主明确指定的 macOS USB CDC callout 路径与预期 USB location/serial。沿用已验证的 ESP VID/PID、IORegistry 父子关系和 TTY helper 的 `flock`、`TIOCEXCL`、raw、nonblocking。打开前后分别匹配 USB 身份，比较路径的字符设备节点与 fd 的 inode/dev/rdev。在每次交换前后复查路径，整个尝试持有同一个 fd。端口争用、路径更换、信号取消或不完整 I/O 终止该会话，等待在途退出再关闭。先清掉已排队字节，再发有界 VP8 文本请求。限制输入、长度、响应类型与期限，最终匹配继续由现有 proof 完成。PTY 的测试入口走相同 TTY 适配，缺少真机插件装配权限。

## 独立 Keychain

使用 macOS Security.framework 和显式独立文件 Keychain。Keychain 路径限定在本次私有根，搜索只使用该 Keychain。credential scope 与 device 决定标签。初始化才允许创建 Keychain，prepare 可生成首个 P-256，lookup/recovery/health 不生成、不换钥。只返回 X9.63 公钥和 ECDSA 签名。私钥通过 Keychain handle 使用，文本、IPC、argv 和索引均不携带私钥。独立 Keychain 的高熵口令用单独 0600 文件传入 fd，适用于隔离候选。限制 helper 生命周期和输出。禁止交互提示，若系统拒绝，关闭并提供人工复核入口。正常日常 Keychain／默认搜索列表不写入，生产凭据政策另审。

## 隔离 rc.3

独立候选包固定 rc.3；同时隔离 `DSH_HOME`、Electron userData 与运行目录。正常包和原 CLI 不引用此装配。本机签名 rc.3 把 renderer 请求交给 loopback Host，Connection 把 HTTP 请求重建为 `http://dsh.internal`。候选仅在 Electron Desktop profile 与显式独立目录内接受该内部契约，沿用宿主 cookie／owner 鉴权、精确路由、POST 标记及实例修订；裸 HTTP 匿名访问应被拒绝。启动及 GET 状态不打开串口。设置页加载、卸载和停止等待继续使用候选事务寿命。

提供可重跑的原生烟测、隔离包构建和准备命令、健康检查与恢复。回退停用隔离插件和自有进程，确认串口释放，保留有未知结果的索引与 Keychain。真机前要求同一候选发布身份、双方批准的设备 USB 身份和时窗、独立 profile 实测、Keychain 访问及释放检查。此轮不打开任何真板串口、不烧录、不切换当前 Desktop 或 pet。

重开后 `bound` 仅为已保存登记。设置页提供显式「验证绑定」，重新打开核对后的串口，仅发 type 6 和新的 type 10 fence。要求同一设备、完整 type 133 Bound、当前索引 revision 和原 Keychain 引用一致。成功只发布本次核对证据。失败保留索引。该入口无设备挑战、无 BOOT、无登记重发，旧免输入 STATUS2 查询独立保留。
