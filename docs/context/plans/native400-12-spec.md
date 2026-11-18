# 400-12 Spec：内部选择身份与既有reader绑定

2026-11-03，先行设计已完成本片离线实现，见[报告](../../reports/2026-11-03-native400-12.md)。承接[400-11评审](../../protocol/native400-source-review-controls.md)。已读AGENTS/README/当前上下文/规则及400-08reader/400-09manager/400-10只读装配。保留已有修改，不用子智能体。本轮仅原创临时文件，保持离线；不读真实素材/cache/固件/备份，不接设备/生产listener、不安装/烧录/提交推送，不改DSH/pet/bridge或现有服务配置。新代码MIT，零新依赖。

## 选择与绑定

- 新runtime内部选择工厂，仅显式规范绝对路径；元数据检查复用reader的private/regular/nlink1/精确29360128B与BigInt指纹，不读头/媒体/整文件、不复制到仓库。短期fd在ready前关闭，输出模块内WeakMap识别的冻结opaque引用，不暴露路径/指纹，不可JSON恢复/伪造。
- 共享指纹/稳定路径检查，从既有reader提取复用；不建第二套hash reader。选择期fd/stat/path须一致，beforeCheck仅内部测试钩子，signal/期限/close等实际钩子与fd退出，不假释放。
- 生命周期selected/expired/revoked/closed/failed；单调时钟/默认60秒仅为选择准入策略，期限相等拒新绑定，反向/非数时钟失败关闭。snapshot安全名/状态/错误，无路径/inode/时钟/批准或凭证。时钟可注入，来源元数据大整数始终字符串/BigInt，不转Number。
- 既有reader可选expectedSource：先验证真实引用/完全相同路径/未过期且未撤销，再在实际open/fstat后、首读前比较选择指纹；任务内沿用既有fd/path/全SHA/逐F检查。选择期合法文件被另一合法同字节/同长度文件替换，也必须拒绝。undefined保旧接口，显式null/克隆/JSON/伪造引用拒绝且不回退路径模式。
- 绑定发生在每次任务准入时，不实现单次消费/请求授权（400-13负责）。已准入读任务不因选择TTL经过而中断；revoke/close/时钟失效仍使其失效，I/O钩子不退出则持busy/fd等待。引用复用只供可信内部调用，不是页面授权令牌。
- reader提供内部同步选择检查供manager在读后和提交valid门禁复用；不重新做路径I/O或假持续监视。manager可选传递expectedSource，未知提交优先于选择失效，失败保旧历史；取消/撤销跨已进入的持久提交可留历史但不得发布本次通过，不宣称回滚。

## 范围与兼容

复用两份独立批准、原recipe/来源map/journal格式；仅安全错误枚举增加选择失效类别。400-03固定wire/设备字段、400-07预算、旧尺寸、service/profile/IPC/代理/UI只读行为不改。选择不授用途、不代整SHA/全媒体验证，不产生设备actual/saved/库存。定向取消、请求去重、审阅会话/完整授权gate、原生picker与网页操作仍400-13/14待实现。

## 验证

原创28MiB sparse与原PET4：元数据选择零内容读/短fd关闭、path/inode替换（含同字节）、原位改动/mtime恢复、权限/链接/截断、首读前后竞态、准入过期/复用/撤销/坏时钟、读取中忽略abort、伪造/克隆引用、元数据大整数与snapshot隔离、manager传递/失败历史/commit gate撤销与unknown优先、原map/golden/默认模式兼容。专项→独立临时CLI→npm run check（语法）与npm test（含构建），只有新问题才扩大/重跑。CTL-01–40仅本片相应子范围有新覆盖，其余不得标为完成。

## 回退

关闭选择/reader/manager，等实际元数据或内容I/O退出，保源与journal；候选不接service/IPC/页面，无需迁移格式/配置。撤回可选绑定可回原内部路径接口；不能在失效绑定错误时自动降级。后续400-13先Spec/Diff做有界控制器/定向取消/同步授权gate。正式用途/G0/资源/Flash/TLS时间凭据/G1-G2/24fps仍独立，外部沿400-06快照。
