# PTM1 与终端保存器的宿主回环

2026-11-11。终端只读交接已确认 PTM1 共享向量和 128 位线级作业 ID。下一步将实际 Node sender 通过真实 loopback TCP 接到终端 C++ `media_wire`、`save_from_media` 和原 NOR 测试实现。先验证动作 1，再以动作 11 验证相同路径。仅使用 hub 原创 PET4 和 V2 初始目录，给独立宿主编译提供相应的测试样本表。

- C++ 测试端保留完整线级 job，单次保存绑定非零本地事务 ID。用真实 codec 校验 BEGIN、DATA、END、CANCEL、QUERY，严格关联 boot/root/对象代数及素材身份。试验版本沿用固定 PTM1 v1。局域网能力与认证单独评审。
- READY 在校对恢复目录及明确持有独占宿主测试权限后发出。保存器 Pull 下一次调用时，只有上一块已写进暂存槽才发累计 ACK。最后一块先 ACK，再读 END。保存器源关闭与 TCP socket 关闭分开。
- 提交前 CANCEL 与 END 后多余 DATA 在根标记写入前拒绝新根，保留现有活动槽。提交门后的 CANCEL 保留已读回的新根与 Saved。测试在实际 NOR 操作间同步注入消息。
- 在已恢复新根但尚未发送 RESULT 时模拟断线，hub 保留 Unknown。C++ 同 boot 进程保留单笔收据，显式 QUERY 用完整 job 匹配并返回原结果。核对无第二次 BEGIN 或 Flash 操作。
- C++ 使用定长缓冲、受限读写分段、整连接期限。Node 测试拥有独立动态回环端口、临时 NOR、文件、子进程和退出。真实 ESP STA、M2 并发、生产 socket owner、授权、实物 Flash 和画面恢复仍待独立验证。
