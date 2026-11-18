# 单设备G0基线演进

2026-10-30。当前见[管理端对齐表](../round-pet-hub-baseline-alignment.md)、[正式目标](../native360-baseline.md)及[G0报告](../../reports/2026-10-30-round-pet-g0.md)。只用固件最新矩阵/P2/P3报告替代旧部署未知、旧PSRAM漏计read-ahead和笼统下一入口；本任务没有读设备，不能把引用的上游报告升级成新设备测量。399项/scoped减量已经完成，未被规划替代。

旧文内部链接按原文件解释，通过上方当前入口导航。

## 原正式目标页

```text
# 当前正式目标：175C／原生360

2026-10-29，用户已明确选择作为正式基线，并确认设备已经切换。该确认优先于先前外部报告的“未烧录”历史描述；本轮不操作设备。

| 项目 | 当前记录及证据范围 |
| --- | --- |
| 管理端正式目标 | 1.75C原生360正式路径；旧128/240降为历史兼容参考 |
| 设备状态 | 用户确认已切换；精确部署SHA、启动开关与分区未由本轮独立读取 |
| 屏幕与素材 | 板级源码466×466，原生360×360 PET4居中；屏幕物理规格与素材变体分离 |
| 正式路径代码 | PET_BOARD=175c、PET_NATIVE360_PRODUCTION=ON、pet_native360_main.cpp；与RAM EVAL区分 |
| 网络兼容 | 现有production源码为独立v5目录/状态/素材/played/touch；不等于新hub-device/1或mTLS |
| 存储结构 | 源码/宿主报告为V2 Flash缓存4激活+1暂存，单动作压缩RAM播放；不是旧四PSRAM槽 |
| 素材库 | 原生360全46动作215.06MiB为宿主报告；不能全库离线常驻，设备实际安装范围未新验证 |
| 内存 | 板profile8MiB PSRAM/32MiB Flash；host显式PSRAM预算6851241B，剩余1537367B尚未扣全部系统/瞬态；动态TLS内部RAM未知 |
| 功能来源 | 多动作、离线默认动作/挥手、首帧后played为源码/宿主报告能力；本轮不额外宣称全功能真机验收完成 |
| 性能 | 不套旧128约24FPS或RAM单待机16.3FPS，正式完整路径指标待独立记录 |
| 恢复 | 保留用户当前175C原生360对应恢复物；不自动降到240放大、RAM EVAL或旧128 |

外部只读来源：apps/round-pet/reports/2026-10-29-native360-production-host.md、firmware-native360-production-host.json、main/pet_native360_main.cpp及175C板级显示源码。报告仍标host_verified_not_flashed，是其编写时状态，不用它否定用户后续切换确认，也不把其中构建SHA直接当用户当前部署SHA。

后续迁移先审现有v5到hub-device/1的边界，不能继续只按v4解析。新mTLS/绑定/心跳/独立控制仍未实现。S1/S2目前保留240合成fixture的既有60测试，尚未因目标更换自动证明360能力/性能；后续用显式profile变体补充参数化。

预算命令默认175C原生360：node scripts/check-transport-budget.mjs；旧128仅显式--legacy-128。140KiB预留是待测设计包络，不是新板已测TLS占用；不再把旧37KiB作为当前设备阻塞数值。

本次基线更新验证：`npm run check`、`npm test`（60/60，含候选构建）、新目标/历史目标预算算术和本地文档链接检查通过。未运行真实设备/TLS集成；未更改固件、pet、桥接或DSH配置。

```

## 原系统外部基线摘要

```text
用户选择1.75C／原生360 production并确认设备已切换：屏幕466×466、素材360×360。外部源码为v5、V2 Flash四激活加一暂存、单动作压缩RAM播放；精确部署SHA/分区、完整功能与性能仍待实物核对。参见[正式基线](native360-baseline.md)。旧128的240素材、约24FPS、四PSRAM槽及下载余量仅为历史参考，不用于新板预算。
```

## 原下一入口1–3

```text
1. **生产承载调度与发行准入**：[复验减量](../reports/2026-10-30-verification-reduction.md)已完成scoped缓存/一致revision视图、同负载及坏档/撤销负例，不重复原型。下一先写Spec/Diff明确真实控制FIFO接入、poll/分段/背压与排队等待、重试身份/副作用未知及期限外失效，证明每项上界后再组合租约预算；生产lane/listener尚未装配，不以warm样本解除NO_GO。同步评审helper签名/秘密引用、旧元数据迁移；物理睡眠/唤醒仍须窗口/观测/回退方案，不自动睡眠、启用服务或接设备。
2. **v5迁移与生产设备协调层**：核对175C原生360能力与精确部署SHA/分区，补迁移/参数化用例及Flash安装、激活、掉电模型Spec/Diff。素材目录、持久偏好、完整角色包及离线画布已完成；宿主确认指针不替代设备Flash事务。[正式基线](native360-baseline.md)。
3. **认证与资源准入**：宿主证书/报文、独立时钟、Node loopback与临时绑定/会话恢复已完成，不能替代ESP或真实睡眠/唤醒时序验证；已有macOS native注册证据不作物理周期结论。新板仍需测TLS峰值、可信时间来源、持久凭据/撤销与恢复、实际队列/轮询/不可抢占分段/网络/处理及ppm上界，保持NO_GO_UNTIL_MEASURED；未实现通用PKIX/中间CA/CRL/OCSP，不套旧128/RAM EVAL或自动改分区。[准入门槛](plans/transport-auth-device-gates.md)。

```

## 原内存／TLS准入段

```text
当前175C native360 production宿主报告：8MiB PSRAM，显式请求6851241B（压缩动作5865472B、帧与history907200B、catalog9612B、clip3420B、control JSON65537B），算术剩余1537367B尚未扣其他系统分配和瞬态，不能视为运行free。内部已请求项包括解码/下载scratch30848B、worker/control栈20480B、466×20双DMA37280B；实际free/largest/峰值未知。

当前配置RX16384+TX4096=20480B仅为TLS记录缓冲，不含握手/X509/密钥/context。旧128约37KiB下载余量与RAM EVAL试验采样不适用于当前production；历史数据留在[旧预算](../../protocol/transport-budget-legacy128.json)。

**设计探针预留包络，非测量**：TLS新增峰值上限96KiB+控制缓冲4KiB+新增栈保守8KiB+剩余内部reserve32KiB=140KiB（143,360B）的预握手free目标；largest internal block预目标≥64KiB。新任务替换可回收多少旧栈尚未计算，不把该回收当已存在余量。

| 门槛 | 未来必须记录/通过 |
| --- | --- |
| 握手前 | 总内部free/largest、PSRAM free/largest；若达不到预算，先在离线配置Diff中解释重分配，不强行握手 |
| TLS握手/冷缓存下载 | 实测峰值及持续minimum；内部剩余≥32KiB并留可用连续块，无OOM/看门狗/回退明文 |
| 连续连接与失败恢复 | 至少100次受控重连/错误证书/拒绝链/断开，最低堆和largest趋势不持续下降；100是计划不是本轮通过值 |
| 显示并发 | 同板同素材旧/新对照，记录软件提交FPS、最大间隔、跳帧/首帧、控制RTT；128约24FPS是旧报告，不扩展到175原生360 |
| 新板profile | production完整路径后台瓶颈/临时RAM预算单独复测，不能沿用RAM EVAL单待机采样，不通过缩回240绕开用户选择 |
| 持久绑定 | NVS剩余页/entries和双槽最大证书写入、提交前/后断电切点；不会侵入旧配置/素材分区 |

TLS external allocation/dynamic buffer可作为单独配置实验候选，本机Kconfig确有选项；必须测cache/crypto/DMA和性能影响，不简单把秘密/全部对象搬进PSRAM就宣称解决内部RAM或物理安全。不得静默减素材槽、降画质或改时序。


```

140KiB/32KiB是旧假设，不是设备实测或当前准入；本轮转为固件内部≥48KiB等更严格门槛，新的TLS分配／时间／取消仍须G2，不能只靠加总通过。保留旧预算JSON为历史输入而未更改，不能自动用它评估当前前瞻版。旧完整角色库／PC预览／TLS模型的证据依然有效，首实体闭环仍未实现。

## 原资源门禁下一入口

```text
当前准入：资源与安全存储/时间/恢复物均未完成实测或确认，**不进入实物接入/刷写**。下一步可以先离线补证书负例和wire codec/双时钟测试；不自动启动LAN服务或操作设备。

```
