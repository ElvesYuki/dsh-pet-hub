# PET4离线 Diff（实现前）

新增独立core PET4/LZ4块解析；runtime导入/校验分派到PET4，返回已验证摘要和独立按需帧decoder；MaterialPlayback支持真实解码帧摘要随虚拟时间推进。新增源码生成fixture、负例/导入/播放测试、只读实际库审计脚本、许可出处与报告。保留原SIM2及默认disabled；不导入外部Python/源码，不改固件/运行配置、不写动画到Git。
