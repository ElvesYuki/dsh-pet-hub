# PTM1 认证与维修授权的离线交付

2026-11-11。PMA1 提案使用每绑定独立 PSK、双方随机挑战、HKDF-SHA256 和分方向 HMAC-SHA256。它认证 PTM1 明文记录及独立维修决定，给固件 C++ 提供字节对拍输入。参考实现仅位于测试目录。[协议](../protocol/native400-media-auth-draft.md) · [Spec](../context/plans/tcp-media-auth-spec.md) · [Diff](../context/plans/tcp-media-auth-diff.md)

| 验证项 | Node 离线证据 |
| --- | --- |
| 互认证 | 两种用途的 transcript、三步握手、18 条握手/记录字节固定向量。包含超 JavaScript 安全整数范围的绑定 epoch 与 boot |
| 记录 | DATA、CANCEL、QUERY、RESULT 置换后重算内层 CRC，仍被拒绝。还验证方向反射、同连接重复/跳号、跨会话重放、截断、未知版本和裸 PTM1 拒绝 |
| 授权 | 模型中原子消费单笔决定，固定 BEGIN 完整字节、配对及 manifest/index。修改设备目录、目标、job 或素材字段后拒绝。单调截止过期或时钟回退失效，迟到授权不续期 |
| 恢复 | 查询使用独立握手，匹配配对上下文、boot、完整 job 与有效保留期。未命中、换代、过期和原 Unknown 保持 Unknown，查询模式不能发维修记录 |

```sh
node --test tests/native400-media-auth.test.mjs
```

Node 24.14.1/npm 11.11.0，9 项专项通过。`npm run check` 通过，显式启用既有 PTM1 C++/NOR 回环的 `npm test` 完成隔离构建，全量 1990 项通过，零跳过。PMA1 新测试仍为 Node 内存验证。向量 SHA-256 为 `f4a062baf9ba447e6b2ea71746f9e191a4f2b2205feae7d47b3520cab03321f8`。合成密钥是可公开复算的固定字节，数据正文只用于对拍。[共享向量](../protocol/vectors/native400-media-auth-draft-v1.json)

## 固件对拍入口

1. 先复算 `repair`、`query` 的 transcript 和六条握手报文，再按方向逐字节生成并验证十二条记录。C++ 错长度、截断、修改正文重算 CRC、错 epoch、重放 FINISH 和同序号篡改均应拒绝。认证使用目标已支持的标准 HMAC/HKDF 后端，实测其内存与吞吐。
2. 只在独立回环将认证包装接到现有 socket 与 `RepairOwner`。TAG 成功前不得把 DATA 交给保存器，M2 完成前不得 READY。确认记录最大 4160 B 可分头/前缀/原 transfer 工作区/尾标签接收，不分配第二个全 DATA 缓冲。测试 auth/expiry failure 与根提交门、关闭和同 boot 收据竞争。
3. 双方确认物理配对、熵源、绑定撤销、用途审批来源和设备本地维修许可，再评审 STA/栈/Flash 预算及真实窗口。首轮提议 USB 物理配对与每笔本地维修授权。PMA1 提供完整性，素材仍明文。实际密钥存储、C++ PMA1、认证 socket、ESP 真机和 LAN 写入均待验证。

现有 Node 入口在读取本地决定后才生成 job。认证装配时应由可信 owner 先分配 job，再固定到一次性决定及 BEGIN。终端目前按 boot/job 查单笔收据，认证装配须补绑定与 epoch 作用域和保留期限，并用查询连接的新密钥包装 RESULT。这两处接线未在本轮改变。

终端侧 `2026-11-11-tcp-media-owner.md` 记录 `8f930afd` 的 M2、RepairOwner 和 12 个宿主场景。当前只读源码中的 `firmware_tcp_media_socket_start` 检查两端 IPv4 loopback。该候选和已有 Node/C++ 裸 PTM1 回环是下轮接线依据。本轮未执行固件脚本、操作设备、改动终端仓库或实际服务。移除测试和提案即可回退，无配置迁移。[当前待办](../context/current-todos.md)
