# S1实现 Spec（2026-10-29，实现前）

范围：纯ESM core注册表、协议校验/BigInt序号、控制租约、独立播放回执/意图仲裁；离线模拟device actor、虚拟时钟、内存持久层与故障队列。逐项执行SIM-01–30，必须有真实行为断言，不以编号或mock返回码代替验收。

core不依赖Node网络、DSH、DOM、文件系统或真实时钟。认证由注入的可信边界提供，默认拒绝；测试用不可序列化的proof fixture，不能把JSON authenticated:true作为证明。持久层为注入式read/commit接口，模拟支持提交失败与重启；不宣称已实现真实NVS/Keychain。

模拟actor执行控制/下载/校验/首帧事件；消息队列支持延迟、复制、丢弃、乱序。合成小素材校验器注入，真实PET4解码/SHA/TLS不在本轮范围。两设备、两个hub实例及未绑定controller覆盖身份和所有权。

结果报告对每个SIM ID列出实际断言与层级；SIM-30仅验证core摘要，真实IPC/UI序列化待S2。所有SIM可以在model层验证，但服务/硬件部分必须单列未覆盖，不以all-pass扩大到实物。现有runtime devices=[]/deviceTransport=false保持。

验证：npm run test:sim仅运行离线模型；npm run check与npm test进行已有回归（其中原P1测试会启动临时本机模拟IPC，不接正在运行的DSH/bridge/设备）。本轮不启动独立DSH profile，不修改固件/素材/配置、不提交推送。
