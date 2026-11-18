# A2 三摘要与严格导入 Spec（实现前）

状态：按实现前范围完成离线适配，见[报告](../../reports/2026-10-30-round-pet-a2.md)和[活动API](../../protocol/round-pet-a2.md)。真实包批准/跨端/设备仍待验。

2026-10-30。范围：按G0候选recipe实现本仓库离线适配；不关闭联合C02/C03，不接设备、不运行固件工具、不修改固件/pet/bridge/DSH，不安装或开启listener。保留已有修改、A1/scoped及旧导入行为；零新依赖，原创MIT代码/测试，无上游画面复制。

## 输入、身份与批准

显式目录输入为package.json（固件导出包）、catalog.json（导出catalog，sha256=P）、manifest.json（所选原始来源）和{id}.pet。只读选定文件，不扫描/执行目录内程序。目录及路径拒绝symlink；输入需为调用方拥有的稳定本地快照，现有读取不是对恶意并发目录替换的OS沙箱。

C使用既有严格JSON解析器的UTF8/重复key/深度限制，再约束整数词法、安全整数、有效Unicode；递归ASCII字段键排序、数组保序、无BOM/无canonical尾LF、不做NFC/trim。闭合校验包、catalog、profile、timing、semantics。P=SHA(C(content))，M=SHA(C(content.catalog))，F=完整文件SHA；N只接受既有V2 namespace，I=生成index.json原始字节SHA。真实46原编号集合从独立批准输入核对，不把合成ID集合写死成真库。

批准来自受信调用方，必须固定P/M/N、来源原始SHA、46个升序ID、license_ref、批准标识/署名及使用范围。默认不批准；不能拿自算摘要/包内license字段充当许可。测试使用original-test批准和原创字节；真实来源仍需人工审核并传入reviewed-upstream批准，不自动查找大库。source原始SHA和包声明一致；不声称已审查源文件全部业务字段。

catalog字段原值映射最小manifest，不增加package_schema或PC循环策略。timing与catalog严格同序同ID，8语义固定0/4/1/11/43/58/7/55；媒体要求360²/24fps/241帧/PET4 flag1/key12/tile20。streaming按文件核对长度/F、全帧CRC及完整index_sha256。逐文件释放媒体，不保留全库字节；相同F可复用本次完整验证的元数据，但每个输入文件仍核SHA/长度。

## 复用与发布

新增core身份/recipe适配与runtime专用入口，复用material-store/worker的配额预留、CAS版本、取消/期限和关闭。专用options仅内部显式传递，不加CLI/IPC/UI。worker重新验证包/批准及来源原始SHA，实际字节验证失败不发布新版本；旧snapshot/PC角色入口保持。

index沿用schemaVersion=1/variants/manifest/files，files路径固定{id}.pet；独立provenance记录包含完整受限package、exported catalog、批准与F/M/P/N/I，不存来源原文/绝对路径/秘密。记录放CAS外独立私有目录，最多32份、单份≤256KiB；不改变既有CAS目录的闭合元数据规则/配额口径，额外元数据上界8MiB另记。CAS发布与provenance不是跨文件事务：CAS先完成，provenance原子不可覆盖发布后专用ready才成功；后者失败留下可审阅普通CAS，不能当已批准A2版本或自动删除。

重开必须重新提供独立批准，严格核对ledger内容/recipe/I/批准，并cachedOnly复验全部CAS字节/媒体；不从本地记录自己生成信任。坏ledger/CAS保留且失败，不覆盖或静默重建。close/取消使异步ready失效、终止worker、清自己stage；已完成CAS/ledger不因close删除。一个handle复用现有catalog pin，保护CAS至close；持久设备选择/清理仍由现有lifecycle负责，不伪称provenance本身是设备选择。

## 验证、验收、回退

专项覆盖G0数学golden、对象重排/数组顺序/UTF8、重复转义key/浮点/孤立surrogate/未知字段，F/M/P/N交换，许可/来源/ID/时序拒绝；原创真实241帧46描述流式导入、index hash/summary、CAS重开无源目录、严格240帧/CRC/index hash负例；配额/取消/坏缓存/坏ledger/元数据发布失败与不可覆盖、资源回收。运行check、全套test与独立临时专项CLI，记录通过范围。

不引入新网络、证书或运行服务。回退关闭专用handle、释放worker/pin，撤回专用入口即可；已有普通CAS/index/选择、设备Flash/N、前瞻/a7均无迁移。A3实体观察/UI、A4通信、正式P/源SHA/许可共同批准和G1/G2仍未完成。事实更新当前摘要，按主题归档旧“A2尚未实现”。
