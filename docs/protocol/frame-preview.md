# 离线当前帧、worker期限与显式恢复

2026-10-29，仅simulation/streaming。延续[角色包激活](role-package.md)，先建立[Spec](../context/plans/frame-preview-spec.md)和[Diff](../context/plans/frame-preview-diff.md)。像素不代表实体设备回传，虚拟推进不是实时帧率验收。

## 当前帧接口

鉴权POST /v1/roles/frame使用以下JSON字段，全部必填且拒绝额外字段：

| 字段 | 含义 |
| --- | --- |
| service_instance_id、device_id | 当前服务和已激活设备 |
| expected_revision | 已确认激活revision |
| expected_intent_revision | 当前设备意图revision |
| action_id、frame_index | 当前actual的动作和已解码帧 |
| rgb565_sha256 | 当前actual像素摘要 |

只读取已激活PET4当前帧，不接受文件路径、其他版本或任意帧索引。SIM2无像素，返回pixels_unavailable。角色尚未激活、非法字段或不支持格式拒绝；实例过期、revision/帧/事件变化或同设备读取正忙返回409。RPC/worker不可用可能返回操作错误，客户端检查角色资源状态后显式恢复，不自动重复请求。

响应frame含device_id、activation_revision、intent_revision、action_id、frame_index、rgb565_sha256、width、height、format=RGB565LE、pixels_base64。尺寸支持240/360及显式批准的400候选方形，最大320000像素字节；RGB565小端，逐像素扩展为8位RGBA。worker只转移独立当前帧ArrayBuffer，主线程复核长度和SHA后编码base64，不传整个素材。status继续仅含摘要，不夹带像素。

仅固定POST /v1/roles/frame的IPC响应预算为512KiB，其余仍64KiB；请求体仍4KiB。插件仅通过原同源JSON/Header保护的白名单转发，回包不含服务凭据、目录路径或instance描述。每设备最多一个像素读取，不排队；准备动作时也可返回busy。返回前重核actor身份、设备会话、在线状态、意图、来源事件及actual，旧异步结果丢弃。HTTP取消会终止客户端请求，worker已收到的短任务仍可能继续到完成/期限，不宣称原生中断单帧解码。

## 画布生命周期

共享界面每设备显式开启“显示离线帧预览”，仅当前帧变化时拉取；关闭、卸载、服务/版本/意图/在线状态变化取消请求、清空画布。只保留一帧，无录屏、帧队列或历史像素。重挂载默认关闭。当前支持设备画布≤1024×1024，在屏幕原尺寸中居中不缩放素材，圆屏裁切；466屏/360素材偏移53，400候选偏移33，浏览器以最大240 CSS像素缩放显示。

时间仍由模拟控制推进，新增42ms单步按钮，只近似24fps的一帧时间；不会播放墙钟动画或自动发控制请求。SIM2显示无可预览帧，不能冒充实际角色。角色与旧参考动作通道继续分开。

## worker资源与故障

后台store默认完整校验期限120000ms（固定总期限，不因进度延长），单次prepare/frame/pixels/release RPC期限2000ms；同时在途最多8个，超额直接store_busy。过期将worker标failed、拒绝ready和所有在途RPC、终止worker，再清理本次stage、预留和版本pin。失败、主动关闭、重复关闭共享同一个收尾Promise；失败后晚到的ready/progress/reply不恢复状态。定时器在ready/reply/收尾时移除，错误/意外退出同样回收。依赖宿主事件循环/OS文件系统，非硬实时、强制内存限制或目录掉电事务。

角色/任务resources只投影worker_alive、pending_requests、max_pending_requests、timeouts、decoder_count、error；不含逐帧日志、路径或像素。角色store失败显示failed并保留最后actual和确认指针；不会在每tick反复向已失败worker发送请求。候选失败不替换旧角色。普通单帧格式错误可能仅令角色failed，不一定使整个worker退出。

最多仍基础导入+两设备角色+单候选4个worker，worker内部压缩段/解码history/当前帧、主线程及浏览器base64/RGBA都有瞬态开销，不能等同32MiB整库快照预算。有限探针的实际RSS见报告，长时间峰值和碎片尚待专项。

## 确认版本重验恢复

POST /v1/roles/retry只接service_instance_id、device_id、expected_revision。需要已有确认记录、设备在线且角色failed或尚不可用；健康角色返回recovery_not_needed，旧revision/忙状态拒绝。后台复用已确认CAS版本/角色/变体，重新全量核验许可、摘要、能力和首帧，成功恢复auto；激活revision不变，不重写指针或重放旧手动动作。损坏blob、元数据或许可不合规仍失败，不自动修复/覆盖/选择别包。

重激活/恢复替换已有actor时，先计算新意图revision=旧值+1，再持久提交或切换，防止服务内旧意图CAS因归零被再次接受。没有actor时从0开始；重启的旧客户端另受服务实例ID隔离。离线启动恢复失败后，重连再显式retry可以恢复；无后台自动重试。

## 合成控制去重窗口

本轮有限压力发现原simulation会话终生128请求硬上限。仅此仓库模拟适配层改为最近128个成功请求结果FIFO，内部统计entries/limit供探针检查。窗口内重复返回原结果、同ID不同输入拒绝；淘汰后的控制请求必须重新过全局revision CAS，旧手动意图必须在进入scheduler缓存前先过当前设备意图CAS，因此不能重放旧动作或再次推进时间。客户端须使用唯一ID，窗口外不承诺永久识别“旧ID配新revision”的请求。

旧core IntentScheduler的256请求/触摸事件、DeviceModel的命令/操作等容量策略本轮未改；这些仍是后续协议回收评审入口。不得用模拟窗口替代设备端持久去重或exactly-once保证。

## 执行与回退

- npm run preview:frames：使用原创MIT几何PET4两规格/两版本，独立临时runtime与loopback管理页面；只读本机React种子，不安装插件。关闭浏览器、Ctrl-C退出服务并删除本次临时目录。
- node scripts/stress-role-resources.mjs --output <忽略目录报告>：50次替换/500次像素读取、500次虚拟推进，检查worker≤4/关闭归零、无stage、RPC与缓存有界；非多日耐久测试。
- scripts/verify-role-pet4.mjs：沿用显式可信源/摘要/许可，另验证真实360当前帧像素与摘要；仅临时副本，不把像素正文写入报告。

回退停止本轮独立测试进程并撤回本轮代码；保留需要诊断的确认指针和缓存，已确认旧包可显式再激活。真实设备、固件、DSH、pet、桥接和现有配置都未纳入本轮写入范围。

后续[核心回执与分配契约](resource-replay.md)已解除命令/意图/acquire的终生容量限制并提供有序触摸窗口；本页“旧core容量另评审”更新到已实现上述切片，无seq旧触摸仍封顶。像素接口不变，输出继续为独立可转移缓冲。

400候选的profile批准、512KiB完整JSON预算和角色恢复验证见[400 M2](../reports/2026-10-30-native400-m2.md)；旧384KiB是400接入前的历史预算。400需要显式manifest及服务端批准，不能仅凭UI能画400就绕过导入。
