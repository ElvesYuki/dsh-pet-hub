# 多设备素材变体 Diff（实现前）

- 增加core素材目录与内存分配模块，依赖纯协议工具，无DOM/DSH/IO。
- protocol兼容性支持schema2呈现与存储预算；schema1兼容保留。DeviceModel显式限制旧缓存模型。
- 新增离线变体选择/拒绝/CAS与多设备用例，不修改旧fixture、不改生产runtime行为。
- 更新协议与长期上下文，区分“已实现目录选择”与“设备安装、UI与持久化待实现”。
