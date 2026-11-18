# 400-07 完整调度周期预算 Spec（实施前）

2026-11-03。已读AGENTS/README/index/current-system/todos/开发及维护规则、400-05实际driver/临时lab/owner、400-06 D07/预算。保留修改、不用子智能体；不读/执行固件，不接真实媒体/设备/生产listener/插件/现有服务或配置，不提交推送。

## 范围与不变量

先用现有400-05真实私有loopback/session/guard/虚拟双时钟和实际local reader执行R6001→499ms间隔→999ms本地读→R4503的条件，保存去敏修改前结果；不在最终源码保留旧不安全实现或绕过开关。源/控制仍同一实际IO所有者、单TLS/HTTP，忽略abort须等实际退出。

新增pure core预算函数，复用固定read/ACK参数：poll500、compute100、exchange500、source1000、cleanup100、margin10、ACK4000ms为**离线声明上界**，不是设备测量。renew拒绝floor=4510保持，触发提前为floor＋poll＋compute＋exchange＋source＋cleanup＋margin=6720ms，不增加TTL/作业寿命。host只在scheduling候选使用新触发，缺省400-04不变。未知/超声明成本失败关闭，不能追认超期成功。

driver在本地/远端读取前强制给控制交换机会；gateway.read收敛为GET-only，控制/flush归exchange并对整个exchange设deadline与实际退出等待，source读单独1000ms而不再暗含另一轮控制HTTP。每次同步decode/supply/verify/replay/prepare/submit等按声明compute100ms检查，超限fence，不发布新actual。控制交换与source共用owner，不并行、不自动重试；关闭等整个pump及实际异步工作退出。wall timer触发只是失效信号，不能假回收。

新增可信代码可选bounded-job准入：按剩余目录页、文件段/两遍、完整控制交换/清理、同步步骤、实际118/241时长保守估算至第一遍完整播放收尾；超过固定remote120秒就拒绝，并保留旧目标/画面/队列。默认review手动路径仍允许尽力执行并在原deadline失败，不承诺全部400包在120秒内完成；loop也只能在原deadline内重复。新选项仅临时内部API，不进wire/IPC/生产配置，不新增正式能力协商、真实proof或saved。

## 验证

- 实际修改前/后6001/499/999链对照；独立时钟、response尾部/多条flush总成本、同步计算超限、GET/本地读到期、取消/撤销/休眠/关闭实际退出。
- pending ACK/取消优先/renew窗口与队列期限互不放宽；迟到/超成本不给verified/首帧，不开第二IO/socket。
- 170段在近1秒/段下超120秒的有界传输/actor失败路径，或者用真实批准原创素材组成同等段数；不可用假verified替代actor；严格准入在操作前拒绝超预算并保旧状态，允许可计算的短样本；截止与续租独立。
- 旧400-05 35专项、400-04缺省37项及固定400-03字节回归。专项→check（语法）/test（含构建）/隔离CLI，记录数量/清理/局限；新问题才扩大测试。更新当前摘要、API/报告、D07待确认与归档旧条件算术，固件证据仍为400-06读取快照。

## 回退

停自有pump/fence→等source/控制真实退出→close临时adapter/worker/HTTP→关调用方TLS/session/store→删临时PKI/CAS/素材根。保留不退出操作的pin，不重试新owner。回退新预算/driver/显式选项与测试文件（原字节备份在忽略.cache/native400-07/before）回400-05；合同/向量/TTL/N/分区/缓存/现有配置保持。未知ESP资源、可信时间/凭据/真实用途/G0/G1-G2/24fps继续不准入。

计划预算准入只作必要条件：拒绝声明成本已无法装入120秒的计划；fits不构成实际总wall/RTOS上界证明，未知等待/超成本仍失败关闭。单步计算超限后即使软件操作已返回，也不发布该新actual；保留历史画面，不声称能撤销物理刷新。旧actor/原始deadline不因预算评估改变。

负例审查补充：compute100ms按单次pump内所有受控同步步骤累计，不能把prepare/submit各100ms当成一段100ms空窗；内容失败后的恢复exchange若也超预算，仍须清context并抛出失败，不能从catch中绕过fence。补恢复交换失败与多步骤累计超限回归。

## 本片状态（2026-11-03）

离线范围已完成：24专项/独立监督CLI/check/含构建1150项通过，见[报告](../../reports/2026-11-03-native400-07.md)。冻结旧链与新链实际对照、真实170段原创媒体job负例及必要预算检查已交。严格计划fits不保证未建模wall/物理时延，原TTL/截止/wire不变；下一400-08只读N_boot来源映射，正式合同/用途/固件资源与实物窗口继续待审。
