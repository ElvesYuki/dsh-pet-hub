# L3 分层角色包宿主验收

2026-10-30。**同一Chromium/Canvas后端的L3验收通过**：真实包逐帧像素、姿态/所有权/时序与冻结v4一致；复制包重开后从idle重建，失败/取消保留旧角色，重复换包和关闭可回收资源。此结论不包含其他浏览器、ESP32、真实音频、生产仓库或长期耐久。[Spec/Diff](../context/plans/layered-character-l3-spec.md)。

当前可用加载页：`.cache/layered-character/l3-verified-loader-v1/index.html`。仍选择原导出`.cache/layered-character/character-package-export-v1/package`；manifest SHA `7b872e12706ad7eff261e7bde6c0f878eec9ee0172a7c2ce05b33f4a8415e0f8`，许可ref `dsh-pet-nc-86181ce`。360大小/原点、21主层/11动态发束、全部图像字节及原46个PET4动作保持。

## 逐帧对照

冻结v4 HTML原始SHA：`74aab80a0e5827df3ada02c0344f793c401214099b214baeaa6ff484e217ecb3`。在QA副本的scan既有getImageData之后插入只读观察回调；不修改两边求值、绘制、素材或时钟。候选仍由目录选择的真实包验证并解码，基线仍为原v4内嵌HTMLImage路径，两边在同一浏览器Canvas后端运行。

| 检查 | 实测 |
| --- | --- |
| 输入脚本 | 原14场景，每场12s×24fps含端点，共4046帧 |
| 像素 | 每帧360×360×4=518400B，每边累计2097446400B逐字节比较，容差0 |
| 差异 | changed_frames=0、changed_pixels=0、max_channel_delta=0 |
| 姿态与所有权/时序 | pose_differences=0、record_differences=0；两边完整scan JSON相同 |
| 身体/安全区 | 同一6133px身体内区掩膜，低覆盖候选0、166.5半径安全圆外采样0 |
| 观察器容量 | 同时最多保留一对帧，15秒缺边期限/中止可清理，不累计像素历史 |

不是用图像摘要或放宽容差代替逐字节比较。此结果证明当前两种装配/解码路径在这一后端一致，不证明不同GPU、浏览器、色彩管理或设备渲染实现等效；也不代替用户对袖口/手形/发际边色等美术自然度的最终确认。

## 重开、隔离与失败

工具只提供五个固定页面/模块路径，无素材、母版或任意目录HTTP端点。先复制出first-package和reopen-package两个独立目录，校验均与原包摘要相同。运行第一次包后只删除本次QA的first-package目录，原导出/master/face/raised-arm未改名或删除。新页面只获得显式选择reopen-package的File列表；加载时拦截并拒绝页面全部网络请求，仍完成校验/解码。浏览器未获得制作目录File句柄，HTML没有制作路径或图片内嵌。这是浏览器能力边界内的隔离，不是声明主机原目录物理不存在或已建立OS沙箱。

离开前触发working、摸头、完成、挥手和说话，1.6s时挥手/说话仍active；离开后旧API closed。新页面初始empty且没有current；显式重选包的返回微任务中首帧为0s/idle、所有弹簧x/v均0、接受触摸0、wave/speech generation均0、三个事件数组为空，无旧事件重播。

真实浏览器另测缺图invalid_reference、坏图integrity_failed、超限resource_limit及重签摘要后的未知profile unsupported_profile；四种失败都保留同一个未关闭的旧角色。在读结算前及第1/5/33张Bitmap返回后取消，也均保留旧角色、回收迟到图像。关闭中的直接scan按约定拒绝natural_preview_closed并释放资源。旧v4手动回退页面可再次显示wave_speech/1.6s，挥手与speech嘴部所有权正常。

## 资源观测与修正

第一轮20次换包＋30041ms墙钟运行，31个1秒间隔样本。每次换包后33张Bitmap，准备新包时峰值66；20次累计创建660、最终关闭660。运行样本均只有1个待执行RAF；暂停后0、关闭后0，DOM Canvas由7降为0。

Chromium CDP强制GC后的JSHeapUsedSize：空页2169732B、活跃3157376B、关闭2903108B；墙钟performance.memory样本约4794699–23759609B。它们是JS堆观测，不含Bitmap/Canvas/GPU全部本机内存；强制GC数据不作为正常帧率或进程RSS。关闭后仍有工具页、选中File、诊断结果和模块对象，不能要求堆回到空页值，更不能据此宣称无长期泄漏。

初版观察器还计入自动化注入的监听，因此总数17→14不作为角色泄漏判断。按角色所有权筛选signal关联的pointerdown/visibilitychange/pagehide及工具页一次性pagehide后，追加20次换包确认：每次活跃监听4、活跃Canvas7、Bitmap33，未随换包增长。加上第1/5/33张取消试验，累计创建699、关闭699，最终Bitmap0/RAF0/Canvas0；剩余1个为工具页pagehide监听，随页面销毁，不是角色监听。观察器只用于QA，不进入生产dist。

本轮发现并修正一个UI问题：扫描中关闭/换包虽已释放资源，但按钮异步处理留下未处理natural_preview_closed。现在仅在实例已关闭且错误正是该结束状态时消费它，其他错误仍抛出；直接scan API的拒绝语义保持。真实按钮“扫描→换包”和“扫描→关闭”复测均无pageerror，旧角色关闭、新角色可用，最终66/66张Bitmap释放。修正不改变求值或像素路径，未重复全帧扫描。

## 文件与复现

忽略目录`.cache/layered-character/l3-verification-v1/`保存：inputs.json、pixels.json（逐帧语义/覆盖和比较摘要，无像素历史）、recovery.json、source-isolation.json、resources.json、failures.json、ui-scan-fix.json、source-bindings.json，以及原/修订工具副本和check.log/tests.log。临时QA服务已停止，自动化观察器所在页面销毁；不提交图片或大证据。

```sh
node scripts/prepare-layered-character-l3.mjs \
  --directory '<已导出package目录>' --manifest-sha256 '<期望SHA>' \
  --artwork-license-ref '<已复核许可ref>' \
  --baseline '<受信任冻结v4 HTML>' --out .cache/layered-character/my-l3-run
node scripts/serve-layered-character-l3.mjs .cache/layered-character/my-l3-run
```

仅第二条命令显式启动临时loopback入口，退出Ctrl-C；没有生产监听、pet/DSH连接或设备操作。目录选择first-package后，在QA页执行`layeredL3.run()`得到逐帧比较和两份scan；其他专项步骤见本报告，资源观察器为simulator内可复用QA函数。baseline会执行代码，只能使用仓库已审的制作HTML，不能当作不受信任角色包输入。

新增6项合成测试，覆盖准确像素比较、会合完整性/顺序/期限/中止、QA插桩漂移拒绝、固定HTTP白名单、证据不覆盖/错误JSON/12MB上限及服务关闭；隔离装配拒绝输入嵌套输出/覆盖，复制后原文件保持。`npm run check`与`npm test`（含构建）全套354项通过，数量含其他并行切片。

L1–L3的当前宿主工具切片完成。下一步若要把分层包接入日常角色管理、独立窗口或PET4/分层主画面选择，先写接入Spec/Diff，定义包类型、单一画面所有权、资源交接、取消/回退和持久确认；本轮未接该生产链路。真机音频、性能预算、跨后端验证和长时耐久继续后续。
