# 400宿主M2 Spec

2026-10-30实施前。用户授权继续管理端M2：六样本导入／预览→补齐八语义→角色恢复与完整候选库准备；不改设备／固件／运行配置。

## 合同

400使用显式manifest.pet4_profile=native400-candidate-v1，只有调用方approvedPet4Profiles包含该profile才允许导入及缓存恢复。profile纳入manifest摘要，缺失／未知／尺寸不符拒绝；旧240/360不要求该字段且回归保持。流式单对象仍8MiB，整体512MiB、默认磁盘1GiB限制不因400自动上调；超限明示失败。

复用已有仓库、worker、角色原子激活／CAS／取消／重验恢复／清理保护，不建立第二套播放器。缓存重开同样需显式profile批准。页面不能批准profile、传任意文件路径或启动服务；内部／CLI显式simulation装配，deviceTransport=false。

frame路线响应由384KiB调整为固定512KiB：400 RGB565 320000B，base64为426668字符，JSON身份元数据有界后小于512KiB。服务、IPC客户端、宿主代理均按完整UTF8 JSON字节限制；其余响应仍64KiB、请求仍4KiB。400解包长度按ceil(raw/3)*4（320000不能被3整除，需正确补位），拒绝短长／错误profile，画布466居中偏移33，仅物理圆裁切。

补齐语义idle0/thinking1/working11/result43/success58/waiting7/error55/touch4，保留M1六小样以及42原118帧。角色包loop为本地明确候选策略：success58 once_hold、touch4 once_idle，其余loop，不当作固件默认。完整78以同recipe仅候选批量生成，不能扩大设备cap或把全部库当同时缓存。

## 实施与验证

新增profile校验／批准传递，修改manifest白名单、worker、恢复、CLI与共享预览；单frame统一字节预算。编解码工具增加显式ID列表和无动画批量模式，复用相同recipe及来源SHA，无原帧缓存常驻。

合成测试：未批准／未知profile拒绝，400完整解码／坏帧／时序与元数据错配、UI base64补位、512KiB边界及其他64KiB保持；真实临时UDS→插件代理帧复核。角色八语义切换、42最后帧、取消保旧指针、坏缓存不覆盖、显式恢复及源目录消失后重开；旧240/360全套回归。

生成媒体仅.cache，正式360、设备源、0/4保护及硬资源门槛保持。新增模拟资源能力必须显式标候选合成值，不冒充实物批准。浏览器自动验收不足如实说明，不绕过本地文件策略。
