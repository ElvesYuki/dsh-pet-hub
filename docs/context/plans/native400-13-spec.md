# 400-13 Spec：内部有界操作控制器与同步授权检查

2026-11-03，先行范围已完成离线实现，见[报告](../../reports/2026-11-03-native400-13.md)。承接[400-11拟定契约](../../protocol/native400-source-review-controls.md)、[400-12选择绑定](../../protocol/native400-source-selection.md)。已核AGENTS/README/context/规则及原owner/journal/selector。只做第1条管理操作线的400-13内部切片，400-14交互接线另做。保留修改、不用子智能体；仅原创临时文件/虚拟时钟，独立临时环境，不读真实源/媒体/cache/固件/备份，不接设备/生产listener、不安装/烧录/提交推送，不改DSH/pet/bridge/现有配置。新代码MIT、零依赖。

## 状态/权限与容量

新runtime controller自行创建/拥有原400-09 owner，验证独立package/catalog/两份批准，固定输入摘要；不接收任意页面批准或外部可并发改动的owner。可信内部authorize发opaque会话，单活动会话/generation/单调期限；请求的reviewer ID不自授权。choose仅可信内部显式路径，复用400-12选择/短fd与绑定，不扫描/复制/自动批准。

固定容量：1会话、1选择（含捕获中）、1任务、1最近终态、1最近受理ACK；无队列/无限ID集合。受理时同步预留任务和seq、消费选择，后台实际读/校验/提交，立即ACK仅表示受理。uint64请求高水位/选择代数不转Number；可信sequenceFloor仅设新会话起始拒绝下限，默认0、不做持久恢复。

start闭合body沿拟定protocol/service/reviewer/selection/request seq+id/expected revision/kind。先验证真实会话/实例/shape，再同seq/body去重，之后才busy/unknown/选择检查；同请求重复返回原ACK，不再读/写。同seq异body冲突、旧seq/跳seq/跨scope拒绝。受理前拒绝不消费，受理后CAS/源失败仍消费并保ACK。不同批准新实例/目录恢复原则保持。

定向cancel先同步匹配会话/job_id再调用原owner.cancel，无await；旧终态job取消无操作，过旧未知/跨scope拒绝，不影响新任务。cancel ACK不代表I/O已退出，容量/选择保护等真正退出才释放。断响应/只读卸载不取消任务；显式可信会话撤销/到期、任务截止或controller.close则同步失效/取消并等退出。

## 同步授权检查与持久恢复

原owner新增每任务可选authorizationGate同步Boolean函数，结合400-12选择检查进入任务前、读后、journal原valid及发布前。返回false为授权失效，异常/Promise/非Boolean或回调重入修改失败关闭；无此参数保旧行为。不改journal格式/事务，也不另建reader/去重持久账本。

controller gate核同实例/会话代数、撤销、任务身份、单调时钟及任务/会话截止；timer仅唤醒取消，同步写/fsync后仍直接核时钟。rename前失效保旧档，已进入非抢占提交后跨期限可保新历史但不得current。unknown优先于取消/期限/选择失效，冻结至可信close/reopen，禁止盲重试/清锁。重启不恢复授权/选择/ACK，旧实例请求不能复活；持久SHA不是签名/跨进程整盘防回放。

会话默认5分钟/任务最长30秒/选择最长60秒，均设计上限非实测或硬退出保证；使用注入单调clock和可控timer源，坏/反向/异步clock失败关闭。close幂等，先同步fence，等待捕获与内容hook/真实fd退出，清timer/listener和自有owner。忽略abort的工作不强制接管。控制器防同步重入，测试hook仍仅可信注入。

## 投影/范围

新增纯core白名单controls view，重建安全状态/会话与选择代数/高水位/任务摘要/枚举错误，剥离选择引用、路径/指纹/批准正文、凭证和ACK缓存；与原sourceReview展示分开，无device_evidence。仅内部API，不装配到service/profile/CLI/IPC/代理/UI。页面继续只读，原生picker/可信页面身份及HTTP Origin/授权接入留400-14；源审阅不填设备actual/saved/库存。

## 验证与回退

实际原创28MiB sparse/400-12选择/原owner+journal：真实review/revalidate、双批准与不自授权、单次选择/容量、同请求受理前中后重复与响应丢失、body冲突/旧跳序/u64极值/跨实例会话、任务旧取消/终态幂等、TTL/任务截止/坏clock、门禁在同步提交前后跨期限、异常/异步/重入gate、unknown优先/可信历史重开、坏源/CAS竞争保历史、元数据及内容钩子实际退出和timer回收、白名单/原recipe与旧缺省回归。专项/独立CLI→check（语法）/npm test（含构建）；仅新改动/失败才重跑。

回退：撤可信会话、close控制器并等真实退出，保源与journal；可回400-12内部owner或400-10只读宿主，无格式迁移/配置恢复。已提交不回滚、unknown/残锁不删。下一400-14先Spec/Diff与明确临时宿主方案，再接显式交互profile/IPC/代理/UI，权限未验证不升级生产。固件/真实用途/G0/Flash/TLS时间凭据/资源/G1-G2/24fps仍独立，外部沿400-06快照。

实施核定：选择许可计时包括capture耗时，避免异步就绪后重置延长；controller逻辑任务截止与reader固定30秒墙钟安全超时分开。首次gate失效锁存至任务结束，迟到timer先核自身身份。均已补专项，未扩至400-14或生产入口。
