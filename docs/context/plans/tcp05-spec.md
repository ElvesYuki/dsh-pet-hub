# TCP-05 Spec（2026-11-05，实施前）

## 分析与实施边界

读取本仓库规则、TCP04及终端最新status/system/todos、transport-core接口/报告与实际control_transport.h。端侧已完成Core+管理端TCP02宿主真实六类消息互通、175工具/ASan/UBSan及ESP独立对象；新默认0e2a04bf未部署，板上仍f553。复用这些成果，不重复开发收发Core或运行固件脚本。上游证据与本仓库本轮执行分开。

当前管理端native400TcpCatalog接收任意显式namespace/index和调用方声称的recovered列表；它是映射工具，不是可信来源准入。TCP03/04尚无共同wire，不能因用户同意推进便宣称双方已签核。可先独立完成：管理端采纳现有v0 recipe作为**offline-loopback配置候选**，串联已有400-08只读来源审阅、400-01独立用途/映射决定与TCP02临时owner；状态扩展仍待共同决定，不添加type/HELLO尾字段。

## 契约决定

- recipe沿端侧`pet400-tcp-map-draft/1\0`＋N_boot SHA32＋source manifest原始SHA32＋选用原始hub index SHA32＋按action升序四对象(action u16LE/bytes u32LE/frames u16LE/F SHA32)。固定四ID0/1/4/11；N_boot不替换成N_offline/P/M/cache SHA。
- 此切片只使用metadata中独立批准的`source_index_sha256`作为所选原始index域，不自动换成管理端规范化重建的indexSha256、不混完整78与八语义index。需要另一index时重新准备相应package/catalog和独立决定；不添加别名fallback。
- 新可信decision严格版本/profile/用途`offline-loopback`、source_map SHA、mapping SHA、原始index SHA、完整性策略`file-sha-metadata-frame0-crc`、展示策略`first-frame-history-only`。缺字段/未知字段/production用途拒绝，decision不能从缓存/journal/网页读取后自授权。旧两份批准继续复用且不扩用途；此decision只是本地临时实验准入，不授真实素材生产用途。
- 先无I/O prepare深拷贝可信输入、重算metadata/校验批准；返回WeakMap内部opaque option，不能序列化恢复。任务必须显式enabled:true；只读真实PC文件复用既有selection+reader，在实际fd首读前钉住选择，完整cache及四payload SHA后匹配独立expected map摘要。只允许健康双根（degraded/fallback拒绝），未知I/O不降级。未通过不创建TCP owner/listener。
- ready后为已审PC快照，不声称文件持续不变或当前ESP库存；map/hash不签名，不是设备认证。后续HELLO必须匹配snapshot-derived mapping；四对象仍需终端可信本地Config核实际Catalog。无真实设备配置导出、安装、持久凭据或saved/offline_available。
- 新装配仅拥有一个TCP02临时owner，显式127.0.0.1/port0。外部任务signal/close同步fence命令并关闭owner；close等待原reader/selection与socket真实退出，不提前报告清理。start与close竞争失败关闭；ready结果不允许clone option重新开通。到期/重连/remainingTTL/reapply/PING沿原owner，不扩TTL/权限。任务关闭后快照只历史，无自动重开。

## 模块与失败路径

新增runtime/native400-tcp-binding.mjs，复用core/bootstrap inspector、native400Metadata、runtime bootstrap reader/source selection/native400TcpCatalog/TCP02 owner；core/旧wire/旧owner/reader/journal及UI不修改。公开状态只投影候选scope、map/mapping/校验等级、owner原只读观察和资源计数，不泄露路径/原输入/批准正文；不接DSH或生产CLI/config。

准备/实际读取/独立map或mapping不一致/根降级/取消与真实退出分别测试。坏decision先于文件I/O拒绝；读取失败不启listener。源在读取中替换、payload损坏、未知或忽略abort的read均沿原reader处理，close等真实退出。复用option可创建不同独立任务（每次重读），同一任务只创建一个owner；不把旧ready结果当可持久授权。

## 验证与验收

1. 原创合成package/cache/独立decision，严格字段及N_boot/P/M/N_offline/raw-index域、四对象身份与map/mapping拒绝；通过真实私有稀疏28MiB文件审阅，无真实动画/缓存。
2. 原创固定recipe向量与C++17字节writer对拍，核domain+0、LE、排序、index改变、极值长度、重复/缺ID/坏SHA/帧数。C++只重建recipe字节，SHA由Node计算；不声称端侧已实现该映射函数或新增wire已共同定稿。
3. 新装配路径自有loopback真实TCP，匹配HELLO/OPEN/BASE/ACK/PRESENTED、旧mapping拒绝、关闭/取消/读取退出；synthetic peer/首帧仍模型，current_display unknown/verified null。已有端侧C++六消息实验不重跑、不合并成真机闭环。
4. 默认测试不依赖终端本机路径；独立临时验证CLI、npm run check、npm test含build。清理自有资源；源码SHA/外部快照及文档链接验证另记。

## 回退及下一入口

不创建新候选即可回退。已创建先close等待fd/socket/timer退出再删自有临时根；无持久格式、真实配置/服务/固件/素材迁移，不自动启旧TLS。记录共同已一致/管理端候选/待终端确认：真实mapping与四资产本地配置、SHA等级、首帧历史与实际状态/退意图/退出，再joint扩展wire+字节向量和ESP owner/Wi-Fi资源。媒体流、长测/保存掉电、400-L/V3后置。不接设备/生产listener，不改固件、pet、bridge或DSH，不安装插件，不提交推送，不使用子智能体。


实施状态（2026-11-05）：已完成本片offline候选；17专项/隔离CLI、Node-C++ recipe字节、实际新路径loopback、check及含build1499通过。见[报告](../../reports/2026-11-05-tcp05.md)/[交接](../../protocol/native400-tcp-binding.md)。无新增wire或设备授权。收尾已重读终端并发完成的owner报告/合同：177工具、三构建及宿主对拍通过但未部署；两侧v0历史首帧/校验未知语义一致，真实配置/用途/STA和动态资源仍待验，不重复owner开发。旧摘要见[归档](../history/tcp05-evolution.md)。
