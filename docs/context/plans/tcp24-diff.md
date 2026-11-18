# TCP24 Diff（实施前）

- 新增纯离线priority HELLO能力尾部/snapshot payload严格codec、固定向量与连接绑定provider；不修改既有七消息codec/owner/监听入口。
- 新增方案A/B产品行为与竞态对照、provider正负例/监督CLI，复用原调度及genuine来源/共享client，不重做hold。
- 对端协议草案明确能力/身份/代数/期限/初始/重连/兼容/队列资源/回退；需终端实现，不在本仓库改固件。
- 记录pet加载身份证明办法与有界自然观察，更新当前上下文/报告/交接，所有旧默认保持。

评审补充：新网络priority profile须使用既有shared autoRecover:false，避免重连快照前恢复旧hold；不改变旧配置/owner。实施状态：离线payload/provider与17专项已完成，check/1865全量及候选构建证据见报告；正式transport/终端/C++对拍待联合实现。
