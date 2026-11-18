# TCP-12 Spec（2026-11-05，实施前）

已读规则/当前摘要/TCP10–11实际实现及终端最新预检/USB合同/实际identity与firmware_arm。来源已实际复核，但TCP10请求仍只验证调用方摘要引用，缺少与同一次审计任务和单独用途决定的装配关联。此片补关联，不重复审计、网络/USB、凭据或许可批准系统。

新增可信本地reviewed request工厂。必须提供本进程已完成且未close的真实TCP11 audit task（WeakMap内部证据）；snapshot/ready JSON/self SHA或伪造任务均不能替代。内部getter只读拷贝，无额外fd/哈希/网络；原ready recipe/snapshot不变，关闭/失败/未完成均无可用证据。输出仍是历史PC审计，不加当前库存/设备证明。

单独materialReview闭合schema_version=1/profile=native400-cached-control-material-review/1：review_id、usage=local-noncommercial-cached-control、source_evidence_sha256/mapping_sha256、license_ref/credits、source_kind（original-test或reviewed-upstream）、remote_actions=[0,1,11]/touch_actions=[4]、media_distribution=false/persistent_write=false、index_policy=trusted-local-raw-index-pin-no-compiled-check。此记录由可信审阅者独立给出，不从audit、文件、旧approval或账本生成。字段约束不能验证法律权利、责任人或固件签核；原source_kind=original-test仅供原创样本，真实材料不伪填。

windowDecision仍为现有TCP08闭合决定，另外完整提供，不从materialReview自动制造。要求source_review_sha256等于同次audit evidence SHA、mapping相同、material_approval_id等于独立review_id，license_ref/credits逐项顺序相同。不得将source manifest/cache/P/M/raw index或旧bootstrap map SHA换作审计引用。用途明确不扩大旧offline范围，不把协议无认证写成有认证。

通过后只把audit内部identity装入TCP10 request，调用方仅给endpoint/windowMs及既有可信clock/NIC/timer，不可覆盖identity。prepare不枚举NIC、不启动UDS/listener或读凭据；window期限仍从此prepare起算≤120秒，不由审阅/snapshot/重新包装续期。仅返回原opaque lanReview、安全snapshot、受审计存活门禁约束的deviceConfig与close。无底层request暴露；audit关闭后deviceConfig拒绝，public snapshot只报source_bound=false。request close不关闭调用方拥有的audit或服务；必须另await原service/audit close。

成功deviceConfig仍须TCP10实际赢家/有效LAN窗口/listener；前后都检查audit存活。同步依赖回调若撤销audit则禁止返回配置。真实LAN成功路径/USB及凭据生命周期此片不执行，不用伪owner补成功；只测真实审计→reviewed request→真实UDS未启动owner的正向装配与拒绝边界，不绕开既有门禁。多目录全局互斥、跨进程持久去重、审计后文件持续监控未提供。

专项：原创稀疏28MiB源实际审计、未完成/失败/close/clone任务、重算自SHA假对象、各摘要换域、独立review/window ID或许可/署名/用途不一致、remote4/分发/保存拒绝、输入深拷贝、source关闭/prepare期间撤销、窗口到期/不自动监听、其他owner/附着只读、close所有权和旧TCP10兼容。先隔离专项再check与单套test含build。

真实材料仅引用TCP11已核证据，不重复45MiB读核或重做素材。整理本地非商业缓存控制的用途记录草案与索引职责确认项，不自动发放真实review_id/approval/配置，不代终端签字；固定上游许可在线读取失败时沿既有已登记快照并明确未新核，不制造新授权。更新上下文并归档被替代入口。

回退close新request防交接、另await所属service/audit真实退出；省略新工厂仍TCP10/09。audit close不自动关listener，真实操作方须按方案显式关两层；失败保持UDS/503。无持久格式、生产配置或固件/媒体变更，无设备/LAN/USB/STA/ESP、插件安装/服务调整/提交推送。下一真实用途独立确认/端侧index职责与私有配置/单USB调用方，再按授权fresh备份/资源短窗；STATE/媒体流/保存/V3后置。

实施状态：18专项/隔离CLI、check及含build单套1604通过；只原创实际audit/临时UDS，TCP未启动，不启LAN/USB/STA/ESP、未签录真实用途记录。见[报告](../../reports/2026-11-05-tcp12.md)。
