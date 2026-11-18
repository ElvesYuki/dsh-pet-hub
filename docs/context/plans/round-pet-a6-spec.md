# A6 A1执行模型驱动端到端离线对照 Spec（实现前）

2026-10-30。读取本仓库规则/当前摘要、A1/A5协议与实际actor/Flash/观察/临时TLS fixture；保留原修改、不用子智能体。仅独立临时UDS/PKI/loopback、原创PET4/虚拟双时钟/内存Flash；不访问真实设备/固件/pet/bridge/DSH，不创建生产listener、不安装插件或提交推送。

## 目标和模块边界

新增simulator执行适配器，复用Native360DeviceModel/FlashModel作为事实源，显式受信同步validator从下载字节计算F并全241帧CRC。adapter把actor inventory、submitFrame成功与commitSave结果映射为A3候选四流，不能接受调用者提供verified/playing/saved布尔。A5默认OFF owner、A2仓库/磁盘reader、A4主动pull/scoped保持；仅临时fixture明确启用并挂载loopback。模拟器不得进入生产bundle，旧A4/A5声明式mock专项仍保留原阶段证据。

端到端方向：hub手动意图→真实TLS响应→模型request/load→许可分段下载→模型supply/verify→显式模型刷新提交→模型分段保存/root提交→下一HTTP回执→A3/status。初始库存只能从模型完整root生成；启动默认集合及预置缓存也须经同一模型验证/保存建立，不能直接编辑库存数组。动作46描述仍可共享原创恒定索引PET4，不冒充真实46库负载。

## 不变量和失败路径

- 单RAM/4活跃+1暂存、保护0/4/显式victim沿用A1，先EMPTY→0→4，再可扩展。旧F/同ID替换与实际root generation映射精确；暂存/对象头残留不变成离线可用。
- 接纳、下载、验证、刷新、保存分步。verify必须由真实字节/CRC；prepareFrame不等于提交，旧帧、取消/目标替换/重启不能确认。playing保留首次提交证据，display恢复维护需新refresh generation，保存不自动重新播放。
- 记录使用独立四流uint64序列、完整target/package/control；私有bounded outbox，不累计历史记录。未回传的保存回执可以丢失，但重连只能新查询事实，不重发save或补造旧saved。
- adapter是受信模拟执行边界，不实现第二套TLS/证书/DSH监听。fixture复用已有TLS client/候选codec/lease receipt；模型在执行步骤前核当前受信context/control/本地截止，过期/断线fence，不能让旧下载/帧/保存步骤继续提交。
- Flash payload/header失败保持旧root；marker尝试后错误=outcome_unknown/库存unknown。显式模型重启/新owner恢复有效root，无自动格式化、盲重试或重播。读I/O错误不当作坏根回退；坏对象回退若低于hub已确认root高水位，hub仍须拒绝，不能降低高水位掩盖回滚。
- held_last_valid及maintenance从模型生成；旧目标画面的维护通过关联display查询快照报告，不伪造新目标事件。模型刷新只是注入完成事件，不是物理面板/DMA。

## 验证和验收

新增专项逐项对照模型根/资源与A3/status：初始库存/EMPTY门禁；缓存命中无下载；未缓存真实CAS下载；CRC/F失败；首帧前后/旧票据；保存分段/未写满/commit/淘汰；持久root与历史saved分离；取消/睡眠/断线/本地租约过期；payload/header/marker前后故障、读回失败/坏根/坏对象/低root回滚拒绝；模型关闭/重开、无source恢复与实际资源清理。独立CLI监督正常/SIGTERM清理；npm run check（仅语法）和npm test（含构建）保留604基线。不外推ESP时延/RAM或真实断电。

## 回退和未覆盖

关闭自有peer/临时server、A5 owner与模型，等待实际I/O、worker/pin释放，最后删除临时PKI/目录；移除本轮simulator/专项入口即可，A5默认OFF不变，无磁盘迁移。必要的既有接口修复须单独记录根因/范围并回归，不顺手改生产策略。共同G0、真实包/许可、Node/C++字节对照、G1/G2 TLS/时间/秘密/清理上界与设备窗口仍为准入前置；本轮不处理物理触摸仲裁、磨损策略、分层/跨角色/多设备/BLE/OTA/音频。

实施状态（2026-10-30）：本Spec/Diff先于实现建立；30项模型专项、634全套、独立CLI正常/中断清理均通过，见[报告](../../reports/2026-10-30-round-pet-a6.md)和[活动API](../../protocol/round-pet-a6.md)。替代摘要已[按主题归档](../history/round-pet-a6-evolution.md)；会话revision/低root维护、共同G0/真实包及G1/G2/实体准入仍未关闭。
