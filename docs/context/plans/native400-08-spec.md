# 400-08 N_boot只读来源映射 Spec（实施前）

2026-11-03。已读AGENTS/README/index/current-system/todos/开发与维护规则、400-01身份/批准、400-06 D01/D02及现有reader。仅读固件AGENTS、boot_catalog.h和native400_boot_image.py文本/摘要核V2格式，不执行/import其脚本/构建/测试，不读取真实缓存/媒体/带NVS整片。保留修改、不用子智能体、不提交推送、无设备/生产listener/插件/现有服务或配置操作。

## 范围/契约

- 新pure core inspector，独立按公开字节布局解析256B双根与5个对象头，复用本仓库CRC/uint64/canonical/native400Metadata。N_boot=SHA(UTF8(round-pet/whale/native400/pet4/tile20/key12/v1))=a34d0c7b…，与N_offline=dd0f19bf…、P/M、文件F、cache镜像SHA分别保留；不改400-01/03已有identity/profile/scope/向量。
- 固定28MiB、4KiB sector、stride0x599000、4活跃/1备用，geometry(2,400,24,20,12,1)、root state2/idle0/touch4，固定ID集合0/4/1/11。核magic/CRC/commit/保留0、slot/gen/F/长度和批准metadata，seq/gen读uint64小端并输出十进制字符串，不转Number。
- 两根各自需根及引用对象有效，选较大有效seq；等seq拒绝、两根无效拒绝。坏根/引用可回较旧有效根，但只报告来源审阅的degraded/fallback，不写可信持久floor；调用者可明确给minimumSequence，低于则拒绝。任何读取I/O未知直接失败，不冒充坏根或空库存，不自动修复/格式化/写根。
- 输入须分别给候选package/catalog、调用方独立400-01 approval、独立mappingApproval。mappingApproval闭合新offline-source-review schema，精确pin N_boot与候选N/P/M/源SHA、4动作、candidate approval_id/许可/credits/source_kind；不从文件/候选/账本自行生成批准或扩生产用途。
- 输出有版本的canonical映射recipe＋摘要，包含源cache SHA/选根/对象N→候选P/M/逐F及批准标识，明确仅PC来源审阅、未执行全媒体CRC/index/RGB、不构成设备actual/saved/实时库存或离线可用回执。不接A3/session/guard/wire、不创建运行期写入或来源迁移。

## runtime与资源

新增显式只读review工厂，打开调用方明确提供的私有普通cache文件，精确长度28MiB；32MiB整片/偏移抽取拒绝，不提供Flash写CLI。O_RDONLY/NOFOLLOW/NONBLOCK、单fd、≤64KiB流式缓冲，全cache SHA与四对象F均独立算；不把声明F当已验payload，不保整文件字节、不复制到CAS。开头/读取过程中/结束核同fd指纹及路径身份，替换/改字节/截断/撤销权限/硬链接等拒绝，不能用mtime作为hash替代。

ready只在完整读/摘要/一致性和关闭fd后发布单一结果；无部分可信输出。支持signal/有界期限、只读进度、幂等close；取消先失效，忽略abort的实际read/hook未返回就持fd等待，不假退出。未知I/O/媒体F错/批准错/根不一致保文件不改，无自动重试。所有权与测试注入明确，不生成真实格式化/安装镜像。

## 验证/回退

原创模拟器只在独立临时根创建稀疏.fixture，头/有效payload采用本仓库原创PET4，不是可安装真实角色的镜像；与批准sample身份不匹配，绝不用于设备。测根选择/回退/相等/坏CRC/commit/保留/geometry/N/slot/gen/重复ID/F/长度、2^53/uint64边界/floor、P/M/N/F误换/许可/自批准拒绝、payload损坏、整片/链接/截断/改路径、故障读不fallback、实际取消/close/期限及无副作用。至少一次真实完整cache SHA/四F对照，成功亦无设备证据字段。

专项→check（语法）/test（含构建）/隔离CLI，记录原源码/固定协议SHA、源只读和清理；不新增复述实现的测试。更新当前摘要/待办/G0/许可说明并归档被替代记录，外部驻留/资源仍400-06快照。回退仅新独立模块/测试/CLI/文档，先close自有review等fd退出再清临时根；没有源/namespace/分区/缓存/配置迁移。共同G0/正式协议/真实用途/TLS/G1-G2/400@24继续未准入。

## 本片状态（2026-11-03）

离线范围已完成：44专项/独立监督CLI/check/含构建1194项通过。317条原源SHA保持，5新增独立文件；格式参考/许可证4份摘要保持，无真实cache/媒体/设备或生产入口。输出只为PC来源审阅，未执行全媒体/设备证据，不改review identity/wire。见[报告](../../reports/2026-11-03-native400-08.md)/[API](../../protocol/native400-bootstrap-review.md)；下一400-09保存/需新独立批准及复验的可信重开/只读投影，G0/真实用途/固件资源仍未关闭。
