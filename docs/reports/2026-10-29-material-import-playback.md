# 素材导入与每设备播放装配验证

2026-10-29。先写[Spec](../context/plans/material-import-playback-spec.md)/[Diff](../context/plans/material-import-playback-diff.md)，完成Node只读目录导入器、纯core MaterialPlayback、模拟会话/CLI/多角色候选/状态与UI装配；[格式与使用](../protocol/material-import.md)。无子智能体、无提交推送，无真实设备、固件读写、pet/bridge/现有DSH配置改动。

npm run check、npm test（含dist候选构建）88/88通过；原79回归保留，新增9项：固定index摘要及每文件校验与快照防篡改；错误许可/codec/路径/重复目录；文件/根符号链接和大小上限；错误长度/摘要与正确摘要但错误格式头；A360/B240分配及verified/playing先后；合成来源/单设备手动动作隔离；切包pending取消/断连/重连/重启；复验失败保留actual；默认disabled拒绝与附着参数冲突；可信目录变化使偏好unsupported、错误导入不覆盖偏好。

首次新用例失败原因为macOS tmp路径含系统/var符号链接，与导入器要求规范根路径冲突；fixture改用realpath根后通过，不放宽路径边界。后续全部检查再次通过。

浏览器使用生成的原创18字节SIM2文件、独立临时服务、真实dist/client.js和本地React：A保存imported/native_360、B保存native_240，推进1秒后分别显示对应素材模拟首帧；刷新页面仍显示各设备状态。交互期间控制台0错误/0警告。界面区分旧参考动作模型与导入素材状态；截图位于忽略目录.playwright-mcp/material-import-playback.png。测试标签已关闭，独立服务已停止且临时目录清理。

边界：这不是PET4/动画文件导入或真实解码/帧呈现。尚无真实46动作目录验证、发布者签名、未知同用户并发恶意目录替换隔离、生产Flash安装/掉电回退、真实设备控制/认证/资源测试；目录读取限32MiB，不适合原生360全库。SIM2协调器与旧actor明确分离，不能把新增状态扩大为固件协议通过。当前固定8动作语义映射，长期运行去重上限未解决；不发实物命令。

下一入口：真实素材格式及来源许可审核的独立Spec/Diff、流式内容仓库与PET4严格解析；再统一模拟transport与生产候选信封/控制代数，补Flash安装激活/掉电模型、v5迁移和认证负例。真实接入仍需明确方案与恢复物。
