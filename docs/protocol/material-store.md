# 流式素材仓库与后台校验

2026-10-29，显式simulation范围。旧snapshot同步路径及32MiB限制保留；新streaming路径不将整库字节保留内存，解决真实360完整角色库的导入限制。它不是设备Flash仓库、云端上传或LAN服务。

## 启动与状态

原有--materials-dir、--materials-sha256、--material-license参数外，加--material-mode streaming。入口仍为已审核index.json目录，不直接接受固件原manifest；索引格式/许可/SHA规则沿用[导入契约](material-import.md)。不开放网页任意路径、热重导入或新目录上传。默认模式snapshot，默认deviceMode=disabled不创建仓库。

服务先取得用户私有runtime的socket所有权，启动一个Node worker_threads工作线程并返回；它是后台执行线程，不是智能体。主线程提供catalog状态pending/validating/ready/failed、已校验文件/字节/帧数。主线程不接收压缩素材或RGB帧，只接收manifest和进度。完整目录全部验证后才构造新manager并一次性装配；失败保留原manager与偏好，activation失败单独报failed。校验期间可查看状态和管理已有选择，不允许把未发布文件标可播。

## 磁盘和读取边界

私有runtime/material-store/为0700目录。本次作业先写.staging-<随机id>/blobs/<assetSHA256>，每文件0600；逐文件64KiB块读取源并计算SHA、写盘、fsync。文件SHA/长度匹配后，在worker内单独读取该段压缩文件，执行完整PET4/SIM2格式校验；检查全部文件后原子rename为按index SHA命名的版本目录。原始素材和源配置不进入Git。

单文件8MiB，单索引声明的素材总和≤512MiB，≤32变体/每变体≤256动作；不以512MiB作为RAM预算。相同内容可在一个版本内复用blob，跨版本未做去重。已存在版本必须重读/验SHA/CRC，不能盲信缓存；坏blob不自动覆盖。根与文件路径/链接限制同旧导入器，私有store/版本/文件额外检查所有者与权限；不支持同用户恶意并发替换目录树。源目录仍须存在以重核index和路径，暂未实现离开原目录的独立库注册/热恢复。

失败或关闭会终止worker并清理本次staging；已成功发布的版本保留供下次重验，不删除偏好。若关闭恰逢发布完成，可能保留有效但未激活的版本；不得据此恢复控制权。没有全局版本配额/自动GC/目录fsync掉电耐久保证，清理需服务停止后只处理其专用目录。

## 异步播放

同一个worker串行处理prepare/frame/release RPC，最多8个在途请求、2个设备decoder，不缓存全库解码帧。prepare重新读取已校验blob并核SHA/全帧格式，保留该设备的decoder，frame只返回帧号/几何/RGB SHA。工作线程内PET4仍有单段压缩缓冲和当前帧缓冲，绝非零内存或零拷贝；原严格解析器不变。

纯core MaterialPlayback新增verifying/submitting阶段，支持Promise结果。选择revision、会话或意图改变/断连后，旧验证/首帧结果不得提交。失败保留旧actual/选择。异步帧读取只允许每设备一个在途调用；新选择和关停释放旧decoder。虚拟推进接口等待相关模拟回执，但独立status可并发响应；没有将CPU校验耗时折算为硬件帧率。关闭服务拒绝所有未完成RPC并停止线程。

metrics中peak_asset_bytes是最大单段压缩输入，retained_library_bytes=0表示没有全库字节快照，不代表decoder/进程占用为0。worker_heap_bytes/worker_array_buffer_bytes是采样，Node GC和双设备decoder会增加实际峰值，不能承诺总进程≤32MiB。长期RSS/线程资源硬限制及任务超时仍需专项。

## 验证入口和回退

- npm run preview:streaming：原创微型SIM2临时目录，真实worker/IPC/UI；退出删本次临时文件。
- scripts/verify-streaming-pet4.mjs：显式--source-dir、--manifest-sha256、--license-ref dsh-pet-nc-86181ce、--output。本地只读源360库，复制到独立临时目录以组装index，导入完整46动作、验证待机/工作/帧推进与IPC延迟；退出删除测试源副本和仓库。不会调用外部Python/修改固件。
- 回退：停止独立测试服务，只删除其专用store/测试副本，不碰现有配置；小包可切回snapshot，大包不回退为全内存加载。重新启动仍需同一私有runtime和显式源/摘要/许可参数。

后续已实现[仓库生命周期](store-lifecycle.md)：版本登记、默认1GiB全store逻辑配额、预留准入及显式CAS安全清理。上文“未做全局版本配额/孤儿清理”是初期范围，现由该契约更新；仍无自动GC/强制删除/掉电完整事务。

后续[完整角色包激活](role-package.md)增加内部cachedOnly路径：已登记版本可脱离原始目录复验激活/重启恢复，基础导入源规则不变。新角色运行层每设备单独worker，另有一个候选及基础导入，当前最多4个worker；上文同worker两decoder仅描述旧基础路径。关闭操作幂等且共享完成Promise，取消作业等待worker终止/stage清理才结束。

后续[帧预览与资源恢复](frame-preview.md)为worker补上固定验证/RPC期限、请求高水位及统一失败回收；仅显式当前角色预览传单帧RGB565LE，其余路径仍只返回摘要。线程数限制不等同硬RAM限制，有限探针的RSS事实见对应报告。

后续[PET4分配优化](resource-replay.md)复用tile/帧缓冲、单次文件分配，build只保留元数据，prepare保留单动作player；所有文件SHA和逐帧CRC仍验，默认审计摘要不变。约334→231MiB同参RSS样本不等于硬内存上限，旧多日/资源门槛仍需独立验证。
