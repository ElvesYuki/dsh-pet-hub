# A1 schema2资源执行模型 Spec（实现前）

状态：已按实现前记录完成纯core切片，见[35专项/434全套报告](../../reports/2026-10-30-round-pet-a1.md)与[活动API](../../protocol/round-pet-a1.md)。仅资源模型，不关闭联合G0或设备准入。

2026-10-30。用户在G0交付后授权实施，本轮选择上一轮明确的A1入口；只做纯core＋原创模拟介质/虚拟输入/现有宿主回归。已读AGENTS、README、当前上下文、G0 Spec/Diff/交接及实际DeviceModel/protocol。保留已有修改，不使用子智能体；不接设备、不改固件/pet/bridge/DSH配置，不开listener、安装、烧录或提交推送。零新依赖，新增代码MIT。

## 范围与实现选择

新增独立Native360DeviceModel及Native360FlashModel，不改旧DeviceModel/schema1行为，不假借四RAM槽模拟schema2。新入口显式接受G0的schema2固定能力与原生360 profile，区分单encoded工作集、Flash4活跃＋1暂存、有效root、退休对象和read lease。现有runtime、UI和mTLS会话不装配它；G0共同wire、A2导入/P/M批准、A3实体观察和A4承载仍未完成。

该actor是**资源执行参考模型**，不是第二套设备认证/租约/会话实现。只接收受信宿主调用、严格目标和本地opaque工作/帧票据；revision高水位与局部generation拒绝旧完成，reboot作资源代数失效。未来A3/A4须在它之前验证完整身份/控制权。当前指纹/日期/CAS/会话优化复用现有能力，不重写。

固定参数：466²物理屏、360²PET4/24fps/241帧/flag1/key12/tile20、center(53,53)；encoded/payload≤5865472B；4活跃引用＋1暂存、stride0x599000/28MiB逻辑布局；namespace沿用dfc829e13e7c25d732ae0c0afd011f1232419e603ba06c225104645ea668bdf6。46个原编号描述及0/4等基础语义动作必须存在；测试ID集合和文件均原创，真实集合批准仍等A2/C02。模型profile只能证明逻辑兼容，不冻结尚未共同确认的wire字段。

## Flash模型与故障语义

介质是注入的同步内部接口，提供双root、五对象、payload分段、对象头/根发布、claim/release与可控故障；核心无Node/DOM、文件/串口/网络。新增模拟介质仅内存持久于对象生命期，不实现/写入真实V2二进制或CRC布局，不复制固件代码。构造显式create仅允许全部擦空；普通恢复不格式化、不清坏根。

root引用slot＋uint64 generation；对象身份N/id/F/bytes＋固定validator版本，metadata验证、文件身份和注入验证器通过后才可恢复。最高有效root优先，损坏候选可回退有完整对象的旧根，同序列冲突拒绝；I/O错误不能当坏根偷偷回退。EMPTY只允许先0，再4形成OFFLINE_READY；0/4禁止被其他动作淘汰。相同ID更新可保留旧物理对象到新root提交，并受其read lease保护。恢复后的Flash不因RAM/reboot而清空。

一次暂存、一次根提交；准备先撤回将被擦对象相关的恢复root，再复用未被当前root/lease引用的对象。写入按≤4096B，完整校验成功再提交对象头和新root；残留对象头不是离线库存。提交前取消保留当前root；root发布后异常记storage_commit_unknown、库存当前性unknown、停止新写，恢复并核对根后才能确认事实，不盲重试。逻辑prepare不模拟1433次物理扇区耗时；不声称物理掉电/磨损或NVS耐久已验。

read lease绑定slot/generation/完整文件身份，最多8条；复制/伪造票据或关闭/重启后的票据拒绝。不能擦除仍被读的对象；同ID替换后旧对象可继续被旧lease读，但已不属于当前inventory，下一次暂存若只剩被pin对象则cache_busy。整个介质只允许一个模型owner，close释放owner而不删持久内容。

## 单RAM、首帧与维护

request仅更新desired，本地accepted不作为网络设备回执。load开始冻结/保留最后画面，旧工作票据失效；下载覆盖时先放弃旧encoded，再接唯一候选，验证未通过不能播放或保存。默认验证回调拒绝；验证器是受信内部依赖，须返回与N/id/F/bytes及生产媒体约束匹配的细节；不能接受外部verified布尔当凭据。实际SHA/全帧CRC由已有运行层/解码器或测试验证器完成，core不引入Node crypto。

cached一般动作装入唯一RAM；cached挥手4可持Flash stream lease而不再分配第二份encoded，保留已有base RAM。root恢复已完整验证的stream不冒充下载新文件。A1仅模拟资源和显式首帧事件，不实现RTOS解码、真实本地触摸寿命或面板刷新。

prepareFrame产生单个当前帧opaque票据；submitFrame只能消费该票据。load/save/cancel/reboot/新目标使旧票据无效，防止freeze前的迟到刷新结束维护。playing/actual只在显式提交后更新，首帧时间不被重复提交重置。save期间held_last_valid；提交成功也不自动恢复动画，需新的帧票据。历史actual与当前display_state分开，不承诺旧动画持续播放。

save只针对已验证的当前工作集，提供begin/write/commit/cancel边界；saved历史证据与当前inventory分开。未缓存/验证失败/部分写入/未提交均不离线可用。新目标不得取消已经发生的保存事实；reboot清RAM/瞬态票据、恢复有效root，不能自动报首帧已播。close清本地资源，无后台任务或句柄遗留。

## 验证、验收和回退

专项逐项覆盖固定能力/几何/媒体详情/长度边界、单RAM覆盖与验证失败、4活跃＋1暂存、保护0/4、1/11替换、read lease/pin/代数、root发布前后故障、残留对象、相同序列冲突/溢出、reboot/close/单owner、opaque工作/帧旧结果及维护冻结。测试使用原创合成字节及明确的验证hook，另以原创241帧PET4接已有严格验证器证明真实字节路径，不能把合成hook通过称实物/PET4全库通过。

保留旧schema1测试（含明确拒绝schema2的旧入口），新增独立schema2入口测试；运行npm run check、npm test含候选构建。新model不接UI/status/真实listener，没有新wire通过结论；A1不能关闭G0/G1/G2。未实现的SD-07–12身份适配、SD-19–48实体状态/触摸/调度等不标通过。

回退关闭本轮模型/模拟介质owner，删专用临时证据即可；RAM模拟介质由测试释放，不碰实体Flash、角色指针、绑定文件、运行服务或固件回退物。完成后更新当前摘要、差异表、待办和主题历史，保留已有399项/scoped结论。
