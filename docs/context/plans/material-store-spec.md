# 流式素材仓库与后台校验 Spec（实现前）

2026-10-29。新增显式materialImport.mode=streaming（CLI --material-mode streaming），保留旧snapshot API及32MiB上限作回归；默认disabled不创建仓库。单实例owner取得UDS后启动专用worker_threads工作线程，主线程立即提供IPC与catalog pending/progress/ready/failed状态，不把线程称为子智能体。

输入仍为CLI固定目录/index SHA/许可白名单，页面不接受路径。worker逐文件64KiB块读、SHA校核并复制到本仓库私有runtime/material-store/.staging-<随机id>/blobs/<sha>，单文件8MiB、目录512MiB，最多32变体/每变体256动作。每次只全帧解析一段压缩素材，不保留全库字节。所有文件通过后原子发布按index SHA命名的目录；已存在版本重新验证，不盲信缓存或覆盖。失败/关闭终止worker并清本次staging；不删除已有成功仓库/偏好，不做自动全局GC/断电耐久承诺。

主线程只保存已验证manifest、进度与磁盘句柄引用，不传输原始素材/RGB或源路径到IPC。成功后一次性装配完整目录及原偏好，失败保留原manager/选择。进度只计已通过文件/字节。关停取消后台任务与所有RPC，不留悬空Promise；不自动监听LAN/连接设备。

播放prepare/解码也走同一个worker串行RPC；worker最多保留两设备decoder，按设备替换/断连释放，不按全库无限缓存。每次准备重读/核SHA/格式；当前帧仅回传帧号/几何/RGB SHA，CRC仍由严格PET4解析器执行。主线程协调器支持异步验证/首帧，代数变化后旧Promise不能提交；虚拟推进请求等待相关模拟回执，但并行status请求可响应。原同步SIM2/snapshot回归保持。

验收：合成>32MiB目录后台导入/IPC连续可读；源变更/坏帧/许可/路径失败无发布；已有成功仓库篡改拒绝；关闭取消清staging；双设备解码/旧任务隔离；错误不覆盖偏好或actual；真实360完整46动作225509627B及八语义动作导入可选并播放，记录worker压缩峰值/主线程IPC延迟而非宣称RSS硬上限。新数据只写独立临时/忽略目录，不改固件、pet、bridge、现有DSH配置，无提交推送。

回退：停本轮独立服务；可删除本轮专用runtime/material-store与临时素材，不触碰原偏好/其它服务；snapshot模式可继续用于小包，完整360不退回有问题的全内存装载。源码/动画许可沿用上轮核对的非商用/CC BY-NC-SA边界。
