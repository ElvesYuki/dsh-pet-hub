# TCP26 Spec：采纳保位续租并同步设备oracle（先写后实施，已完成）

2026-11-06。依据只读终端native400-preserving-renewal/1合同、实际Control/Bridge、24步C++字节向量和终审证书；本仓库TCP25仍是同动作重播反例。本片只更新管理端模拟设备/联合验证，不上板，不启动生产listener，不改外部服务/profile，不运行固件生成、构建、设备脚本。

## 不变量与实现范围

- 合法未失效同session/固定完整action+asset SHA新BASE更新deadline/latest request/requestAt，保播放起始seq/token。target.seq表示实例起始请求；request(token)给最新命令。到期先tick，取消/断链/新session/身份变化仍换实例。坏SHA/TTL不更新latest/time；重放同body只原ACK，不续BASE/session。
- Device oracle增加beginCycle，源prepare与每request Presented去重分离；呈现可带drawAt，初始新实例可同ms且不得早于接纳，续租必须严格晚于最新接纳ms。每cycle有效draw仅消费一次的Bridge语义由独立纯core播放oracle实现，含SHA→bind/source/cycle/mail→decoded→draw与EOF；不要仅从target key删seq或用新时间重报旧frame0。
- 保持现有prepare/presented首次调用兼容；新增方法是测试/设备oracle接口，不是网络证明。Host TcpHubControl类与owner如审计无需变更保持原字节/类体摘要；同文件device变更须更新六模块host导入闭包pins，不复用旧pins。
- 持续端侧fixture接播放oracle，模拟帧位/源周期不因续租重建；长touch跨多租期、EOF最新11、source/权限/人工CAS/unknown/true-false恢复及独立三期限保持。默认event/B不改。所有SHA/decode/draw仅合成，不声称真实媒体/显示。
- 只读核验终端最终manifest（51项）/指定证书/关键源码及构建指纹，不重新编译或生成终端缓存。24步向量作为Apache-2.0上游数据保留来源/许可，不复制生产代码；新增JS独立实现MIT。

## 检验与验收

新增离线向量测试与负例：24步实际C++记录→实际Node host、Node device+播放oracle产生相同字节/语义（含token/source/cycle/mail/current/needsStart）。pins/向量篡改拒绝；核draw早于/等于/晚于续租接纳、每cycle消费、坏stamp/非frame0不消费、循环新prepare、同request不重复、ACK无Presented、取消/到期/断线/新session/坏身份/TTL/重放/PING独立性。A实际HTTP/shared IPC/loopback回归含同动作token/播放stamp不变和新loop真实模拟frame0最新seq，不放宽截止或制造首帧。

先定向验证，完成后npm run check、npm test、正常与DSH0.2.2隔离候选build；输出源码/候选SHA、更新后host-core闭包pins与分层证据。资源清理沿TCP25自有临时HTTP/TCP/UDS/目录；不外推实屏、动态RAM/栈或最坏时延。

## 准入、回退及未覆盖

本片完成才能称“管理端已采纳”，不代表联合设备准入冻结。HELLO无保位能力，真实有限窗口须双方固定实际实现指纹及独立来源/用途/权限批准；原板上最后确认f553/af5b不改。真实pet运行加载身份/自然迁移不重做空闲采样。端侧station构建静态内部3944B/+40仅外部报告，不是动态门禁。退回默认event/observed-local、close bridge/source/测试owner，不迁移wire/存储；旧TCP25报告/重播反例归档，本片模型不用于替旧peer猜能力。媒体流/保存/V3/长测后置。

完成证据：[TCP26报告](../../reports/2026-11-06-tcp26.md)，44专项/1909全量、check及两候选构建通过；实际ESP/媒体/显示和真实pet身份/迁移仍待。
