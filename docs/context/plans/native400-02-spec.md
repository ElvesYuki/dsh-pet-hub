# 400-02 帧窗口执行与完整性 Spec（实现前）

2026-11-02。承接400-01；已读协作/开发/上下文规则及当前摘要。400为主线，旧尺寸仅备份。本轮纯core、原创PET4、虚拟时钟，保持离线，不接设备、不启listener、不改固件/pet/bridge/DSH/插件/运行配置，无提交推送或子智能体。

## 问题与边界

最大文件与压缩窗口分别限5865472B和1048576B。旧schema2/Native360完整encoded模型保持原义；新增独立schema3 **review profile**，不是已签核的hello/wire。显式区分400/466中心33、3×320000 RGB（含前瞻）、160000 history、8000 tile、8064 packed scratch、按实际帧数的头表、增量摘要状态与持久能力null。验证任意连续24帧payload能入窗，不把file小于旧cap等同于窗口适配。按tag处理额外key，42=118/其余241，24fps，不补帧。

400-01负责P/M/N与独立用途批准；新actor构造时复验其元数据，绑定每次action的F/timing。既有session/guard仍负责认证/租约权威；本轮只接受调用者提供的本地期限及单调revision，用不可序列化ticket隔离会话/请求/重读代数，不建立第二套认证、HTTP或持久化。所有API同步，clock与SHA256增量工厂注入；不引入Node/DSH/DOM依赖。

## 完整性选择（离线对照，未共同签核）

- 默认verified-replay：第一遍有界流式解码/CRC及整F、连续index/RGB摘要和extra-key计数全验，通过前不产生可显示帧。额外保留逐帧压缩字节SHA（241×32=7712B最大），第二遍逐帧复核第一遍收据后才可提交；不依赖同路径重读必然不变的假设。全量两遍/额外摘要的成本须交固件评审，不能写成现有ESP实现或免费内存。
- 显式progressive-review：仅离线比较，允许CRC正确帧在整F之前提交，但display_integrity保持pending。末尾F/index/RGB/extra不符即失效源，保留最后画面并标failed；不能宣称恢复旧动画或已verified。该开关不出现在生产装配。
- 两种路径都把decode、全验和首帧提交分开。prepare/submit的opaque frame token才表示本模型的软件刷新提交；不等同实体屏DMA/设备playing证明。保存/库存/Flash能力均不支持，不合成saved/offline_available。

## 执行、时钟与退出

固定ring＋3RGB池＋history/tile/packed缓冲；不保留完整文件。头表有界复制，payload严格连续offset，单次≤32KiB，credit同时受ring空闲及36帧高水位限制。decode每次一帧；默认第一遍无ready帧，播放阶段至多一ready。初始/欠载重填至min(24,remaining)帧再提交。待提交帧不得跳过/覆盖front。

首帧提交才启动播放时间；24fps用整数ceil计算，42末帧117/时长4917ms，其他末帧240/时长10042ms。欠载暂停动画时钟，填充期间保持front；once_hold只在末帧实际提交且时长达到后结束；loop由显式重读开启下一遍，不隐式持有全文件。帧延迟不跳帧、不借延TTL处理。

新会话、较新revision、取消、断线、暂停或期限失效清候选、ready及摘要/收据引用，保留历史front。旧token不能生效；恢复必须新会话/新请求。时钟倒退失败关闭。同步hash依赖重入时保持busy，关闭/失效立即禁止发布，但直到同步调用实际退出才释放buffer引用；不以timer假装中断实际I/O。该模型没有网络/Flash异步gate。

## 验证与验收

新增专用宿主测试与独立临时监督CLI：真实LZ4/XOR/CRC与像素/摘要，超过1MiB的原创241/118帧文件、跨ring wrap、24帧拒绝/36高水位、两种完整性、重读字节变化、短尾/循环/欠载、revision/会话/期限/暂停/关闭与重入。对照既有完整Pet4Decoder像素，不复制上游媒体或使用真实用途批准。检查逻辑typed-array账本；不把JS RSS/GC或注入SHA状态算成ESP硬内存上限。

运行npm run check（语法）和npm test（含构建）、专用CLI，记录实际通过数量/未覆盖项；仅新问题扩大测试。更新当前摘要/C表/下一入口，归档被替代的400-02待实现描述。

## 回退与后续

全部新增显式离线入口，旧调用者/能力/wire/worker/服务无装配变化。回退本轮新增模块/测试/文档及唯一共享PET4 tile导出即可，无数据迁移或外部服务恢复。400-03才冻结新wire/hello/回执/78分页/向量；400-04才装配默认OFF临时链。正式N、真实用途批准、400持久化、G1/G2/TLS/可信时间/24fps/实际退出由固件另交，本轮不读取或操作现场。

## 执行状态

2026-11-02本轮离线范围完成，48专项/独立CLI/check/全套1018通过；实际变化和未覆盖范围见[Diff](native400-02-diff.md)/[报告](../../reports/2026-11-02-native400-02.md)。这里的默认全验重读、schema3及软件提交均是本地review，不替代双方正式合同或固件准入。
