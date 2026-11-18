# 完整角色包、动作规则与设备级原子激活

2026-10-29。本契约已实现于显式simulation + streaming，真实PET4文件在宿主解码；没有设备通信或Flash事务。见[实施Spec](../context/plans/role-package-spec.md)、[Diff](../context/plans/role-package-diff.md)、[验证报告](../reports/2026-10-29-role-package.md)。

## 包格式与兼容

沿用[导入索引](material-import.md)的schemaVersion=1和每个variant的manifest/files结构。完整角色manifest增加package_schema=2、semantics，每个action增加fps、frames、loop；这些字段全部进入规范化manifest SHA256和原始index SHA256。package_schema与设备能力schema是两个独立版本号。

```json
{
  "package_schema": 2,
  "semantics": {
    "idle": 100, "thinking": 200, "working": 200, "result": 300,
    "success": 300, "waiting": 100, "error": 300, "touch": 200
  },
  "actions": [
    {"id": 100, "bytes": 18, "sha256": "<asset SHA256>", "fps": 24, "frames": 1, "loop": "loop"},
    {"id": 200, "bytes": 18, "sha256": "<asset SHA256>", "fps": 24, "frames": 1, "loop": "once_idle"},
    {"id": 300, "bytes": 18, "sha256": "<asset SHA256>", "fps": 24, "frames": 1, "loop": "once_hold"}
  ]
}
```

这是字段片段，character_id/variant_id/codec/license_ref/display及files仍必须按原导入格式提供。上例为原创SIM2，不是PET4数据。semantics必须恰好包含上述8个键，值须引用包内动作；不同语义可复用动作，其余动作仍可手动选择。idle对应动作必须loop。动作帧率为整数1–120、帧数1–360，导入时还必须与二进制严格一致；当前PET4解析仅接受实际24fps，SIM2仅24fps/1帧。逻辑层范围预留不代表已支持其他PET4帧率、转码或变速。

旧manifest仍可用于原素材偏好/播放链路，但不猜测或补齐语义；schema2包只走新角色激活通道，原素材偏好接口拒绝以其替代激活。偏好文件与角色指针独立，UI分别展示，没有两个文件之间的联合事务。

## 时钟与动作

虚拟毫秒时钟决定floor(elapsed_ms × fps / 1000)。loop按帧数取模；once_hold播放一遍后保持末帧；once_idle播放一遍后按超出的时间推进idle，并保持completed，不在每次轮询时重播原动作。来源事件键（状态、counter等）或手动意图revision改变才重新开始。跳跃推进直接解码目标帧，不声称真实时间逐帧播放。

自动模式复用已有source的语义，不增加DSH会话监听。来源暂失沿用2秒宽限，超过2000ms回idle。每设备独立手动/自动意图及CAS，回auto采用最新来源。断连保留最后actual供观察和清理保护，停止提交新帧；重连建立新会话、转auto、递增意图revision，不重放旧手动命令。重启重新校验已确认包，从当前语义首帧开始，不恢复旧命令或播放进度。

## 激活事务

1. 用户从已发布仓库版本选择角色/变体，提交service实例ID、设备ID、expected_revision、version_id、character_id、variant_id、manifest_sha256。候选先持有版本pin，清理不能移走它。
2. 独立worker从CAS重验原index摘要、许可、全部文件SHA/PET4全帧CRC，再检查设备能力、完整角色契约、目标manifest摘要。此内部cachedOnly路径不需要原始导入源存在，不开放网页任意目录读取。
3. 旧设备worker和actual保持可用。候选准备当前自动语义动作并解码首帧；提交前复核设备在线会话、来源事件、旧意图revision和激活revision，拒绝过期结果。
4. 将完整设备指针集合写入私有0600临时文件、fsync文件、rename为role-activations.json，然后在同一同步段替换该设备内存引用。文件包含schemaVersion=1及records，每条含device_id/revision/version_id/character_id/variant_id/manifest_sha256。revision为uint64十进制字符串，首个激活为1。
5. 切换后关闭旧worker；关闭完成前仍保持任务互斥。新激活不影响另一设备。取消只在提交前有效，提交后返回activation_committed冲突；回退已提交版本需显式再激活旧版本，产生新revision。

候选校验失败、首帧失败、取消或写盘失败均不更新旧指针/actual。迟到的旧worker结果按actor身份、设备会话和事件键拒绝。一个服务最多一个候选任务，当前两设备各可持有一个角色worker，另有基础导入worker；最多4个worker，不是整个进程32MiB内存保证。

重启只恢复启动时的已确认记录并重新校验缓存；原目录导入失败可与已确认角色从缓存恢复同时存在。缓存损坏、许可不再允许或设备不在线时保留指针并显示不可用，不自动换成其他版本。当前只启动时恢复，离线恢复失败后的自动后台重试尚未实现。未知设备记录仍保留并受清理保护。

这里的原子性是宿主指针完整替换和单设备进程内切换。没有目录fsync、真实断电故障注入、硬件首帧确认、多文件事务或跨进程设备fencing；不能称设备安装已完成。

## IPC、界面与清理

| 接口 | 契约 |
| --- | --- |
| GET /v1/status | roles.devices显示确认指针、在线状态、模式、意图revision、actual帧摘要、包内动作；roles.job显示任务ID/状态/错误 |
| POST /v1/roles/activate | 上述目标字段；立即返回job_id/phase，后台完成校验和提交 |
| POST /v1/roles/cancel | service_instance_id/job_id；只取消未提交候选 |
| POST /v1/roles/intent | service_instance_id/device_id/expected_revision/kind；manual还需action_id，auto禁止action_id |

继续使用私有UDS鉴权及实例握手。旧实例、CAS、忙状态和已提交取消返回409，非法请求400；未启用角色运行层404。异步失败在job.error查询，不自动重试。activate使用激活revision，intent使用意图revision，两者不可混用。插件经原同源/内容类型保护代理转发，不自动启动服务。

仓库列表的packages仅投影完整契约的角色、变体、manifest摘要与规格；UI按设备尺寸初筛，服务复核完整能力。可显式选择版本、激活、取消候选、手动动作或回自动；展示动作语义、fps、帧数和循环规则。当前帧信息是解码摘要，未加动画画布。

清理引用包括持久激活（含离线/未知设备）、actual、pending、候选目标，候选另持有版本pin。取消须等待worker终止及stage清理完成才释放作业；并发close共享同一完成Promise。基础导入版本仍按旧规则固定保护；切换角色不自动卸载它，不提供强制删除或全局目录热切换。

## 离线验证与回退

npm run preview:roles生成两规格、两版本的原创SIM2包，启动独立临时服务及共享React界面；沿用本机只读React种子准备步骤，Ctrl-C清理本次临时目录，无插件安装。真实PET4审计脚本scripts/verify-role-pet4.mjs需显式source-dir、manifest-sha256、license-ref及output，只读已审核来源，在临时目录组装角色元数据和复制素材，退出删除副本/CAS，不导入固件Python。

停止独立预览/测试服务即可撤销本轮运行效果。代码回退只撤回本轮变更；持久测试runtime需保留指针与版本以便核对，不自动删除。已确认旧版本仍在且可用时，可通过显式激活回退；真实设备/固件/DSH/pet/bridge不在本轮操作范围。素材许可仍独立于代码MIT，非商用素材不得随项目代码发布。

后续[离线帧与恢复契约](frame-preview.md)新增当前actual像素/受控画布、worker期限和显式retry；上文“未加动画画布”现更新为已有虚拟单帧画布，尚无墙钟动画。替换已有actor不再将意图revision归零，改为旧值+1；恢复确认版本的激活revision不变。
