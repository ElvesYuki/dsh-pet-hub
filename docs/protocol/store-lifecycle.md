# 仓库版本、逻辑配额与安全清理

2026-10-29，simulation/streaming离线管理。实现为runtime/store-lifecycle.mjs；没有自动清理、强制删除或网页任意路径接口。

## 版本登记与兼容

worker验证全部素材后，以0600保存原index.json及version.json（schemaVersion=1、index_sha256、manifests），随后发布版本目录。版本ID是原index摘要；manifest元数据的规范摘要、index原始摘要和blob长度都在列出时核对，但列出不是重新全帧校验。worker重用版本时仍验证文件SHA/格式；旧缓存补登记前须重验，不能盲信目录名。

旧缓存无index/版本描述、描述不一致或有额外/缺失文件时保护为unknown_metadata，不自动删除或修复。读取描述有大小上限；版本目录与blob禁止符号链接，必须属于当前用户且无组/其他用户权限。

## 保护规则

服务扫描所有已持久化的设备选择（含离线、未出现在本次会话的设备），与内存选择取并集；再加material_playback.actual及desired/pending的manifest摘要。只要某版本包含任一引用就保护整个版本。

当前装配版本始终保护，即使尚未选择；活跃校验stage和配额预留也保护。离线保留的最后观测actual仍保护，不能因失联猜测已停止。已知仅内存元数据的内置候选没有磁盘包，不当成磁盘引用；其余引用无法归属时保守保护所有发布版本和trash，避免旧/损坏登记漏删。无引用且安全的孤儿staging可显式清理。

trash保留原版本元数据，崩溃残留仍按原manifest检查引用；元数据不完整的trash不能通过本接口删除。暂未提供解除离线设备选择、强制清除最后观测或强制删除入口。

## 配额

整个私有runtime/material-store按逻辑文件长度计费，包括所有版本、版本元数据、孤儿staging/trash。目录占用、文件系统块开销和跨版本硬链接去重不计；不等同于OS硬配额。默认1GiB，CLI --material-quota-bytes指定1B–8GiB，重启须显式使用相同策略，attach参数不同拒绝；本轮未做运行时配额编辑。

worker复制前先检查整个目录元数据，计算唯一blob字节+index/版本描述，向主线程申请预留。同摘要声明不同长度拒绝。已有缓存只申请缺失描述的增量；超过单目录512MiB仍拒绝。扫描将已落盘stage字节与预留合并，避免重复计费。现有版本、孤儿及其它预留均占额度；失败/取消释放本次预留，不删已有数据。

降低配额可进入over_quota状态，列表和安全清理仍可用，新导入拒绝；不会自动逐出素材。若所有版本均受保护，需先合理调整策略或通过后续设备/选择管理收敛引用，不能绕过保护。

## 审阅与删除协议

GET /v1/materials/versions返回repository：revision、quota_bytes、used_bytes、reserved_bytes、valid、over_quota、entries。每项含entry_id/kind/bytes/characters/manifest_count/protected/reasons；无文件路径、凭据、原始状态响应。全树扫描异步执行，最多128个根条目，每树10000项/4层；超限/链接/特殊文件/权限异常保守拒绝准入和清理。

POST /v1/materials/cleanup只接service_instance_id、expected_revision、entry_ids（1–32个唯一ID）。读取列表即为预览，UI另要求“审阅清理→确认清理”，不自动重试。请求不接受路径或force字段。过期实例/清单/引用409，保护目标409，非法字段/ID400；默认disabled/snapshot模式404且不扫描store。

服务端在同owner互斥区中重扫并比较revision；revision包含树inode/大小/mtime/权限、引用和预留。整个批次先检查保护，混入任何保护目标时尚未开始删除。清理期间拒绝选择/意图/模拟控制写入，配额准入排队；已在途异步播放的目标/actual均纳入保护，后台当前目录另行固定保护。

每项先核对树指纹，rename隔离到随机trash，再核对一次才删除；失败尽量改回原名。多项文件删除不是文件系统事务：后续IO错误可能留下已删除的前项或部分trash，UI要求刷新核对，不声称完整回滚或掉电安全。安全边界不覆盖同用户恶意并发替换目录树；未做openat沙箱/故障注入式掉电恢复。

## 使用与回退

npm run preview:warehouse生成原创SIM2旧版本、当前版本及孤儿暂存，走真实worker/IPC/共享UI；确认后只删本次临时样本。退出删除独立预览目录，不安装插件。其它流式CLI启动仍需显式源目录、摘要和已审核许可引用。

回退先停止独立测试服务，可撤回本轮代码和本轮专用测试目录；被显式清理的无引用文件不可恢复，需从已审核源重新导入。既有选择文件不被清理接口删除，外部素材目录及固件/pet/bridge/DSH配置不属于操作范围。未知/不完整旧缓存保持保护，后续另做人工恢复工具。

后续[完整角色包激活](role-package.md)扩展packages投影与activated引用：仅package_schema=2可显式激活，持久角色指针（包括离线/未知设备）、actual/pending、候选目标均保护版本；候选从准入到worker关闭另持版本pin。清理与激活写入互斥。基础导入目录仍固定保护，不因单设备切换自动卸载。取消候选等待stage清理完成，提交后取消拒绝；回退需显式激活旧版本。
