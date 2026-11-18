# 400-12 内部来源选择身份绑定

2026-11-03。[Spec](../context/plans/native400-12-spec.md)/[Diff](../context/plans/native400-12-diff.md)、[报告](../reports/2026-11-03-native400-12.md)、[原创证据](vectors/native400-12-source-selection-v1.json)。本仓库MIT新增代码；仅原创临时文件验证，没有真实cache/媒体/固件/设备或现有配置操作。沿用[400-08 reader](native400-bootstrap-review.md)/[400-09 owner](native400-source-review-storage.md)，[400-11完整控制契约](native400-source-review-controls.md)中只有内部选择绑定在本片实施。

## API与所有权

`createNative400SourceSelection({file,sourceName?,lifetimeMs=60000,clock=()=>performance.now(),signal?,timeoutMs=10000,beforeCheck?})`是可信运行层内部工厂。file须显式规范绝对路径（normalize相同，无NUL），不是网页文件名/浏览器上传；名称沿安全label约束。不同路径即使字节相同也不能使用同一选择，不能只凭basename匹配。

| 返回项 | 语义 |
| --- | --- |
| `ready` | Promise；只做元数据，实际fd关闭后返回模块内WeakMap识别的冻结opaque引用 |
| `snapshot()` | schema1/profile native400-source-selection-status/1，安全source_name、phase、error；无路径、指纹、inode/时钟、批准或许可引用 |
| `resources()` | closed/open_files/content_reads=0/retained_cache_bytes=0/signal_listener；选择成功不保fd，仍由调用者close释放signal listener |
| `revoke()` | 同步失效引用/在途绑定并失效capture，等待中的真实I/O不假退出 |
| `close()` | 同步失效、移除listener，幂等Promise等元数据hook/fd实际退出；不删除/改源 |

phase为selecting/selected/expired/revoked/failed/closed。snapshot返回新安全对象，修改它不影响内部选择。引用不能JSON/structuredClone恢复，也不是fd/完整批准/网页令牌；无全局可枚举选择列表。只有持引用的可信内部代码可提交绑定；单次消费、服务/审阅会话、请求序列/任务授权仍待400-13，不宣称本引用已经实现这些权限。

工厂以O_RDONLY|O_NOFOLLOW|O_NONBLOCK开短期fd，核普通文件、当前uid、无组/其他权限、nlink1/精确29360128B；BigInt dev/ino/size/uid/mode/nlink/mtimeNs/ctimeNs保为十进制字符串。fd与path需稳定，beforeCheck仅内部异步测试hook。未读header/内容、未做SHA/媒体proof、不复制或导入任何资产。reference就绪只表示已选择元数据，不是verified/current或设备库存。

## 首读前绑定与任务内校验

既有`createNative400BootstrapReview({...inputs,file,expectedSource})`新增可选expectedSource。undefined完全保留旧内部路径接口；显式null/伪造/JSON克隆/structuredClone引用失败，无自动降级。绑定时先核真实引用、**完全相同的路径**、存活/准入期限；真正打开fd后/首字节前比较同一指纹。合法新文件、同字节新inode或同大小改变也拒绝，修复400-11 OBS-01显示的选择→打开间隙。

metadata检查使用从旧reader提取的native400SourceFingerprint/checkNative400SourceFile，实际内容仍由同一个reader/同fd/64KiB缓冲完成整cache SHA和每个物理引用payload F。任务内每次读前后和结束核fd/path稳定；在这些边界后发生竞态可能已读选定fd的一段，但不会发布稳定来源map，不能声称任何并发变化都能在零字节前察觉。

reader新增内部`checkSource()`同步检查引用撤销/关闭/时钟；fd关闭后它仍可供manager提交门禁检查，不重开路径/不读取字节。它不提供新的读取权限。reference只存元数据，reader/checkSource被释放后记录可随引用GC，无全cache持有或长寿命fd。

## 期限、撤销和真实退出

lifetimeMs为1–60000ms，始于元数据成功/关闭fd后就绪，期限相等即拒绝**新任务**。clock必须同步有限非负单调数值，反向/抛错/Promise/非数拒绝，安全错误不泄露底层cause。它只是宿主内部选择准入策略，非设备租约/测量上界。

每次reader创建独立准入绑定；已准入的读不因选择TTL随后过去而中断，避免长读中途按旧选择期限取消。snapshot可显示expired，而该已准入任务仍在读；再次创建任务拒绝。revoke/close、外部signal或坏时钟则会使在途binding的下一有效性检查失败。无单次消费承诺，受限请求控制器以后另行实现。

capture期限timeoutMs为1–30000ms，signal覆盖capture及就绪后的引用生命，元数据计时器capture结束清除，选择TTL按单调检查惰性判断，无遗留轮询/timer。若hook不响应abort，close/ready仍等真实返回才关fd；signal revoke不会把实际资源归零。source.read/manager也遵循真实退出，计时器不能硬中断OS/同步fsync或挂起钩子。

## manager提交与历史

原owner.review/revalidate选项可传expectedSource，原路径/label/floor/批准逻辑保持。选定引用传入实际reader后，manager在读后、journal原valid门禁及发布前复用checkSource；原选择检查保持，后续[400-13控制器](native400-review-controller.md)已另加可选同步Boolean授权gate；旧绑定自身不代替会话权限。

- 换文件/引用失效时失败，旧记录只作历史；不改/修复源，不自动改成无选择调用。
- rename前选择撤销由原valid门禁阻止提交，旧档保持。rename已持久成功后撤销可保新revision历史但不发布current，不称回滚。
- 选择撤销与rename后I/O故障同时发生时，review_commit_unknown优先，owner冻结直到显式close/reopen；不得吞unknown为选择失败而继续写。
- journal格式、source-map recipe/字段和来源证据等级不变，reference/path/fingerprint从不持久化到map或journal。current仍为一次完成审阅，不持续监视此后源变化。

新增稳定错误：bootstrap_selection_invalid/mismatch/changed/revoked/expired/clock；原unsafe_source/source_changed/payload_mismatch等仍适用。选择工厂未知底层code只映射bootstrap_read_failed，cause仅内部保留。sourceReview白名单只增加这些错误枚举，不改view/schema/renderer。伪造引用/过期可在reader构造时同步抛；打开后身份不符由ready拒绝，fd收尾后才完成。manager仍以失败状态投影，不发布部分可信结果。

## 验收、回退与未覆盖

入口：`node scripts/verify-native400-12.mjs --output .cache/native400-12/results.json`，仅原创MIT临时稀疏文件/现有PET4，独立监督环境。详见35专项与全套报告；资源计数不作RSS/多日或ESP预算。

[CTL-09–12](native400-source-review-controls.md)中的内部选择换文件/改动/权限/链接子范围已有覆盖；CTL-13–16仅选择TTL/撤销/读退出子范围，选择模块本身不做审阅会话/一次消费；400-13内部控制器已补，真实页面授权仍无；CTL-29–32仅选择撤销/原unknown处理，非完整授权gate或定向取消。其余CTL场景不能因本切片标为通过。

回退：close选择/reader/manager并等待实际退出，保源和journal；可撤回可选expectedSource代码回原内部接口，不迁移格式/配置。失效引用不能在同次操作自动降级。原400-10只读status与service/profile/IPC/UI不变，未新增按钮/网页操作/native picker或真实DSH加载。

后续[400-13](native400-review-controller.md)已实现内部可信会话/单次选择/seq去重/定向job取消与同步授权gate，复用本选择/原事务；下一400-14先Spec/Diff接显式交互，不能直接把raw引用当网页授权。400-14交互profile/可信页面授权与原生provider另审。真实用途/G0/设备N_boot/库存/Flash writer/proof/TLS时间凭据/G1-G2/24fps仍独立，外部状态沿400-06快照。
