# TCP-11：历史LAN输入来源审计

2026-11-05。[Spec](../context/plans/tcp11-spec.md)/[Diff](../context/plans/tcp11-diff.md)/[报告](../reports/2026-11-05-tcp11.md)。只读审计器，不是设备配置或用途批准入口。不接受/产生LAN option、request、凭据或deviceConfig；TCP08–10准入保持独立。

后续[TCP12](native400-reviewed-lan-request.md)已新增同次任务内部上下文与独立决定关联；此页audit recipe/历史来源语义保持，真实用途/设备未因此获准。

## 输入与API

`createNative400LanInputAudit({sourceManifestFile,sourceIndexFile,cacheSource,expected,minimumSequence='0',signal?,timeoutMs=10000,beforeRead?})` 返回异步任务。路径必须显式绝对规范路径，不从旧配置/journal/设备发现推导。beforeRead仅可信测试hook，未接UI/IPC/CLI。

cacheSource闭合file/offset/source_bytes；offset为非负安全整数，offset+29360128必须等于source_bytes且总大小≤33554432。支持独立28MiB文件和32MiB历史容器的明确cache区间，不解析或猜测分区。offset是离线来源偏移，不是设备写地址。实际fstat大小必须精确一致；不会读cache区间以外的容器内容，也不据此证明整个容器SHA或分区表。

expected闭合source_manifest_sha256/source_index_sha256/cache_sha256/mapping_sha256，各非零小写64字符SHA，由可信调用方独立明确；不接受文件自带approved等字段。摘要是预期内容pin，不是签名、授权或当前库存证明。

| 方法 | 语义 |
| --- | --- |
| ready | 完成metadata、双根/四对象、整cache及逐payload SHA、最终所有fd/path复检并实际关fd后，返回历史证据深拷贝；失败不返回部分结果 |
| snapshot() | 版本/profile/phase/error/reads/streamed_bytes/result/device_evidence=false，无路径/原始头/运行响应；只有audited阶段有result |
| resources() | closed/open_files、metadata_bytes_max=2097152、stream_buffer_max=65536、retained_cache_bytes=0；非进程RSS硬预算 |
| close() | 幂等Promise，立即拒绝结果发布，等待实际read/hook/fd退出；不删源或报告，也不代替任何网络/设备关闭 |

timeoutMs为1–30000ms的逻辑失效期限，不抢占同步CPU/内核I/O。abort/close/超期在忽略取消的hook期间不提前宣称open_files=0。关闭失败保留资源失败，不自动重开/修复。对外稳定lan_audit_*或既有bootstrap_*错误，cause只内部使用，不直接打印含路径错误链。

## 复用与完整性范围

两份metadata各≤1MiB，current-user普通文件/nlink1/无组或其他写权限，允许644的公开素材元数据；cache来源还必须私有600类权限。O_NOFOLLOW/O_NONBLOCK，最多三fd保持至最后，读前后及结束时核dev/ino/size/uid/mode/nlink/mtimeNs/ctimeNs的fd/path一致性。已读取metadata后被改动也会使结果失败，不能只在各自读取结束时核一次。此检查只覆盖一次审计，不监控后续改盘或抵抗恶意同用户长期回放。

native400SourceCandidate从原字节推完整78候选、原始manifest/index SHA，核400²/24fps/42号118帧及其余241帧、视觉引用/几何、F/长度与目录一致性。只接受完整78 index，不把role8当别名；视觉批准仅来源字段约束，不产生新的用途批准。

inspectNative400BootstrapHeaders从既有带批准inspector抽取同一纯检查：V2 namespace/geometry/保留区/头CRC/commit、双根/五物理对象、slot/generation/四ID/长度/F、精确uint64序列与floor。新纯函数只接受可信normalized candidate/metadata供诊断，无approval/map输出。旧createNative400BootstrapInspector仍先核独立批准，闭包metadata不能被调用者额外字段覆盖，原map格式/诊断保持。

审计拒绝degraded_roots/fallback_from_newer，读取整28MiB cache SHA及四引用payload SHA；即使攻击者重算整cache SHA，payload仍须匹配candidate。流式缓冲64KiB，不解码PET4、不验证全部帧CRC/index/RGB/extra。不是whole-media proof，也没有检查所有78个媒体文件。

## 证据格式及不能推导的事实

ready返回 `{recipe:'native400-lan-input-evidence/1',sha256:SHA256(C(content)),content}`。content含schema_version=1/scope=offline-input-audit、派生N_boot/source manifest/raw hub_index/四记录、mapping、cache范围/SHA、selection、checks及四个恒false声明：current_device_inventory/material_usage_approved/device_evidence/authenticated。cache.historical_only恒true；checks.media_validation=not-performed。

self SHA只用于复现，不能代替实读或批准。该recipe不是400-08 bootstrap source-map，不可直接传旧validateMap或从文件自授权。来源证据可在独立用途审阅中被引用，但其存在不生成TCP08 decision或扩旧offline scope。首帧历史、verified=null/current_display=unknown、保存/离线可用语义均未改变。

## 本轮真实与合成执行

18专项为原创metadata/稀疏cache，含真实只读fd、跨文件变更/换inode、偏移范围、完整cache和payload负例、取消/超期/关闭实际退出。没有loopback或LAN执行；旧TCP/UDS仅由全量回归在临时环境覆盖。

真实运行另记报告：本仓库审计器读取现有compact78 manifest、完整78原index及历史32MiB备份中的28MiB cache区间，确认57ae06ed…与cc2802e4…、双根1/2。未重哈希整32MiB、未重验全部78媒体或重解码；不执行终端生成器/构建/设备脚本、不读取Wi-Fi文件。历史e738备份的完整身份/镜像/回退由终端最新预检报告支持，本仓库不冒称复跑。

## 回退与下一入口

close并等open_files=0后只处理自有临时目录。没有写源、批准、运行配置或持久格式，无需设备恢复；不接此入口仍原TCP10/09。失败保留原数据，不自动重试/覆盖坏源。

下一见[共同G0交接](../context/plans/round-pet-g0-handoff.md)：完整78 raw index作为首窗候选已明确；历史来源已核，但独立用途记录、端侧index职责确认、真实输入/凭据调用方及实际窗口仍待。actual LAN/USB/STA/ESP动态资源、时延、首帧与cleanup须单列真机证据。STATE/媒体流/保存/V3后置。
