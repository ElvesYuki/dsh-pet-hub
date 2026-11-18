# 离线素材目录导入与模拟播放

2026-10-29。导入器为Node运行层，播放协调器为纯core；两者只在显式simulation和本地导入参数下装配。没有固件/DSH/网络来源接入。

## 信任与范围

操作者提供规范绝对目录（realpath形式）、index.json原始字节SHA256和经过审核的license_ref白名单。目录中的声明不能自我授予许可；SHA256保证与选定快照一致，不提供发布者签名认证。不得从未知目录算摘要后就声称安全/有许可。目录需在导入期间保持只读稳定；不支持同用户恶意并发改写目录树，尚无跨平台openat目录句柄沙箱。

导入器拒绝根或路径上的符号链接、绝对路径、..、反斜杠和特殊文件；不执行任何脚本、不下载URL。index≤256KiB、1–32变体、单素材≤8MiB、累积读取≤32MiB；文件以64KiB块有界读取。它仍将验证后的内容保留在内存，不能直接承载215MiB真实全库。网页不接受文件路径，目录只在启动时导入，失败不覆盖已存偏好。外部目录与许可参数参与同runtime服务的启动一致性检查。

## index.json格式（schemaVersion 1）

外层为schemaVersion、variants数组。每条variant：

- manifest：character_id、variant_id、codec、license_ref、display(width,height,shape,pixel_format)、actions(id,bytes,sha256)。不要传manifest.sha256，导入器计算。
- files：action_id、path的数组；与actions一一对应，路径相对导入目录。额外/重复/缺失动作文件拒绝。

先校验index外部摘要，再严格校验元数据与许可引用，逐动作核对实际长度/SHA256及格式。manifest SHA256对规范化（递归对象键排序、数组保序）的manifest UTF-8 JSON计算，不包含自身sha256、源路径或files。索引原始摘要与manifest规范摘要用途不同。验证完成后只保留元数据与不可由调用方修改的字节快照，readAsset返回副本；之后源目录变化不修改当前快照。重启必须重新导入及验证，旧偏好摘要变化时显示unsupported，不自动换包。

## SIM2限制

初始版本codec为SIM2，后续已加入[严格PET4离线解析](pet4-offline.md)。SIM2定义：恰好18字节，0–3为ASCII SIM2，4–5/6–7为大端uint16宽高，8–11为uint32动作ID，12–15为uint32帧数（必须1），16–17为合成样本。头须与manifest一致。它不是PET4、压缩动画或可展示的真实RGB图像；没有真实动画解码/渲染/FPS验收。原有无字节的PET4元数据候选仍仅规格参考；真实PET4文件可按后续严格契约导入。

## 每设备装配

MaterialPlayback用已保存选择、当前能力与scheduler动作生成设备独立目标，绑定选择revision、manifest摘要、会话和意图revision。只在虚拟时间推进或显式选择/调度事件中工作：accepted后300ms复验完整字节及头，400ms记录模拟首帧；先前actual保留到新首帧。切换选择先废弃旧pending，未知/不兼容/校验失败不回退，断连清pending并保留最后观测；重连重新装配，重启只恢复偏好。验证失败保持failed直到新目标/重连，不每次tick重试。

旧S1/S2四槽actor与新material_playback独立展示：旧actor继续验证控制/动作回归，新字段表示所选导入SIM2变体的合成首帧观察，不伪装成Flash安装或固件回执。控制来源仍为合成状态/手动操作，未读取真实pet。当前8个语义动作ID固定，角色必须包含全部映射；自定义映射/46动作真实包后续单独实现。

## 运行与回退

- `npm run preview:materials`：使用已存在本机DSH的只读React种子，生成原创SIM2临时目录并走真实导入校验；UI选择imported角色，A选native_360/B选native_240，保存后推进虚拟时间。退出删除本轮临时服务/素材/偏好，不安装插件。
- CLI同目录重启测试：原有`--runtime-dir`与`--device-mode simulation`外增加`--materials-dir`（规范目录）、`--materials-sha256`（可信index摘要）、可重复的`--material-license`（审核引用）。三项需一起提供，disabled拒绝导入；不支持热导入或网页路径上传。
- 回退：先关闭独立测试进程，再删除其专用目录或撤回本轮代码。保留需排查的失败偏好文件；不碰现有pet/bridge/DSH配置，不改固件、不烧录。

完整包可显式选择[streaming仓库模式](material-store.md)，使用单库512MiB磁盘限额和后台校验；本文32MiB内存快照约束仍适用于snapshot路径。未开放网页任意目录或热重导入。

完整角色包在保留本索引schemaVersion=1的前提下，新增manifest.package_schema=2、semantics及逐动作fps/frames/loop，严格字段校验和摘要覆盖已接入。详见[完整角色包契约](role-package.md)。旧包仍兼容，新完整包须走独立原子激活，不经旧素材偏好隐式生效。
