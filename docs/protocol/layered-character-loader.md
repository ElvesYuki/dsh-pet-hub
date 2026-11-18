# 分层角色包独立加载（L2）

2026-10-30已实现桌面制作工具，不挂载生产service/角色仓库，不连接pet、DSH或设备。数据格式仍为[dsh-layered-character/1](layered-character-package.md)。

## 使用

```sh
node scripts/prepare-layered-character-loader.mjs \
  --out .cache/layered-character/my-package-loader \
  --expected-manifest-sha256 '<制作回执的manifest_sha256>' \
  --artwork-license-ref '<已复核的素材许可ref>'
```

输出必须为.cache内不存在的新目录，拒绝符号链接祖先和覆盖。后两项可省略，打开后手动输入。HTML内置本仓库可信ES模块/importmap，不内嵌角色图片、包数据或制作源路径；没有远程依赖。用现代浏览器打开index.html，选择导出外壳里的**package文件夹**；不要选择含receipt的上一层。期望摘要和许可ref来自调用方，不从包内自授信任。回执状态exported_validated_not_loaded保留其导出阶段含义，不会因预览被改写。

需要目录File选择、WebCrypto、DecompressionStream('deflate')、ImageBitmap、Canvas和importmap。缺能力会明确失败。当前浏览器验证使用临时本地HTTP页面；自动化连接器禁止file:导航，直接双击的file:入口尚未独立实测。浏览器目录选择的文件快照不提供Node目录审计的符号链接祖先证明，不宣称是敌对文件系统沙箱。

## 边界与API

- `ui/readLayeredFiles({files,expectedManifestSha256,allowedArtworkLicenses},signal?)`：明确的File列表（webkitRelativePath共享一个根）；拒绝多根、重名、缺文件、额外文件、路径跳转及超限文件，在分配前检查File.size。严格UTF-8/JSON、字段、全部SHA、rig/face/wave/profile/许可及完整PNG CRC/zlib/行滤波复验后，返回私有字节快照。`snapshot.close()`清除PNG Map；不激活角色。
- `core/layered-character-png`共享PNG分块与行还原，Node使用有界inflateSync，浏览器流式解压并限制输出518760B，拒绝尾部压缩垃圾。无以原生显示成功替代完整验证的路径。
- `ui/prepareLayeredCandidate(snapshot,{signal,createRoot,startPreview,decode?})`：每个不同PNG只解码一个360×360 Bitmap；复用到21主层/脸槽/挥手图。现有自然预览迁到ui，scripts兼容入口与旧生成器继续可用。离屏首帧/对照帧准备完毕才返回候选；失败/取消关闭已解码和迟到Bitmap。
- `runtime/createLayeredCharacterLoader({readSnapshot,prepare,commit,onStatus?})`：不依赖DOM/文件系统/DSH。`load(input)`立即递增generation，取消旧候选，合并为一个最新待选意图。最多一个活跃角色、一个正在读/准备的候选及一个不分配图片的待选意图。旧候选结算清理后才开始最新候选。
- `commit(candidate,old)`为可信同步事务适配：首帧已完成，先启动候选再同步replaceChildren，禁止清空旧画面后等待。commit抛错则释放候选、保留current；commit自身须保证失败前未改变外部实际状态。成功后才关闭旧角色。
- `load`返回ready/cancelled/failed/closed，失败携带逻辑error；选择/取消/关闭后的旧结果不得提交。`cancel()`等待当前不可硬中断的File读/解码结算并回收，保留旧角色；`close()`幂等，取消并回收候选、当前角色、RAF/监听与Bitmap。不把发出abort当作I/O已回收。

页面提供选择、重新加载、取消和原有四态/触摸/挥手/无音频嘴型控件。后续[高分屏显示](../reports/2026-10-30-character-hidpi.md)加入原尺寸/2倍与平滑/像素检查；可见背缓冲按DPR分配并限制至1440，默认CSS仍360。snapshot/scan继续使用独立规范360画布。角色API的display()返回只读显示尺寸，setDisplay({zoom:1|2,mode:"smooth"|"pixels"})只重绘，不重置时间线；关闭时移除DPR/resize监听。诊断入口`window.layeredPackagePreview`可读status/current及调用loadFiles/cancel/close，仅此制作页可用，不是生产IPC或包内脚本接口。

## 验证范围

见[本轮报告](../reports/2026-10-30-layered-character-loader.md)。真实包独立播放、坏摘要/取消保留、成功换包、Bitmap关闭及14段4046次扫描已验证。24fps仍是桌面采样目标，未测ESP32性能；后续[L3宿主验收](../reports/2026-10-30-layered-character-l3.md)已完成同Chromium/Canvas逐帧像素、复制包重开/原临时包移除、20次换包及30秒墙钟资源观测；未声明主机制作目录物理移除。生产接入、其他后端/浏览器、长时资源与设备运行仍待实施/验证。
