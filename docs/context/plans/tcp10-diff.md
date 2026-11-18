# TCP-10 Diff（实施前）

- runtime/native400-tcp-lan-profile：抽取现有严格身份校验以复用，不改变recipe/容量/窗口/网卡规则。
- 边界复核补充：摘要显式64字符，core/native400-tcp-network的IPv4要求数值重组等于原输入；拒绝JS正则末尾换行别名，不扩大合法输入或网络权限。
- runtime/native400-tcp-lan-host：新增WeakMap赢家和option关系、可信内部端点门禁；不新增IPC字段/写路由，不自动start。
- 新runtime/native400-tcp-lan-request：闭合请求、私有文件严格只读加载、独立decision装配、纯设备RAM配置与一次赢家交接。无文件输出/USB/自动服务。
- 新专项和隔离验证CLI；原TCP08/09回归随全量执行，真实LAN成功分支明确未执行。
- 更新协议/报告/结构化证据、当前摘要与待办，归档被替代入口；新原创代码登记MIT，零新依赖。不改固件/pet/bridge/DSH或素材，不提交推送。

实施状态：18专项/独立CLI、check及含build单套1568通过。真实UDS/loopback排练，无LAN成功交接/USB/STA/ESP/真实用途批准；成功交接后第二次拒绝分支未执行。见[报告](../../reports/2026-11-05-tcp10.md)。
