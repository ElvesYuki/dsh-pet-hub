# native400 发送器接入 PMA1

2026-11-11。Node runtime 新增显式 PMA1 入口。认证负责握手、记录和授权，实际发送仍走现有 native400 sender 的 compact78 身份、只读文件、双遍 SHA、单块等待 ACK、取消和回执。终端侧只读报告已记录独立 C++ 对拍及使用真实素材的 11 个认证 TCP/NOR 场景。管理端本轮使用原创 PET4、合成密钥和独立 Node 对端做真实 TCP 回归。[Spec](../context/plans/tcp-media-auth-sender-spec.md) · [Diff](../context/plans/tcp-media-auth-sender-diff.md) · [线级契约](../protocol/native400-media-auth-draft.md)

## 显式入口与配对材料接口

`prepareNative400AuthenticatedMediaTransfer(options)` 从 runtime 导出。调用者显式设置 `enabled: true`，提供原 `directory`、`sourceBytes`、`indexBytes`、来源 `decision`，可指定 `timeoutMs`（1–30000 ms）。返回原有 `start(socket)`、`query(socket)`、`cancel()`、`close()`、`snapshot()` 和 `resources()`。socket 必须由调用者独占交付，地址两端均为 `127.0.0.1`。入口不创建监听器、连接、USB 操作或密钥存储。

- `pairing.identity` 固定 `{device, hub, binding, epoch}`，前三项各为 32 位小写十六进制字符，epoch 为非零规范十进制 u64。`pairing.acquire(identity)` 是可信进程内的同步注入接口，返回当前绑定代 `{key, revoked}`。`key` 为 32 B 对称 `KeyObject`，`revoked` 为该租用的 `AbortSignal`。修复和查询各重新获取一次，只在 D_INIT 的身份提示与原固定身份一致后调用。应从当前激活且未撤销的本地配对记录供应，禁止从网络、文件路径、普通 JSON 或页面导入。未来慢速密钥存储可先由可信 owner 预备后再同步租用。
- `authorize(request)` 是可信的同步用途审批回调。调用时已验证互认证、boot/root/代数和来源文件。请求固定 `purpose`、`pairing`、完整 `begin`（包含已分配的 job）、`beginSha`、`manifestSha`、`indexSha`、`licenseRef`、`sourceApprovalId` 和 `deadline`。返回 `{request, id, expiresAt}`，其中 `request` 必须是原冻结对象，`id` 是非零 16 B 小写十六进制，`expiresAt` 使用本进程 `performance.now()` 时钟。未来可信 owner 须据单笔用户批准发出并消费决定，普通来源 `decision` 只固定来源与设备目录。握手、文件预验和授权任一失败均不发 BEGIN，授权到期不续期。
- 握手最多 5 s，GRANT 可缩短原连接截止。头长、方向和标签通过才交给原 sender。接到撤销会关闭连接，等待 socket 和文件退出，并清理本会话派生密钥缓冲。引用由密钥供应者管理，候选没有持久化密钥。首次尝试发 GRANT 后作业不可再启动，实际尝试发 BEGIN 后的传输错误保留 Unknown。
- `query(socket)` 只在原内存作业 Unknown 时显式调用，使用新的认证握手、原配对代、原 boot 和完整 job，整连接最多 5 s。管理端的查询窗口从初次退出起最多 120 s，终端实际收据可更早失效。目录推进不补造 `Saved`，查询不会触发授权、GRANT、BEGIN 或 DATA。换 boot、换 epoch、撤销或认证失败保留 Unknown。

## USB 配对交接

未来可信 USB 配对 owner 应在用户确认实物和独立维修入口后，向两端暂存绑定元组和每绑定随机 32 B PSK。两端应独立计算并显示同一指纹，经确认及终端激活回执后，host 才在 `acquire` 中提供当前代。初轮可只在 RAM 持有秘密。USB 命令、指纹显示、确认顺序、掉电/取消、端侧熵源和安全存储由双方联审。密钥不经串口日志、普通配置、素材目录或 UI。撤销先断开旧 lease，轮换才可登记新代。此前仅以合成绑定喂入上述接口。

## 验证与回退

```sh
node --test tests/native400-media-auth-sender.test.mjs tests/native400-tcp-media.test.mjs tests/native400-media-auth.test.mjs
```

- 9 个新增真实 TCP 场景，覆盖完整素材、冻结 job 后授权、裸 PTM1/错模式/错代/坏证明、源变更和失效决定、单块背压、半帧 ACK 中取消、提交后取消保留 Saved、撤销、坏 Saved、实际 EOF 后只查询、错 boot 与截止。既有 9 个认证向量专项和 18 个裸 PTM1 专项也通过。
- Node 24.14.1、npm 11.11.0。`npm run check` 通过。显式启用既有 C++/NOR 回环的 `npm test` 完成隔离构建，全量 1999 项通过，零跳过，耗时约 121 秒。新回环临时目录已清理。
- 终端上游 `2026-11-11-pma1-commit-loopback.md` 中的 C++ 认证 TCP/NOR 证据使用此前 Node 参考实现。管理端本次回归的已保存回执来自独立测试对端。本 runtime 与终端认证收据候选的联合回环、USB 配对、STA、实机保存和 LAN 准入待验证。
- 回退只需调用 `close()` 并撤去显式启用。既有裸 PTM1 测试入口、PTC1、DSH、pet 和 bridge 按原入口运行。无固件仓库、设备、运行配置、真实服务或持久数据更改。
