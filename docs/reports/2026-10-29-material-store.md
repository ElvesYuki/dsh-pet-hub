# 流式仓库与后台校验离线验证

2026-10-29。先补[Spec](../context/plans/material-store-spec.md)/[Diff](../context/plans/material-store-diff.md)，完成worker仓库构建、内容寻址磁盘存储、后台PET4校验/播放解码与主线程状态/异步回执装配。[协议与运行说明](../protocol/material-store.md)。无子智能体；worker_threads仅为代码执行线程。未接设备/串口、未改固件/pet/bridge/现有DSH配置，无提交推送或素材发布。

## 本仓库回归

npm run check、npm test含候选构建：102/102通过（原93+新增9）。新增覆盖>32MiB原创PET4合成包后台导入/IPC持续响应/双设备装配；关闭取消及staging清理；坏文件不发布且偏好不变；成功缓存重验、坏缓存不覆盖；播放时坏blob不覆盖actual；旧异步验证/首帧在切包/断连后失效；目录ID冲突不激活；关闭拒绝在途RPC；真实插件代理/共享UI进度白名单。snapshot旧行为和默认disabled维持。

## 完整真实360库

只读源native360-production/assets原manifest SHA256：a6a2ddae50a8fe4ddf15ff07a3a228dccf865bb91a037693ce0a72232204c39e。许可仍为上轮核对的dsh-pet非商用与CC BY-NC-SA边界。探针将原文件复制到独立临时目录组装受摘要约束的index，没有在外部目录写任何文件。

| 项目 | 本机观测 |
| --- | --- |
| 完整库导入 | 46动作，225509627B，11086帧全帧校验通过 |
| 导入及播放探针总耗时 | 约9266ms（含后续待机/工作验证，非纯导入时长） |
| 导入期间status请求 | 779次，其中778次返回尚未就绪状态 |
| status最大单次延迟 | 约6.60ms，仅本次本机观测 |
| 播放解码同时读取status | 约0.92ms |
| 最大单段压缩输入 | 5742845B，无整库字节Map |
| 主线程heap采样 | 8562944B→12947224B，含探针/JSON轮询分配，非峰值 |
| worker最终采样 | heap 6217912B、arrayBuffers 41333478B，活跃decoder 1 |
| 实际播放装配 | 使用正常8语义动作要求的完整角色，A原生360待机首帧、推进100ms到frame2、手动工作动作11均通过 |

数据.cache/pet4-audit/streaming-real360.json仅含摘要/状态/测量。本次完整目录已越过旧32MiB快照限制，但并未承诺进程总RAM≤32MiB；worker有单段压缩缓冲、帧缓冲及GC滞留。首次真实探针的工作请求复用了控制请求ID，被现有幂等校验正确拒绝；修正探针ID后重跑完整流程通过。源码未放宽幂等约束。

测试成功后worker/IPC关闭，全部临时源副本、CAS仓库和runtime删除。报告保留，不保留新复制的大动画文件；既有前轮忽略目录的两待机样本未动。所有源资产仍受原素材许可，未将动画纳入MIT或发布。

## 浏览器与边界

npm run preview:streaming真实dist/React/插件代理/worker链路：显示仓库ready与16文件进度，A选择SIM2 360、B选择240，虚拟推进后各自模拟首帧通过；控制台0错误/0警告。截图.playwright-mcp/material-streaming.png已目视检查。标签已关闭、预览服务及临时目录已清理。浏览器这次用的是原创SIM2，不把它冒充真实动画画布；真实360包由上述IPC探针验证。

未覆盖：浏览器动画渲染、Flash安装/掉电恢复、真实设备协议/认证/BLE、跨平台、全局磁盘GC/版本配额、崩溃遗留staging自动回收、并发恶意同用户替换、长期内存压力及任务硬超时。播放worker目前最多两设备，不能外推多实物容量。源目录仍需保留，尚无独立库注册/热导入。

下一入口：仓库版本/配额与孤儿清理Spec/Diff、角色包timing/semantics契约与帧预览；继续补Flash激活模型、v5/认证负例。真实集成仍先准备具体方案与回退步骤。
