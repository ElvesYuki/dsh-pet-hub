# A9 持久化负载与延迟复评 Spec（实现前）

2026-10-30。继A8下一项，已读规则/当前上下文、metrics、binding-store、root authority、pull与临时TLS fixture。保留修改、不用子智能体；仅自有临时文件/PKI/UDS/loopback、原创PET4、可控时钟，不访问固件/设备/pet/bridge/DSH，不启生产listener/插件/提交推送。

## 目标与口径

不优化或改变A8权威/队列/TTL策略。只在显式metrics下计：根验证/编码、锁获取、锁内CAS、写/文件fsync/rename/目录fsync、rootState额外revision摘要、整个root commit、候选准备/发布和持久profile同步exchange；计调用/无变化/写字节/同步/锁等固定数值。保留原指标默认和v1统计口径，不持久路径/身份/报文或逐条无界样本。嵌套total不可相加；计量本身成本另记，不从业务时间扣除。

## 同负载与容量

四档：v1/显式v2，各1/64绑定；每档固定3轮相同语义的初始/重复库存、租约、目标接纳、实际32KiB/4KiB分段下载/全F与241帧CRC、verified、保存、更新库存与renew。所有模型回执经真实Node loopback TLS；不是ESP持久/面板证据。v2其余绑定预置同形状检查点以暴露全文件复验成本，v1无根字段是格式固有差异，不能把文件字节差当控制轨迹差。

使用现有A4承载fixture的原创内存media provider隔离元数据成本；A2磁盘素材reader/A1执行闭环保持A6/A8已有证据，不以本测量覆盖其物理I/O。初始PKI/注册/根预置与cold handshake另计，不混入warm业务窗口。比较控制顺序/对象字节与调用数，不以主机时长必须更快/更慢作断言。

容量单独填充长ID/大uint64/完整根及commit字段，记录131072B/64绑定门禁前的实际字节、已注册/有根数量、失败操作及失败前后文件是否保持；不扩容或降低验证，最大条数不承诺所有字段极值同时装入。

## 条件预算与负例

继续区分样本max/桶分位与上界。以旧假设B1900ms为基线，加**假设**host根服务上界R，分别核server request2000、既有fixture client1500、ack/guard RTT4000、lease15000及双端500ppm/margin10；用现有leaseSendBudget计算，不延TTL。输出所有条件及NO_GO_UNTIL_MEASURED，不能把实测max喂成物理上界。

可控时钟在commit前/后推进，核pending保持到durable成功、超deadline时已落盘但不发布/不续下发、时间恰边界、未知写/锁冲突/撤销仍关闭。同步fsync不能被JS timer硬中断，本轮不能给硬取消上界。沿用A8崩溃负例，不无故重跑物理/30分钟测量。

## 交付与回退

扩展现有可选metrics，不新建第二套事件监听/认证；独立simulator计量与严格去敏证据校验、专项/监督CLI。最终check/test保持692基线，CLI正常/SIGTERM清理；报告列四档数字、容量/条件预算、未验项；更新当前摘要并归档A8待测状态。

回退撤回可选metrics/测量入口，关闭自有TLS/worker/store并删除临时目录/PKI；数据格式、源配置、v1/v2迁移策略与正式NO_GO不变。冷盘/重传/OS停顿/真实漂移/多日、可信锚/整盘回放、真实包/共同wire/G1/G2/设备窗口均未覆盖。

实施状态（2026-10-30）：本Spec/Diff先于实现；14专项/706全套、独立CLI去敏观察和中断清理通过，见[报告](../../reports/2026-10-30-round-pet-a9.md)和[API](../../protocol/round-pet-a9.md)。原A8待测摘要已[归档](../history/round-pet-a9-evolution.md)。保持物理时延/可信恢复/共同G0/G1/G2/设备准入限制，不将样本当上界。
