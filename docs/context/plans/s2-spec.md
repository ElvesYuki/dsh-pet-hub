# S2 Spec（2026-10-29，实现前）

目标：把S1模型装配为显式simulation运行模式、鉴权IPC和共享管理UI，不连接真实设备/DSH来源，不改现有配置。

- 默认deviceMode=disabled，devices=[]，deviceTransport=false；只有CLI显式--device-mode simulation且source disabled才允许装配。普通runtime不静态导入模拟器，候选包继续排除simulator。
- 同一runtime目录设备模式与来源指纹固定，第二启动者只附着同模式；不允许通过IPC把默认服务切成simulation。simulationFactory只在取得socket所有权后调用。
- 合成A/B两设备、8微型SIM1素材、虚拟时钟（仅用户显式推进，不跟墙钟走）、服务内唯一调度器。模拟认证fixture不能变成IPC认证手段。
- IPC白名单：GET status包含deviceMode/synthetic/设备摘要/虚拟时间/全局模拟revision；POST /v1/simulation/intent为按设备意图CAS；POST /v1/simulation/control用于推进时间、断连/重连、合成来源切换。所有写入携带服务instance、client/request身份；未知字段拒绝、旧实例拒绝、重复不重复执行。无凭证/URL/epoch/原始设备消息下发入口。
- 管理UI持续显示“模拟设备/非实物”和虚拟时间，区分绑定、连接、控制、desired/actual与播放阶段；手动/自动按钮及时间/断连控件仅在simulation模式显示。取消/卸载中止请求，CAS冲突明确提示需重读，不盲重发。
- 此次不装到任何真实DSH profile；通过独立临时hub+模拟host代理和浏览器加载候选client验证。浏览器React来自本机已安装DSH的只读种子资源，不联网拉库、不安装依赖。

验证：默认模式/拒绝跨模式、鉴权、两进程共享调度/意图CAS/去重/旧实例、数据过滤、状态机流经IPC、host代理卸载不杀服务；浏览器真实组件交互和定时器清理。全套S1与原回归通过。

执行/回退：仅创建本仓库.cache和短路径新临时runtime；预览监听动态loopback端口。记录本次进程并只关闭它们；卸载模拟host路由、停止临时hub，不接~/.dsh-pet-hub或现有bridge端口。失败不修改现有DSH/固件。模拟数据不持久化，重启实例/意图/时间重建；只有已有displayName配置保持原CAS语义。
