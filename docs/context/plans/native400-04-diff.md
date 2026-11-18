# 400-04 Diff（实现前）

2026-11-02，配套[Spec](native400-04-spec.md)。源SHA/当前摘要副本在忽略.cache/native400-04。

| 模块 | 变化 | 不变 |
| --- | --- | --- |
| Registry/session/MTLS | 受信profile注入cap/target/lease decoder，缺省旧函数 | 绑定认证/guard/失效/期限/CAS，不接wire布尔批准 |
| core native400 session/observation | 新profile与跨消息有界投影/证据引用 | 400-02 actor、400-03合同/golden、旧360/A3不放宽 |
| runtime native400 review | 默认OFF适配器/临时handler，复用A2 reader/A4 lane/writer/queue | 无listener/生产CLI/plugin/真实设备/Flash写 |
| 临时loopback client | 新显式路径及必要响应头元数据 | 默认旧路径、单HTTP/socket、实际退出/无自动重试 |
| simulator/fixture/test/CLI | 新wire实际actor/双遍、临时PKI/CAS/TLS、负例与恢复 | 不复制真实媒体/凭据/配置，不写固件 |
| 文档 | API/Spec/Diff/report/context/history | 不代共同G0/G1/G2或设备准入 |

具体修改与测试数量在实施后回填；发现合同无法表达的能力只列缺口，不静默扩revision1或伪造状态。

## 实际落地（2026-11-02）

新增7文件：core/session profile与400观察投影、runtime adapter/handler、simulator executor、临时lab、37专项和监督CLI。四个共享文件Registry/session-runtime/mtls-peer/pull-request-owner仅增加受信validator/decoder注入、显式review路径及rawHeaders返回；302份原源中298份SHA保持，旧400-02/03、360/合同/向量/仓库/guard/read lane/writer不改。新投影沿A3原则、A8只读根；没有400 Flash事务或保存/库存成功。

实际37专项覆盖私有CAS/真实loopback TLS/原session/guard、20页、两遍/独立首帧/118短尾/大于窗口、本地idle4证据、重连/缓存新owner、续租/独立作业截止、坏元数据/逐块撤销、取消draining/实际退出。原字段校验不足以覆盖owner，因此另加verification/commit/dispatch/完整源cursor关系。初始专项发现admission在verifying时被null覆盖及临时peer只等客户端close的连接竞争，已修正并复验，未用重试/加TTL规避。

local4优先/回最新base、自动loop/欠载/renew综合调度仍留400-05；不声称跨角色、Flash/OTA/音频/真实设备。API/回退见[说明](../../protocol/native400-host-review.md)，最终测试/未覆盖项见[报告](../../reports/2026-11-02-native400-04.md)。
