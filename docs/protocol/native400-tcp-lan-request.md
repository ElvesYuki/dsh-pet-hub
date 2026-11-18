# TCP-10：可信本地请求与设备RAM配置交接

2026-11-05。[Spec](../context/plans/tcp10-spec.md)/[Diff](../context/plans/tcp10-diff.md)/[报告](../reports/2026-11-05-tcp10.md)。仅显式runtime API，未接CLI、UI、USB或生产服务。请求加载、纯JSON组装和赢家门禁已实现；真实LAN赢家→配置成功分支未执行，不能作为设备准入证据。

TCP18扩展了独立loopback-rehearsal的纯准备分支，用于原创来源实际audit的手动控制验证；原设备配置导出仍只真实LAN。高层reviewed request仅source_kind=original-test可进入该分支，未扩大真实素材授权。

后续[TCP11来源审计](native400-lan-input-audit.md)已实际复核完整78 metadata及历史cache/四payload，[当前G0](../context/plans/round-pet-g0-handoff.md)已明确索引候选与剩余职责；本页“历史来源仍待”属于TCP10阶段。真实用途/当前库存/私有交接与实际LAN分支仍未完成。

## 请求与独立决定

`readNative400LanRequest({file,decision,clock?,interfaces?,ackMs?,tickMs?,timers?,beforeCheck?})` 同步读取指定私有文件并返回RAM请求对象。`prepareNative400LanRequest({request,decision,...})` 为无文件I/O的可信代码入口。前者文件/解析失败统一lan_request_file_invalid，后者输入失败lan_request_invalid，cause仅内部使用，禁止直接记录原始错误链。

request闭合五字段：schema_version整数1、profile=native400-hub-lan-request/1、identity、endpoint、window_ms。identity为TCP08的namespace_sha256/source_manifest_sha256/hub_index_sha256/records；endpoint为interface_name/listen_address/peer_address。没有port/wifi/decision/approved标志。来源身份与设备RAM身份保持显式区分，不把P/M、N_offline、role8与完整78索引换名填值。

decision必须由可信本地代码另外提供，沿TCP08闭合native400-tcp-lan-window/1，usage精确single-device-cached-control；不接受offline/loopback决定或JSON自带批准。mapping重新计算，source_review_sha256/material_approval_id等仍为调用方引用。模块不调查法律权利或当前库存、不读素材或发放真实用途决定。文件符合schema不等于真实素材已获准用于设备。

文件仅接受当前用户拥有的普通文件、mode无组/其他权限、nlink1、1–16384B。O_NOFOLLOW/O_NONBLOCK、固定size+1缓冲、完整严格UTF-8/重复键/数字解析，读后fd/path的dev/ino/size/uid/mode/nlink/mtimeNs/ctimeNs均须保持。变更/缺失/坏档不覆盖重建。beforeCheck仅可信同步测试hook，不能来自JSON，不是对恶意同用户改盘的长期防护。finally关闭fd、擦除自有原始buffer；解析出的JS字符串/OS副本无完全擦除保证。

## 请求生命周期与赢家门禁

返回冻结对象：

| 字段/方法 | 语义 |
| --- | --- |
| lanReview | TCP09 opaque option，可显式传给既有startOrAttach；准备不acquire/监听/枚举NIC |
| snapshot() | 闭合安全投影：版本/profile/closed/handed_off/source_evidence=caller-declared-reference/device_evidence=false/authenticated=false；无端点/摘要/决定/凭据 |
| deviceConfig({owner,wifi}) | 同步一次交接，使用当前真实赢家绑定的端点；返回敏感RAM对象，失败不表示设备有任何操作 |
| close() | 幂等、永久禁止此请求交接，不代替服务close或设备stop |

native400LanHostEndpoint(option,owner)只供可信本地交接，WeakMap要求owner确属该option。检查的是封闭inner，不使用可替换的公开snapshot/resources/address。要求真实LAN scope、窗口claimed/有效/remaining>0、network ready、listener在场且非disabled/paused/closed。返回赢家真实IPv4/动态port；不从公共status或调用方port推导。附着进程无owner，clone/伪owner/另一option/未启动/过期/关闭/loopback均拒绝。

窗口仍从TCP08 prepare起计（≤120秒），读取请求或新prepare不延长已有赢家。deviceConfig成功返回即handed_off，后续拒绝；调用方拿到对象不等于USB成功。此一次性标志仅RAM防误操作，不是跨进程持久去重、认证或USB幂等性。后续USB结果未知时不自动新建请求重发；只有独立核定新窗口/新boot后才另行操作。

## 设备配置与凭据

`native400DeviceRamConfig({identity,endpoint,wifi})` 是纯数据适配器，独立校验并深拷贝，方便离线正反向量；不做owner授权/I/O或产生设备事实。生产式交接调用上面的deviceConfig，而不是拿纯函数绕过赢家检查。输出闭合schema_version=1/profile=native400-device-lan-ram/1/identity/endpoint/wifi，对齐终端已有导入器：

| 管理端 | 终端RAM对象 |
| --- | --- |
| namespace_sha256 | namespace_sha256，固定N_boot |
| source_manifest_sha256 | source_manifest_sha256，原manifest字节SHA |
| hub_index_sha256 | role_index_sha256，原始索引字节SHA，绝不重建或转为M_host |
| records | action/bytes/frames/asset_sha256，排序0/1/4/11、241帧、544–5865472B |
| 赢家address/port | endpoint.ipv4/port，数字非loopback单播IPv4/1–65535 |

wifi由可信调用方另传，不进请求/sourceKey/descriptor或snapshot：SSID合法scalar Unicode，UTF-8为1–32B且无NUL；password为空或8–63可打印ASCII，换行/NUL/非ASCII拒绝。纯函数返回对象，调用方负责私有保管/释放；本片不写JSON文件、不保存payload/hash/SSID/密码、不打开USB或运行终端工具。凭据未来交接可使用终端已有私有文件接口，但具体文件和串口会话所有者仍待装配。

## 终端一致项与待确认项

已只读核定USB工具、usb_lan_config、实际worker route、control_identity、control_owner_firmware和boot_catalog。372B字段布局、raw role_index与四记录顺序/LE recipe一致；本片输出JSON，不新增packet codec或重复USB状态机。端侧仍负责Ready/Queued/2秒失败封锁/擦除及实际Catalog核对。本轮未运行Python工具/C++或ESP构建。

**差异：firmware_arm核namespace、compiled manifest与四Sample，但没有将role_index与独立compiled常量比较。** role_index在binding里只要求非零并参与mapping哈希；HELLO映射一致只说明两端接受同一声明，不证明该索引来自实际角色目录。管理端必须钉住独立实际raw index。终端应确认这是可信本地提供者承担的职责，还是未来另加compiled index核定；本仓库不擅改固件，也不以文档“compiled身份”笼统宣称index已验证。

只读重哈希本地已批准compact78的manifest、library78/role8原index，仍分别a1c7c2a6…/5bd657d4…/afdda0e8…；metadata四项与既有baseline一致，42仍118帧。没有重读/重编码媒体或检查当前板上cache，没生成新的设备用途批准。既有非商业/署名/SA许可证据沿用，本轮未联网重核、未判定新传播/生产权利；代码MIT不覆盖素材。R0角色用途、来源审阅记录和精确index选择仍待独立决定。

## 验证与回退

18专项：私有文件/坏输入/路径替换/稳定错误、纯JSON与UTF-8/password边界、请求close、实际UDS赢家/附着、伪造公开方法/其他option、到期、真实loopback拒绝与退出。纯数据正向配置使用原创合成非loopback地址，不bind；真实赢家成功LAN交接及handed_off成功后的拒绝分支未运行，不能以fake owner代替。scope、许可与设备证据仍不升级。

下一先完成R0实际来源/用途/缓存证据和私有真实请求/独立decision，然后准备真实窗口及调用方私有配置/USB会话生命周期。按Spec显式单NIC/peer/窗口、选主、link/start、取动态端点、USB同boot观察，分测Queued/联网/accepted/校验/frame0/cleanup；暂不实现STATE/媒体流/保存/V3。

回退close请求防再交接，再await服务close等实际socket/session/timer/listener退出，失败持UDS/503不强抢。设备stop/cleanup_complete另核，主机退出不代表设备已停止。此片无文件输出或持久迁移，不改固件/素材/现有pet/bridge/DSH，不安装插件、不提交推送。
