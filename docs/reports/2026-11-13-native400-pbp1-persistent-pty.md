# 1.75C 持久绑定管理端 PTY 对照

2026-11-13。仅在临时 PTY、模拟签名器及临时 loopback 验证。固件报告 `2026-11-13-pbp1-persistent-binding-runtime.md` 记录 `9b42fe79` 接入 USB、BOOT、NVS／PSA 和 PMA1，三套构建和旧草案宿主向量通过。只读复核的更新源码已实现 `132` 和 capability bit 1。`9b42fe79` 的报告与更新源码分别保留，当前设备仍为 `2cc7060d`。

- 原 8 超时后，测试在新 6 请求发出后注入原 129，复现串口无法辨别应答来源。拆分后，首绑只匹配 132 加本次引用，查询只接收 129。公开向量覆盖旧 129、错引用 132、正确 132 与带能力的绑定状态。缺 bit 1 时首绑在签名与发 8 前停止。
- 持久流程核对 boot、设备、绑定、epoch 和公钥摘要，签名只覆盖当前挑战。PTY 验证 challenge Busy 退避、先注入有效旧 131 再注入拆包的新 131、以及只有旧 131 时超时。显式阻塞 PTY close 时无 RAM 租用发布，退出后才交给现有 sender，关闭 owner 撤销租用。
- 用续接所得的租用调用原 LAN sender，ARM 走另一条临时 PTY，监听替身只绑定临时 loopback。设备替身丢弃 ARM 应答，sender 只发一次并关闭 USB 与监听，调用者收到 `media_lan_arm_unconfirmed`。同一调用不可再次启动。

专项串口和 LAN 回归 14 项通过。全量重跑发现 `LHOST13` 测试夹具先打印就绪再注册 SIGTERM 处理的竞争。夹具改为先注册退出处理，定向复测通过。`npm run check` 通过，最后一轮全量宿主测试 2023 项通过，零跳过。

管理端运行入口仍默认关闭。未接 Keychain、索引持久化、生产 UI 或真实设备，未运行固件构建和设备脚本。后续先核对带 132 的固件产物和公开向量，再安排隔离签名存储及真实首绑、重启续接、解绑和资源验证。回退停用新增入口即可，原 PMA1 sender 五个指纹与冻结对照一致。[拆分向量](../protocol/vectors/native400-pbp1-split-enroll-proposal-v1.json) · [原 sender 指纹](2026-11-12-native400-pma1-lan.md#启用-tcp_nodelay-后的实板对照)
