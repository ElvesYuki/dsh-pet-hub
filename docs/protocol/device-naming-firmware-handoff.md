# 圆屏固件命名整理交接

此页保留迁移前路径。当前固件开发入口和共享向量见 [同仓固件](../../firmware/README.md) 与 [设备协议](firmware/README.md)。

2026-11-20。管理端已按职责整理命名。固件可按下面的边界单独整理源码；此交接未在固件仓库写入文件、构建或烧录。

## 可整理的源码范围

| 现有固件位置或名称 | 建议 | 涉及引用 |
| --- | --- | --- |
| `tools/round-pet/vp8-probe/` | `tools/round-pet/device-firmware/` | 构建入口、烧录和发布脚本、测试夹具、说明文档 |
| `main/vp8_status.*`、`main/vp8_status_usb.h` | `device_status.*`、`usb_status.h` | 状态编码、USB worker、状态向量 |
| `main/vp8_lan_session.*`、`main/vp8_lan_socket.h`、`main/vp8_lan_wire.*` | `device_tcp_session.*`、`device_tcp_socket.h`、`device_tcp_wire.*` | 认证、分帧、主动状态与重连 |
| `main/vp8_control.cpp`、`main/vp8_control_playback.h` | `playback_control.cpp`、`playback_control.h` | 播放队列、首帧提交、触摸优先 |
| `main/vp8_pairing.h` | `device_pairing.h` | USB 配对、凭据和启动范围 |

`desktop_network_profiles.h`、`desktop_internet.*`、`ota_firmware.*` 等已有职责名称可以直接沿用。目录或头文件移动时同步调整 CMake、Kconfig 引用、设备测试脚本和随包路径。用户界面继续用 Wi-Fi、设备状态、动画、固件升级等功能名称。

## 设备协议不变量

| 边界 | 保持的契约 |
| --- | --- |
| USB 状态 | `STATUS3`、`STATUS3_SUB`、`STATUS3_UNSUB` 和原回复前缀，使用 Status v2 公共载荷。首报、3 秒上报及续订期限维持现有规则。 |
| 认证 TCP | VPL1 帧头、mode 3、认证报文、密钥派生用途字符串、计数与租约继续用现有值。继续在同一连接发送状态及播放。 |
| 播放回执 | VPC1 动作编号、会话与请求序号、`Accepted` 和首帧末段 DMA 完成后的 `Presented`。整理工作仍按当前映射和优先级执行。 |
| 设置与维护 | USB 的 `DESKNET2`、`DESKNET3`、`DESKWEATHER1`、`MEDIA2`、`OTA2` 继续按现有格式收发。管理端此次改名未接入新的 Wi-Fi 列表功能。 |
| 登记、存储和发布 | `VP8PAIR1`、`VPCNET1`、PBP1 类型和验签字节，NVS 的绑定、网络、设备身份、分区及素材身份，以及签名发布清单中的产品标识保持现值。 |

管理端的 JavaScript 文件名、配置键、页面路由、私有运行目录和登记索引名称只在宿主生效。固件只需要同步宿主侧引用的源码路径。Hub 现有 C++ 对拍依赖固件的 `tools/round-pet/vp8-probe/main`。若固件整理后移动这个目录或头文件，通知管理端同步夹具的路径，继续使用原共享字节向量核对。

固件先做设备和宿主编译，核对包入口与共享字节、USB 状态订阅、TCP 认证及独立首帧回执。新构建、真机留驻版本与可回退版本各自记录。按用户安排，真机统一验收等功能齐备后进行。
