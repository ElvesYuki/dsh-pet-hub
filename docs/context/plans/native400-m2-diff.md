# 400宿主M2 Diff

配套[native400-m2-spec.md](native400-m2-spec.md)，实施前。

- core增加pet4_profile元数据严格校验与固定帧响应预算；不放宽默认decoder。
- runtime/import、worker及角色缓存重开传递approvedPet4Profiles；服务、客户端与宿主代理统一frame512KiB，其余64KiB；UI支持400与base64补位。
- CLI新增显式material-profile；默认行为及deviceTransport=false保持。
- 编码工具增加显式ID列表／无动画模式，生成新增语义及完整候选，HC12最终包与角色index另存。
- 合成边界／真实UDS与代理／恢复回归；新增验证脚本与报告，来源许可／长期上下文同步。无固件更改、安装、烧录或提交推送。
