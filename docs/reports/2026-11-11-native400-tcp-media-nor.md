# PTM1 Node 与终端保存器回环验证

2026-11-11。使用实际 `prepareNative400MediaTransfer` 连接临时 IPv4 loopback 上的 C++ 测试端。C++ 直接编译终端 `media_wire.h`、`media_pull.h`、`cache.h` 和 `nor_fixture.h`，以已有原创 PET4 和稀疏 V2 NOR 目录提供输入。所有写入发生在进程内 NOR，编译产物仅在临时目录。Node 发送器、PTM1 字节和生产装配本轮无代码改动。[Spec](../context/plans/tcp-media-nor-spec.md) · [Diff](../context/plans/tcp-media-nor-diff.md)

| 动作 | 场景 | 观察结果 |
| --- | --- | --- |
| 1 | 完整传输 | 214785 B、53 个暂存写入后 ACK，整文件 SHA 与 241 帧验证后，root 2→3、对象代数 5，Saved |
| 1 | END 后、根标记前取消 | Cancelled，活跃 root 保持 2 |
| 1 | 根标记写入后取消 | 读回 root 3，Saved |
| 1 | END 后、根标记前收到额外 DATA | Failed，活跃 root 保持 2 |
| 1 | 提交读回后断线 | hub 初次 Unknown。同 boot、仅最后一字节不同的 job 查询仍 Unknown。查询原完整 job 后 Saved，NOR 操作数不变 |
| 11 | 完整传输 | 同规格原创 fixture 走同一发送与保存链，目标槽独立轮换，Saved |

C++ 收发每次最多 127 B/11 B，头和 DATA 前缀分读，正文直接进入 4096 B 工作区。开始从恢复目录核对 boot、根、代数和完整素材身份。试验中每次 Pull 确认已写暂存字节等于此前已收字节，才发累计 ACK。保存器退出后重新恢复目录，核对新槽正文及四个旧槽全字节。试验用显式独占权限进入保存器，端侧产品的 M2 并发屏障单独验证。

固件任务同期 `apps/round-pet/reports/2026-11-11-tcp-media-socket.md` 记录了用实际 compact78、独立宿主 NOR 通过 8 个场景，其中动作 1 为 3568101 B、动作 11 为 4172848 B。还覆盖了首块写失败无 ACK、ACK 前取消及根标记可能写入但返回失败后查询仍为 Unknown。本轮只读核对该报告，管理端复现使用本仓库原创素材，无需真实动画、备份或固件生成物。

## 复现

```sh
ROUND_PET_MEDIA_ROOT=/absolute/path/to/ai-embedded-studio node --test tests/native400-tcp-media-nor.test.mjs
ROUND_PET_MEDIA_ROOT=/absolute/path/to/ai-embedded-studio npm test
```

使用 Node 24.14.1、npm 11.11.0、Apple clang 21.0.0。C++17 开启 ASan/UBSan 和 `-Wall -Wextra -Werror`。专项 6 个场景全部通过。`npm run check` 通过，显式启用互操作的 `npm test` 完成隔离构建并通过 1981 项，零跳过，耗时约 113 秒。未提供外部固件路径时，常规测试略过该互操作组。

编译输入 SHA-256，均从终端仓库只读读取。

| 文件 | SHA-256 |
| --- | --- |
| `media_wire.h` | `609101c80e1f24afd25c2f23c06bd0ef9ce6fdee14eb8fea3147b0a7c18e912f` |
| `media_pull.h` | `7604a201cbfbe277ff6a2ec9430aaa3c57c09f50d474b4ee0ac5a5552c8dc4c1` |
| `cache.h` | `b09e0d167f181be295c0d7aacfb58148d0375bf741840147d2da3060bd538194` |
| `nor_fixture.h` | `f7d228de1aedc82c9a07da67d9a54468183d76c6a8a71bd901093995143c4b4e` |
| `lz4.c` | `9396f7de527bc8435de9c7569fb7998e56545a84b4f3c2d808c0235c01774539` |

## 下一入口与回退

终端将实际维护连接接入 `RepairOwner`、M2、写栅栏和回执生命周期。管理端复用本轮测试验证交接，确认 READY 先取得独占权、socket 等实际退出后再释放、同 boot 查询不解写栅栏。LAN 前还须核定会话认证、维护用途授权、重放与 STA 动态预算，随后再评审限时真机方案。设备只读基线仍为 `2cc7060d`，无设备、固件仓库或现有服务更改。回退仅移除显式测试选项，无配置迁移。[当前待办](../context/current-todos.md)
