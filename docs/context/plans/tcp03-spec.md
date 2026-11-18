# TCP-03 Spec（2026-11-04，实施前）

状态：已完成本片内部候选范围，见[报告](../../reports/2026-11-04-tcp03.md)；端侧共同定版/新增wire互操作/设备仍未做。原实施前边界如下。

先读取AGENTS/README/current上下文、TCP-02 API及终端最新current-status/current-todos/实际v0协议。端侧仍未共同定版状态扩展，不能把用户允许继续开发写成固件已采纳。固件只读，不运行其脚本；不接ESP/生产服务/插件/profile，不改素材、依赖/缓存，不用子智能体/提交推送。

实现管理端默认OFF的状态与完整性投影候选、共享只读展示、完整字段交接与宿主负例。不是新wire：不分配type/长度、不修改7消息/HELLO/mapping/CRC，不接TCP02 listener或DSH写路由。当前v0仍仅last_frame0/current_display unknown；候选需可信调用方显式启用，并由未来共同定版decoder给已解析报告。

输入封闭schema，uint64十进制字符串。固定scope{connection,boot,session,mapping}；report_seq端侧启动内单调，basis_seq为remote base seq，token/source为实际worker/View代数。desired由hub本地明确setBase(seq,action,absoluteDeadline)建立，不由报文自报授权。remote仅0/1/11；touch仅4；local仅已恢复0/1/11（包含本地随机策略，4仍仅触摸）。四对象完整身份由既有恢复清单提供，不从动作编号推断SHA。

候选报告：verified（全文件SHA+metadata+frame0 CRC完成，不是whole-media）；state（实际origin/action/token/source/frame0提交状态）；exit/error（精确关联当前source，标front是否保留与固定原因）。字段提案见协议交接，JSON对象只是内部宿主验证形状，非网络JSON/新TCP帧。

verified与首帧分离；没有对应verified的remote presented不得标当前。touch先清current remote，仅保display历史，不删除最新有效base；touch结束本身不恢复remote，必须新token/source的明确state并匹配最新base与新verified。旧连接/旧base/旧touch/source的晚报文不能复活目标。base到期/取消/断线清当前，保留历史标historical；report_seq重复同body无副作用、不续期，同seq不同内容或跳过本地单调clock失败关闭。顺序允许跳号（端侧事件可能丢失），丢失事件后依靠完整state快照收敛；scope错/旧序直接拒绝不能污染新scope。当前scope结构错误清当前不保假成功。

展示分别desired、device-reported file verification、device-reported frame0、actual touch/local/remote与历史；authenticated=false、whole_media=false、saved/持久确认不生成。所有报告仍明文LAN未认证声明，不能把模拟输入当真实SHA/View证据。

验证：默认OFF/封闭schema/身份映射、验证与首帧独立、touch多轮/新base/旧touch结束/旧source迟到、取消/TTL/旧连接、重放不续期/冲突失败关闭、非法完整性等级/错误与保front历史、uint64大数、快照重建与共享UI私有字段过滤。仅宿主对象/虚拟clock，新增wire/C++/loopback互操作都未执行（原TCP01/02保留回归）。check/test含build。

回退丢弃候选实例，旧scope失效，仅留历史；不改owner/旧v0/配置/固件。下一端侧共同决定type/长度/协商、来源/时间/事件语义，再双端二进制向量及端侧worker/View、LAN资源短测。未经共同对齐不启新消息。
