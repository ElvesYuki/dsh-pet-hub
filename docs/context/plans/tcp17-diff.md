# TCP-17 Diff（实施前）

- 新runtime/native400-node-control-window.mjs：纯Node窗口启动/赢家监听/本地控制/关闭装配，复用service和LAN owner，默认关闭，无Python/USB配置入口。
- 新原创loopback/进程专项与隔离CLI，实际二进制协议、单实例/附着/取消/重连/退出和空PATH验证；不增加真实LAN运行命令或设备工具。
- 维护正式运行与可选调试的文档边界：Python依赖审查移出默认待办，TCP14–16可选工具成果保留，不删兼容API、不改变DSH/现有服务/协议/期限/调度实现。
- 更新Spec/协议/报告/结构化证据/许可与当前摘要/G0，归档被替代记录。零新增依赖，不运行上游脚本/设备、不开生产listener，不安装插件或提交推送。

实施状态：21专项/独立CLI、check及含build全量1730/1730、最终build通过。纯Node窗口/真实loopback与空PATH进程已验，未接ESP或真实LAN。收尾只读终端新口径已接受当前帧率/流畅度，严格24fps不再作验收前置，素材时间信息和完整性/资源/退化检查保持。见[报告](../../reports/2026-11-05-tcp17.md)。
