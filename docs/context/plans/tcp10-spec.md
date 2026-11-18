# TCP-10 Spec（2026-11-05，实施前）

已读规则、当前摘要、TCP08/09实际代码及终端最新USB RAM接口、Python工具和C++解码/worker路由。终端USB提供者已完成，尚未实际USB/STA；管理端缺可信请求加载与赢家端点交接。此片补这两个边界，不重复串口、固件、TCP wire、素材导入或用途审批系统。

## 输入与信任

新增显式私有请求格式native400-hub-lan-request/1：仅schema_version/profile/identity/endpoint/window_ms。identity沿用N_boot/source manifest/raw hub_index/四对象，endpoint沿用单NIC/listen/peer，不含端口、凭据、决定或设备库存已确认标志。独立TCP08 decision必须由可信代码另行提供；文件自带approval、offline option或缺decision均拒绝。新请求入口只接受single-device-cached-control，不让loopback文件变设备配置。

只读加载使用O_NOFOLLOW/O_NONBLOCK、当前用户普通私有文件/nlink1/1–16384B，固定上限读取、严格UTF-8/重复键/数字/未知字段、读前后fd/path指纹一致，finally关闭fd并擦除自有原始buffer。路径及解析内容不进稳定错误/状态。凭据不进请求/摘要；不保证JS字符串、OS缓存可完全擦除。对文件/引用的校验不证明真实来源、许可或设备库存，R0需独立确认，绝不生成真实批准。

## 装配与交接

prepare/read只返回RAM请求对象与TCP09 opaque lanReview；无网络/USB/服务启动、无文件输出。复用TCP08身份校验与一次120秒以内窗口，TCP09选主照常。新增可信内部赢家端点入口，以WeakMap绑定实际owner和host option，使用原inner方法而非可替换的公开方法；必须scope真实LAN、窗口已claim/未失效/有剩余、network ready、非暂停且listener真实在场。附着者、其他option、伪造owner、关闭/过期/接口变化拒绝，不从IPC/status取地址。

deviceConfig(owner,wifi)在上述门禁通过后才生成一次RAM对象native400-device-lan-ram/1，hub_index_sha256逐字映射role_index_sha256、记录按0/1/4/11排序，endpoint来自该赢家实际IPv4与动态port。wifi由可信本地调用方单独提供：SSID为合法Unicode UTF-8的1–32B且无NUL；password为空或8–63可打印ASCII。纯配置组装函数用于离线向量，无I/O/审批/设备证明。返回的敏感对象由调用方私有保管；不自动写盘或调用终端工具，无额外凭据hash/日志。

一次交接是请求级本地防误用，不是设备幂等性：成功返回即不重复交付；未知USB结果不得新建请求重试。prepare/read新请求不复活旧赢家，不续旧deadline。请求close立即禁止交接，不擅自停止服务；服务需await原close并等实际资源退出。既有file缺失/坏档不修复，网络/USB不自动重试。

## 验证与边界

测试原创合成数据/私有临时文件/虚拟clock/NIC：独立决定、版本与闭合字段、身份域/四记录/recipe、私有文件/链接/硬链/大小/重复键/UTF-8/数字、无自动I/O、深拷贝/安全状态、pure device JSON正反与Unicode边界、伪owner/异option/未启动/关闭/失效/loopback拒绝；真实TCP09 UDS+loopback验证赢家匹配和原资源退出，但真实LAN不bind，不能假造成功LAN交接。实际赢家LAN→配置成功分支、真实R0/凭据/USB/STA/ESP留待授权窗口，不使用测试hook绕开owner门禁。

先专项/隔离CLI，再npm run check及单套npm test（含build）。记录分层证据和未覆盖项；不重跑固件脚本、不读取原始运行配置、媒体大文件或真实凭据，不重新筛选compact78。新代码MIT、上游接口只读参考不复制实现。无UI/CLI/DSH产品入口，无生产listener/插件/现有profile改动，无提交推送。

## 具体后续与回退

本轮纯离线；下一先独立核定实际N_boot/source manifest/raw index/四缓存来源与角色用途，并提供私有真实请求/可信decision。已授权的真实窗口才可选单NIC/peer→准备新短窗→同私有目录选主→显式link/start→取赢家动态port→私有交接给终端既有USB工具；保持单USB会话，核boot/Ready/Queued/status，分别测资源/往返/触摸/取消/首帧/失联与cleanup。不因匹配摘要/Queued/Running就判联网或播放，也不延TTL掩盖延迟。

回退先关闭请求防交接，服务close并等待实际socket/session/timer/listener退出，再处理自有临时目录；失败保留UDS/503和现场，不强抢。设备stop与cleanup_complete另由设备任务核实，host close不代替。省略新入口仍TCP09/旧offline行为，无持久格式迁移、固件/缓存/分区变更。STATE/媒体流/保存/V3继续后置。

实施状态：18专项/独立CLI、check及含build单套1568通过。真实UDS/loopback排练，无LAN成功交接/USB/STA/ESP/真实用途批准；成功交接后第二次拒绝分支未执行。见[报告](../../reports/2026-11-05-tcp10.md)。
