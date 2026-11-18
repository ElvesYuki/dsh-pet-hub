# 离线帧预览、期限与资源恢复验证

2026-10-29。先补[Spec](../context/plans/frame-preview-spec.md)/[Diff](../context/plans/frame-preview-diff.md)，实现[帧预览与恢复契约](../protocol/frame-preview.md)。继续仅simulation/streaming，无实体设备连接、烧录、插件安装或提交推送；固件/pet/桥接/现有DSH配置未改。

## 完成项

当前actual的PET4 RGB565LE单帧已通过worker独立ArrayBuffer、鉴权IPC、同源代理送达共享画布。接口绑定实例、激活/意图revision、动作/帧/摘要，只允许当前已确认角色；尺寸/长度/SHA复核，同设备背压和迟到结果检查。只有此固定响应路径可到384KiB，status及其他接口仍64KiB；像素不进入status/日志/持久指针。

画布显式开启，原尺寸居中并按圆屏裁切；42ms虚拟单步会更新画面。关闭、卸载或版本/意图变化会取消读取并清空，重挂载仍需开启。SIM2没有像素，不生成假角色图。预览仍是虚拟时钟单帧检查，没有墙钟动画调度或24FPS真机性能结论。

store增加120秒完整校验/2秒RPC期限、8请求上限、失败终止与共用收尾Promise；晚到消息不能重新启用失败worker。角色状态投影有界资源指标；新增显式重验恢复已确认缓存，离线/健康/过期请求拒绝，坏缓存保留不覆盖，恢复回auto且不改变激活revision。

修复服务内重激活/恢复的意图revision归零风险，使用旧值+1，先计算后写指针；旧手动请求不能控制替换后的actor。核心仍不依赖DOM或DSH，画布只在共享UI层。

## 宿主与故障用例

npm run check与npm test（先构建候选）通过：137项，无失败/取消/跳过。较上一轮新增12项，另更新S2窗口验收。

| 验证 | 结果与边界 |
| --- | --- |
| 验证期超时 | 可控worker/定时器注入，ready拒绝、仅终止一次、无stage/预留，晚到ready/progress无效 |
| RPC背压/超时 | 第9个拒绝；期限同时拒绝8个在途，高水位8，晚到reply无效、定时器清空 |
| worker错误/意外退出 | 拒绝请求并清理；另真实终止Node worker，保持指针/actual、B仍可读，显式retry恢复A |
| RGB565与画布 | 红绿蓝小端转换、拒绝超大像素、466/360偏移53和圆裁切 |
| 像素读取 | 实际PET4解码SHA一致，A360/B240独立，同设备第二请求busy；断连/替换后迟到结果丢弃 |
| 恢复 | 损坏blob不覆盖、不改指针；测试显式还原原文件后retry成功；离线启动失败，重连后显式retry保持revision |
| 有限重复 | 宿主用例6次替换/30次像素，角色worker保持2，关闭归零，无stage |
| 代理与预算 | 全360像素超过64KiB但低于384KiB可传；旧实例/revision、额外路径、跨源或缺header请求拒绝；损坏后经同源retry恢复auto且确认revision不变 |
| UI清理 | 请求取消和画布清空；真实浏览器关闭预览/卸载/重挂载验证 |
| 合成去重窗口 | >128次仍推进，窗口内重放/参数冲突、淘汰后的控制和手动意图重试受CAS拒绝 |

超时注入并非等待真实120秒，也不是断电/磁盘硬故障；真实worker终止与恢复另独立覆盖。

## 扩大压力探针与发现

scripts/stress-role-resources.mjs使用原创MIT几何PET4两规格13帧，以独立临时目录运行。首次在第129次合成控制请求处失败，发现原session的128条终生硬上限；先追加Spec/Diff，再改为最近128条FIFO。淘汰后的手动意图在进入旧scheduler缓存前也须检查当前意图revision，防止旧缓存命中再次dispatch。该窗口只用于合成适配层，旧core设备命令/操作/触摸的容量策略未改变。

修复后完成50次角色替换、500次取像素和虚拟推进：

- worker峰值4（包含基础导入、A/B角色、候选），每轮稳定3，退出0；无本次stage残留。
- 本轮串行读帧RPC高水位1，最终无在途；合成请求缓存entries=128/limit=128。
- 进程RSS采样峰值361840640B，约345.1MiB。记录实际值，不将有界worker数量当成硬RAM预算，也不声称泄漏已在多日运行中排除。后续需分析并优化候选全量复验、线程/V8/缓冲的峰值及内存归还。

原始忽略目录报告.cache/pet4-audit/frame-resource-stress.json。探针结束清理所有服务、worker、临时源副本和CAS；未从外部导入代码或素材。

## 真实PET4离线复验

沿用[既有来源与许可核对](2026-10-29-pet4-offline.md)：dsh-pet-nc-86181ce非商用/形象CC BY-NC-SA，原manifest摘要a6a2ddae50a8fe4ddf15ff07a3a228dccf865bb91a037693ce0a72232204c39e。只读外部缓存并复制到临时目录，不执行外部Python、不改源。原46动作225509627B/11086帧再次完整校验通过。

扩展verify-role-pet4.mjs读取当前360待机frame2，返回259200B RGB565，SHA为9a3c519ff2662ccbd5bb7ba5888a3ea8f31e9c471a2edb7e7459ae36d124cfa6，与actual一致；成功保持/触摸转待机/取消/保护回归通过。循环规则仍是本地测试策略，不扩大为上游固件默认规则。本机1632次status最大约8.13ms，非性能承诺。

诊断报告.cache/pet4-audit/frame-real360.json只保存帧元数据/摘要，不保存base64像素正文。临时素材副本和CAS已清理，动画不进入Git；本轮浏览器只显示原创几何fixture。

## 浏览器验证与回退

npm run preview:frames启动独立临时loopback服务，使用实际dist React组件和插件代理。A466画布+360素材偏移53、B240画布均显示彩色PET4；像素探针确认圆外alpha0、A留边色(17,24,39)、红圆(255,0,0)。42ms后actual/caption为frame1且canvas内容改变。关闭A预览移除画布，卸载移除全部，重新挂载预览默认关闭。截图.playwright-mcp/frame-preview.png已查看，处于忽略目录。

控制台0错误、1条Canvas2D多次getImageData性能提示，来自本轮读取画布像素的测试探针；应用渲染使用putImageData/drawImage，没有该读回循环。浏览器和预览服务已关闭、临时目录清理。回退只需停止这些独立进程并撤回本轮代码；已有确认文件/坏缓存保留诊断，真实配置无回退操作。

## 未覆盖与下一入口

下一步先补内存峰值/缓存复验成本优化、核心命令去重回收与可控时钟耐久Spec/Diff。当前只有有限循环，尚无多日RSS、硬内存包络、OS阻塞I/O强制期限或跨平台恢复验收；旧core Scheduler/DeviceModel的256项容量仍会限制长时间反复手动/触摸/命令场景。帧预览也没有墙钟连续播放、真实设备回传、Flash/断电事务或真实pet联动。

保持设备接入门槛：v5迁移、认证/TLS资源测量及任何真实集成须另备具体方案与回退步骤。
