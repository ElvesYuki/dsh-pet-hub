# 400-03 独立协议与Node/C++字节向量 Spec（实现前）

2026-11-02。先读AGENTS、README、当前摘要/待办/规则及400-01/02、旧360 wire/HTTP/宿主oracle。保留已有修改、不用子智能体。仅离线canonical协议、关联规则/HTTP元数据和原创宿主向量，不接设备/真实素材，不启listener、不改固件/pet/bridge/DSH/运行服务或安装插件/提交推送；固件仓库本轮不读写或执行脚本。

## 范围及版本

- 独立round-pet-native400-wire-review/1，hub-device/1 envelope/schema1，namespace_scope=offline-candidate且N严格为400-01离线N；execution_profile=native400-full-offline-review/1。不是正式协议分配或联合G0签核。旧round-pet-native360-wire/1及其修订2表/80正62反、parser/C++/adapter原字节保留，不改通用schema1/2或400-02模型。
- 新closed合同表、Node纯core canonical编解码/语义检查、独立C++17宿主oracle。复用本仓库MIT canonical/UTF8与原oracle通用JSON解析思想/代码（来源登记），不复制外部实现或加依赖。UTF8 fatal、重复解码key/BOM/整数别名/unknown字段/深度/uint64/4KiB包均严格拒绝。Node/C++独立执行语义，对同一规范字节输出一致；表和golden SHA固定。
- hello begin/challenge/confirm/ready沿7字段context、挑战/版本/包三摘要/策略显式协商；绑定/可信时间/mTLS/session guard和lease权威沿既有模块，不能从能解JSON推导身份或执行批准。版本轴cap3/playback3/display3、storage/inventory0不支持；其余控制/lease/touch/error显式版本，cancel新版本区分失效与实际退出。
- cap沿400-02本地window review明确file/window/3RGB/history/tile/packed/头表/收据，persistent=null，不伪装旧schema2。file5865472、ring1MiB、原78 ID、42=118/其他241、24fps/extra key。固件实际区域/IO/栈/TLS资源另交，新合同不分配ESP内存或夸大资源证据。

## 完整性与状态

1. wire固定verified-replay，hello/command不接受progressive-review或自动降级。400-02渐进只离线风险对照；若双方将来选择渐进，必须另冻策略/版本、认证头表与帧来源、pending/failed显示和恢复证据，不放宽本profile。
2. desired是发送目标，accepted是接纳/本地延后，verifying是第一遍未全验，verified须整F/CRC/index/RGB/extra完整证明；playing是当前会话独立首帧提交后的显示观察，不能用HTTP/首遍下载/verified替代。重复报自带摘要只是语法证据，400-04须以已批准metadata和真实actor/guard校核。
3. 显示字段区分current/历史、origin local/remote、source context/control/target、首帧commit序列/当前commit/帧号以及verified报告关联；旧会话只有historical可呈现，不能成为新current。42最大frame117、其他240；playing不能与维护/未知画面并存。priming/verifying/buffering/failed及保front投影不承诺旧动画持续。
4. storage/inventory未实现；仅允许unsupported状态，saved/offline_available为null且inventory_known=false。禁止save/evict成功或known空库存；将来持久版本、proof/根floor/unknown/淘汰需独立升级。cancel区分立即失效与io_exited，未实际退出不能因回执释放owner；报文只表达，不实现网络/Flash退出。
5. lease仍用相对duration/remaining_ms（1..30000）和十进制uint64，host本地deadline不出wire。单TLS/HTTP、control与permit互斥、段后exchange、撤销/取消逐块guard及实际退出不变量保留；无新TTL放宽、重试或鉴权流程。

## 目录与HTTP

新review路径前缀/hub-device/native400-review/v1，与旧360不混用。78目录按原ID顺序分页；descriptor含实际frames/index/RGB SHA/extra，先按每页最多4条冻结（20页、末页2），用极值身份实测canonical≤4096B，不假定旧8条仍适合。cursor必须连续ID、total78、尾页next=null；目录身份/来源许可来自400-01，不能由wire自批P/M/N。

permit逐次绑定context/control/P/M/N/目标/当前exchange；manifest响应回显permit和授予exchange关联。asset permit含显式[start,end]及total；单Range≤32768B、强ETag=F、206/Content-Range/Length及许可/request id/seq全部相符，禁开放/suffix/multi、重定向/编码/重复关联头。Node纯函数校验路径/HTTP响应元数据；Node/C++同字节范围是JSON封套/语义，不声称C++实现HTTP/TLS解析或真实传输。

## 验证、交付、回退

新增原创fixture/正反golden生成与固定JSON，覆盖全部消息/control/record/error分支、78分页/极值身份/118尾帧、策略/verified/playing/storage负例、旧profile互拒、UTF8/重复key/非规范数值/4KiB/uint64边界，独立Node/C++输出与拒绝一致。HTTP关联/Range/ETag负例单列Node测试；编译产物只在私有临时目录并finally清理，限定compiler/packet超时。C++仅宿主，非ESP构建/互操作证明。

执行专用监督CLI、npm run check（仅语法）和npm test（含构建），记录实际数量/清理/未覆盖。固化合同/向量SHA，保持所有旧源码身份；更新当前摘要/C表/下一入口，备份并归档被替代400-03待实现段。本轮不装配400-04，不生成真实批准/生产N或改磁盘格式/监听器。

回退删除本轮独立review文件即可，无旧字节/服务/数据迁移。下一400-04先Spec/Diff，复用session/guard/A2/A3/A4/A8/R7与400-02 actor做默认OFF临时链。固件必须另确认新profile/版本、策略/两遍初始延迟/每loop重读/7712B帧收据成本、400 N/Store、资源区域/IO/栈/TLS、可信时间/凭据/撤销/实际退出及G1/G2/24fps；未确认保持NO_GO。

### 实现前字段细化（本片范围内）

全量验证需独立verification_seq：远端playback.report/verified携带它；local4无远端命令，故另有asset.verified全媒体证明，不能伪造remote4来取得验证引用。display.actual引用该序列，后续400-04在当前session内解析到同F/已批准descriptor的证据；codec本身不证明历史序列存在。增加此record不意味着local4已缓存或库存支持。素材引用适配另核permit.total_bytes对批准descriptor，避免同F配错HTTP总长；这也是400-03离线信任边界，不新建认证或运行装配。

## 执行状态

2026-11-02本片离线范围完成，94正/116反Node-C++同字节、36专项/独立CLI/check/含构建1054通过；实际偏差、HTTP/状态覆盖边界和未决W01–W10见[Diff](native400-03-diff.md)/[报告](../../reports/2026-11-02-native400-03.md)。正式profile/策略和固件资源/持久化未共同采纳，下一400-04仍默认OFF。
