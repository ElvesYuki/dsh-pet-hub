# L2 分层角色包独立加载

2026-10-30，用户授权继续。结论：**真实纯数据包已能脱离制作目录引用独立加载到可信桌面播放器，并完成首帧切换、失败保留、取消及资源回收。** [Spec/Diff](../context/plans/layered-character-loader-spec.md)、[使用/API](../protocol/layered-character-loader.md)。未接生产仓库、pet、DSH或设备；不修改360人物大小/原点、11动态发束、原46个PET4动作或任何美术字节。

## 实施

- core抽出共享CRC32和严格PNG分块/行滤波还原，Node L1继续使用同一合同。pet4保留crc32兼容导出；原PET4行为不变。
- ui读取目录选择File列表，先限额再读取，验证明确的期望manifest SHA、许可、精确文件集合、全部字节/JSON/profile/PNG。生成HTML无角色数据/PNG/源目录或远程依赖；实际只由选择的package产生快照。
- runtime通用串行候选控制器：selection generation、一个候选＋最新待选意图、取消、迟到结果清理、同步提交、失败旧画面保留。浏览器准备器每张不同PNG只创建一个Bitmap；首帧在离屏root准备后替换，成功后才释放旧角色。
- 原自然预览实现迁入packages/ui供两个入口共享，scripts保留兼容导出。增加root、返回API、预载图片、暂停/关闭和监听/RAF回收；旧制作生成器剥离模块声明后仍内嵌同一实现。

## 证据（本地.cache，不提交素材）

入口：`.cache/layered-character/package-loader-v1/index.html`；实际选择`.cache/layered-character/character-package-export-v1/package`。manifest SHA：`7b872e12706ad7eff261e7bde6c0f878eec9ee0172a7c2ce05b33f4a8415e0f8`；许可ref：`dsh-pet-nc-86181ce`。37个纯数据文件、390634B，21主层、33张PNG，解码RGBA计17107200B；运行器实际创建33个Bitmap，而非逐槽重复解码。

| 检查 | 结果 |
| --- | --- |
| 浏览器实际目录选择 | 成功显示角色，唯一来源为所选包，不回读master/face/raised-arm |
| 四态/触摸/挥手/无音频说话按钮 | 思考基础态、接受触摸1次、挥手active、说话active及speech嘴部所有者均正确 |
| 坏expected SHA / 取消 | 分别failed integrity_failed / cancelled，current仍为同一旧实例且未关闭 |
| 成功重载 | 新首帧切换成功后旧API closed；新实例正常运行 |
| Bitmap资源计数 | 两次加载创建66，替换后关闭33，最终close关闭66/66；不外推为完整GPU/RAM测量 |
| 扫描 | 14段×289=4046采样，24fps/12s虚拟时间，身体内区6133px；全部低覆盖候选0、安全圆外alpha≥16采样0 |
| 浏览器PNG负例 | 合成透明PNG接受，zlib尾部垃圾和超出解压长度均invalid_texture，与Node合同一致 |
| 旧制作入口 | 重新生成legacy内嵌预览并实际打开，wave_speech在1.6s的挥手/嘴部所有者及close正确 |
| v4对照 | scan对象与character-wave-preview-v4/checks.json内scan完整JSON一致，包括逐帧状态、覆盖、边界及结尾求值 |

`scan.json`、`checks.json`、`character.png`保存于入口同目录。截图目视确认仍为当前360正面角色、抬手和嘴型；这不是完整美术验收或全帧逐像素等效证明。浏览器仅通过临时白名单本地HTTP工具页完成验证，工具页本身无fetch依赖；该QA服务完成后停止。连接器禁止file:导航，因此不把生成的离线HTML写成已验证直接双击兼容。

## 测试与后续

新增12项合成测试，覆盖完整File快照/5种PNG滤波/坏CRC/zlib尾部和溢出、路径和配额、外部摘要/许可、读前/读中取消、失败旧实例保留、慢A→待选B→最新C合并、迟到准备/关闭、一次解码多槽复用和首帧失败清理。`npm run check`（.mjs语法）及`npm test`（含构建）全套328项通过，包含其他并行切片；本轮日志见同目录check.log/tests.log。

下一步为L3：重新打开后显式重选包，从idle重建、不恢复旧触摸/挥手/嘴型；在制作源目录不可访问时验证独立性，补充跨实现像素等效和短时资源观测。完整设备承载、音频同步、长时间性能及生产仓库/激活仍未实现。原v4及导出包保持，回退直接关闭新工具并打开原预览。
