# 当前圆屏承载/认证与资源离线评审

> 历史审计快照，早于用户确认正式目标切至175C原生360及设备切换；当前状态见[正式基线](../context/native360-baseline.md)。本文旧128预算及当时未部署记录不代表当前设备状态。

2026-10-29。先写[评审Spec](../context/plans/transport-auth-review-spec.md)/[Diff](../context/plans/transport-auth-review-diff.md)，全程只读固件目录/本机SDK和官方文档。不连接设备、不烧录、不构建固件、不读运行token/NVS/串口，不改pet/bridge/DSH，不使用子智能体，不提交推送。

结论：选定**单连接设备HTTPS client→独立hub mTLS server**作为首个互操作候选；尚无握手/资源实测，保持NO_GO_UNTIL_MEASURED和deviceTransport=false。完整[承载/凭据子Spec](../protocol/device-transport-auth-v1.md)与[资源/恢复门槛](../context/plans/transport-auth-device-gates.md)已建立。

## 1. 版本、接口与入口核对

固件root仍为919398969328b6b5a71fbcc605f5db4ef7379a65，但有大量用户未提交变更，包含新板/原生360入口。没有重置/覆盖这些变化。锁定IDF6.0.2、cjson1.7.19~2；旧profile显示组件依赖仍见其dependencies.lock。

| 内容 | 本轮只读确认 |
| --- | --- |
| 旧128普通入口 | app_main.cpp，v4 HTTP主动轮询；Config base[96]/token[65]，只接受裸http数值IPv4:port |
| 请求生命周期 | 每次request初始化/open/fetch headers，调用方cleanup；控制任务和loader独立请求，可并行两个明文连接；不能照搬成双TLS |
| 请求设置 | buffer_size4096、timeout3000、禁重定向、Bearer；下载16KiB内部缓冲、SHA/长度/格式校验 |
| 确认时刻 | 128非Flash路径在bind player后排队ack；新协议仍需首帧提交钩子 |
| 状态/USB | v4无设备身份/heartbeat；pet_config写pet_remote后重启，行缓冲256B，不能传完整证书 |
| NVS | clock_network_init调用nvs_flash_init，失败保留已有数据；clock_net与pet_remote已有用处，24KiB NVS不是空白空间 |
| SDK TLS | 本机esp_http_client.h有cert_pem/client_cert_pem/client_key_pem/tls_version/common_name/skip_cert_common_name_check；源码确实向SSL transport传客户端证书/私钥 |
| PSK | 本机esp_tls.h有psk_hint_key，HTTP client配置没有相同直接入口；当前PSK verification未启用 |
| 安全配置 | 当前sdkconfig未启NVS encryption、Secure Boot、Flash encryption；TLS不安全开关未启用，不把配置视为实物eFuse状态 |
| TLS堆 | 当前及128回归头文件为internal alloc、16KiB RX/4KiB TX、dynamic buffer关闭、TLS1.2/P-256/ECDHE-ECDSA已编译 |

本机Node24.14.1/OpenSSL3.5.5只做getCiphers枚举及https.createServer函数存在性检查，候选套件可枚举。没有生成真实绑定密钥、开启TLS server或验证ESP↔Node握手。

## 2. 多profile与产物不能混用

本轮重新读取外部current-system/应用README，发现其2026-10-29新增1.75C真机、原生360试验和production构建候选，更新了先前“新板未实现”的旧上下文。它们是外部报告事实，本轮没有独立确认设备运行状态。

| 既有产物 | 文件大小B | 摘要/证据层级 |
| --- | ---: | --- |
| build/round_pet.bin | 1256576 | a117e9ef4d85ce5fcc2e4b6e38aeaa17ee026356188f578a7b7fb979106c4029，与旧128报告匹配 |
| build-128-regression/round_pet.bin | 1256576 | e27d304b99ae18d6ded529da3b03a1677b21dce0537daf8eb859b2496442657e，既有回归产物，本轮未编译/烧录 |
| build-native360-eval/round_pet.bin | 1255088 | 886bb6c8f8dc4c2b8164303ae7fb82006acb8bf26a9f605012f6e20278219991，与外部最新RAM试验报告匹配 |
| build-native360-production/round_pet.bin | 1283520 | ed62b59fa0323e5bd5715db79b01ac0109f8e6ae7d503ba3c8d9bc29aae9248d，目录有候选，不推导已部署 |

旧128：16MiB Flash/16MiB PSRAM历史实测，4MiB factory app@0x10000、NVS@0x9000大小0x6000，当前旧镜像距app分区上限尚有2,937,728B（只算Flash容量，不代表堆）。

175C报告实物8MiB PSRAM/32MiB Flash；普通布局app@0x200000，保留出厂storage和上半Flash素材；native360 production候选分区则app缩至2MiB、素材区从0x400000占28MiB，重叠旧资源，**本轮不采用/改写**。不能将旧128分区、安全/NVS容量与新板混用。

外部最新报告指向用户保留原生360 RAM待机、约16.3消费FPS、重启重新下载；同报告内部RAM约97,963B/PSRAM约2,068,756B为旧采样。该入口不是旧128四槽/46动作基线，不能由此承诺新板完整原生离线播放或24FPS。

## 3. 资源证据与预算

旧128源码静态主要PSRAM项：4×3MiB素材槽+2×240×240×2B帧+2MiB LVGL池=14,910,464B。旧报告PSRAM free约1,859,936B；其余元数据/分配细节不反推成固定余量。

主要内部静态请求量：解码4864+4800=9664B、下载16384B、显示240×60×2B双DMA=57600B，以及control6144B/loader12288B任务栈。128既有map的dram.data=0x5eac、dram.bss=0x14ed0，只是链接静态区，不用它计算动态可用堆。

旧报告手动稳态内部RAM约70KiB，下载窗口约37KiB；未报告该窗口最大连续块和TLS握手峰值。现有MbedTLS仅记录缓冲就需20480B，尚有X509/密钥/握手/连接对象。16MiB外部RAM不能直接替代内部/DMA要求。

新增设计包络140KiB预握手free、largest≥64KiB与握手后reserve≥32KiB都是**计划门槛，不是已测量需求**。当前37KiB采样低于该保守门槛，尚无把mTLS与现有负载并行的准入依据。下一步需在独立配置Diff中评估复用任务/缓冲和external/dynamic alloc，再用未来获授权的探针测量，不静默减槽/降画质。

[预算JSON](../protocol/transport-budget-legacy128.json)和`node scripts/check-transport-budget.mjs --legacy-128`复核：主要PSRAM14910464、TLS记录20480、候选预留143360、旧app余量2937728；输出明确NO_GO_UNTIL_MEASURED，不进行网络操作。

## 4. 凭据与通信决策摘要

- 单HTTPS连接复用、控制/素材Range串行，4KiB控制JSON/32KiB段/4KiB流式读缓冲；不增加第二TLS连接，不代理DSH端口。
- per-device证书与controller专用CA；校验链/角色/名称/有效期后仍按已批准fingerprint与binding epoch白名单授权，每请求检查撤销。不能凭CA签发就自动注册。
- 初始信任通过未来用户确认的USB开发绑定；CSR私钥留设备，旧256字节行解析需新分帧。BLE配网依旧P2未实现。
- RAM临时凭据只适合未来资源探针；正式持久绑定受NVS容量/保护、可信时间、提交原子性及回执恢复等门槛约束。Keychain适配器及物理Flash保护尚未验证，不自动烧eFuse/改分区。
- 双端各自单调时钟，wire只传lease_ms；S1/S2共享虚拟expires_at不直接用于真实协议。

## 5. 官方参考与证据限制

已读取[ESP HTTP Client 6.0.2](https://docs.espressif.com/projects/esp-idf/en/v6.0.2/esp32s3/api-reference/protocols/esp_http_client.html)、[ESP-TLS 6.0.2](https://docs.espressif.com/projects/esp-idf/en/v6.0.2/esp32s3/api-reference/protocols/esp_tls.html)、[NVS 6.0.2](https://docs.espressif.com/projects/esp-idf/en/v6.0.2/esp32s3/api-reference/storage/nvs_flash.html)、[NVS Encryption 6.0.2](https://docs.espressif.com/projects/esp-idf/en/v6.0.2/esp32s3/api-reference/storage/nvs_encryption.html)。这些支持接口/生命周期/存储保护机制，不提供本项目TLS内存性能保证。[Node TLS页](https://nodejs.org/api/tls.html)当前为v26，本机目标仍24；已用本机枚举弥补接口存在性核对，未做互操作。

配置/8份关键文件只读摘要留在忽略目录.cache/transport-review。收尾比对6份未变，pet_native360_main.cpp与根sdkconfig发生变化；本轮所有固件访问均为只读，说明该目录存在并发修改，不能视作冻结。重读后与本预算相关的根配置（internal TLS、16KiB/4KiB、TLS1.2、NVS/SecureBoot/Flash encryption未启用）仍一致，但native360 production的源码/构建一致性须在后续重新核对；本报告其他产物/资源均标读取时快照，不宣称是最新运行状态。未保存任何网络密码、token、原始运行配置或Flash备份到Git。

## 6. 验证和未覆盖

本轮完成只读源码/SDK/产物审计、离线预算算术及本仓库现有静态/构建/测试回归。既有60测试继续验证模型/模拟IPC/UI，不新增“mTLS成功”测试名。未运行固件构建或SDK脚本，没有串口/NVS/eFuse读取、TLS连接、证书写入或固件刷写。

未覆盖：实际证书互操作/负例、独立时钟、Keychain、设备安全存储/可信时间、NVS剩余页/写入/掉电、握手/下载堆峰值、真实24FPS/新板帧率、完整恢复物及用户当前物理运行profile确认。

下一明确入口：离线证书/报文契约负测与独立时钟测试Spec/Diff；通过后再申请独立loopback TLS原型，仍不接设备。当前不批准自动进入固件构建/烧录或修改现有链路。
