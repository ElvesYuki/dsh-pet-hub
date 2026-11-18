# 多设备素材变体：离线契约

2026-10-29。实现位于packages/core/materials.mjs及protocol.mjs；这是宿主纯模型，非固件现有协议。未接入IPC、界面、持久仓库或真实素材传输。

## 数据分层

- 设备：物理display(width,height,shape,pixel_format)、codecs、presentation_modes、RAM播放容量与Flash持久容量。
- 角色：character_id与语义动作映射；同角色变体保持动作ID语义，required_actions按已审核映射传入，缺失则不兼容。
- 变体：character_id、variant_id、sha256、codec、素材display、actions(id,bytes,sha256)、license_ref。许可引用必填不等于已获得授权；目录/素材摘要由可信导入器负责计算，本模块仅验证元数据格式。
- 分配：每设备独立revision与已确认角色/变体/manifest摘要/required_actions。内存分配不是绑定、下载、安装或播放确认。

## 能力schema

schema1保持旧cache(slots,slot_bytes,persistent)，只允许等尺寸exact，已有S1/S2保持原样。

schema2新增presentation_modes白名单，仅exact和center；cache改为：

```json
{
  "playback_bytes": 5865472,
  "persistent": {
    "active_slots": 4,
    "staging_slots": 1,
    "slot_bytes": 5865472
  }
}
```

以上为合成能力示例，不代表当前175C已报告这些值，也不推导Flash真实单槽上限。无持久缓存时persistent为null；max_asset_bytes不得超过playback_bytes。每个动作还须小于等于max_asset_bytes及存在的Flash槽上限。表示“该动作可以依次装载”，不表示整个角色库可同时常驻。活跃/暂存槽只是容量声明；安装激活/掉电状态机另做。

屏幕与素材shape/pixel_format相同，编码受支持，尺寸不超过屏幕；exact需等尺寸，center使用原尺寸居中、偏移向下取整。两种模式都需设备明确声明，禁止缩放/裁切/隐式降级。后续硬件缩放需独立版本契约。

## 选择流程

1. MaterialCatalog构造时验证目录，拒绝重复角色/变体键、重复动作、空动作、缺许可与非法大小/摘要；不同角色可使用相同variant_id。
2. recommend(caps,characterId,requiredActions)只返回推荐及候选，无分配写入。优先exact，再按原生面积从大到小，最后按variant_id稳定排序；无候选为unsupported。
3. 用户可以明确选较小的兼容变体；MaterialAssignments.confirm用每设备expected_revision CAS并核对manifest_sha256，过期请求或不兼容确认无写入。
4. resolve用最新已验证能力重检原选择；不兼容返回unsupported并保留原选择，禁止自动换包。返回的数据均为副本。

schema2兼容检查已可由Registry使用，但它仍固定一个manifest；多设备角色装配须通过后续应用协调层解析分配。DeviceModel明确拒绝schema2，避免拿旧四PSRAM槽模拟Flash生产状态。正式API接入前还须绑定认证设备上下文、持久化CAS、协商消息大小及变体变化后的旧命令fencing；本模块不处理这些安全边界。

## 素材偏好IPC/UI离线切片

显式simulation已接入选择界面与独立存储（[验证报告](../reports/2026-10-29-material-ui-storage.md)）。状态每设备material返回白名单候选、当前选择/revision/兼容状态；POST /v1/materials/selection只收service_instance_id、device_id、expected_revision、character_id、variant_id、manifest_sha256。required_actions由服务目录配置决定，页面不能覆盖。409表示实例/版本/目录冲突，503写入失败需刷新核对，不自动重试。能力profile与原240 actor分离，选择不改变播放manifest。MaterialAssignments内存模型通过注入persist钩子保存，严格恢复记录；原型仍未接生产固件/设备身份。

后续切片已增加[目录导入与SIM2播放协调](material-import.md)：仅显式可信本地目录/许可白名单，SIM2选择在虚拟时间推进后装配每设备模拟首帧；旧内置PET4候选仍metadata_only。旧文中的“选择不改变播放manifest”仅适用于原actor/无导入模式，不代表SIM2协调器。

后续[完整角色包契约](role-package.md)增加显式package_schema=2及每设备原子版本激活；包版本号与本页设备能力schema互相独立。目录/设备能力匹配仍复用本页规则，旧偏好不等于新角色激活。
