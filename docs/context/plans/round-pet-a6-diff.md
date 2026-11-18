# A6 Diff（实现前）

- 新simulator执行适配器：A1受信actor→A3候选四流，独立帧/保存分步、私有有界回执、上下文/截止/旧步骤失效；不引入Node/DSH依赖或生产入口。
- 新临时执行lab和专项/监督CLI，复用A5装配fixture与A4真实TLS client，所有模型回执经设备主动exchange上行。
- 原创PET4字节验证适配复用现有严格SHA/241帧CRC，故障只注入调用方内存Flash。若发现既有接口不一致，只做可证明的局部修复并记录。
- 更新当前摘要/待办/差异表/协议/交接/README/许可，归档被替代的“A1执行参考未接入”描述；历史A1/A5报告不改写成新证据。

详见[Spec](round-pet-a6-spec.md)，不改固件/pet/bridge/DSH，不启用生产listener。

实现细化：load返回opaque票据，异步supply必须匹配该票据；过期后新控制也要清旧frame/work。公共监督器仅新增受信timeoutMs参数，默认总30秒保持，A6显式总120秒、单用例仍30秒；协议TTL不变。

实施状态（2026-10-30）：本Spec/Diff先于实现建立；30项模型专项、634全套、独立CLI正常/中断清理均通过，见[报告](../../reports/2026-10-30-round-pet-a6.md)和[活动API](../../protocol/round-pet-a6.md)。替代摘要已[按主题归档](../history/round-pet-a6-evolution.md)；会话revision/低root维护、共同G0/真实包及G1/G2/实体准入仍未关闭。
