# 墙钟内存测量入口与范围

2026-10-30。测量脚本scripts/measure-wall-memory.mjs，库入口packages/simulator/wall-memory.mjs；不由插件或默认服务自动启动。需显式新输出目录：

```sh
node scripts/measure-wall-memory.mjs --output .cache/wall-memory/<new-run>
```

默认1800秒；--seconds 2至1799仅为smoke，报告不能标成30分钟。计时从临时服务完成导入并激活A360/B240后开始，以performance单调墙钟为准；合成设备时钟每秒推进1000ms只是负载。代码为独立新Node进程，创建私有临时目录、原创MIT几何PET4（两规格各3动作13帧）、streaming服务和真实鉴权UDS；没有公网、现有DSH/pet或实体设备。

每秒串行状态/推进/交替设备当前帧/SHA核对，每30秒交替设备激活同一已登记版本；不排队积累控制操作，候选期间跳过相应设备帧并计数。候选超过120秒、任意普通IPC/校验失败、worker>4或每worker在途>8、RSS>768MiB则失败收尾。768MiB为本探针保护阈值，不是产品预算。正常完成还要求实测≥1800秒、最大采样间隔≤5秒且候选已结束。--seconds缩短模式使用同逻辑但单独标记smoke。

输出samples.ndjson只含有限数值指标，report.json含汇总/操作次数/cleanup/源码SHA及Node版本；没有token、socket路径、原始状态、像素正文或真实来源响应。RSS覆盖服务+driver+所有worker，heap/main_array_buffer_bytes只反映主线程。角色resources新增worker_heap_bytes/worker_array_buffer_bytes投影，worker_buffer_latest_sum/heap_sum汇总各线程最近回包采样，非同时精确峰值。候选提交后的task与active actor不重复计worker。每秒在途样本不等于RPC从未发生；响应后采样可能为0。

汇总提供初始/峰值/末值、最后10分钟线性斜率与均值/范围、五分钟分段及采样间隔。样本数组最多1801条，指标记录自身占用也在RSS内。没有强制GC；不能用斜率自动裁定泄漏，也不将单轮结果推导为硬内存、真实24FPS、完整46动作、UI共存或多日耐久。

被测依赖文件前后SHA核对，不一致则整轮不通过。SIGINT/SIGTERM和期限保护会取消等待并走同一finally：关闭共享服务、等worker终止、删除本次temp，核对MessagePort数量回到基线，记录收尾RSS。失败不自动重启长测，不删除用户绑定/确认指针/缓存。

实施与保护条件见[Spec](../context/plans/wall-memory-spec.md)/[Diff](../context/plans/wall-memory-diff.md)。实际执行结果另写报告，不从smoke或虚拟时间推导已完成1800秒。
