# 设备固件

日常圆屏入口在 `devices/esp32s3-touch-amoled-175c/`。板级驱动和分区位于设备目录。共用播放与协议头文件位于 `components/`。Hub 和固件共同维护 [设备协议与字节向量](../docs/protocol/firmware/README.md)。[导入来源与许可](SOURCE.md)

| 依赖 | 锁定版本 |
| --- | --- |
| ESP-IDF | 6.0.2，`7101770dc6db2667b3c477cc31365dd1acd6db4e` |
| Xtensa GCC | 15.2.0，`esp-15.2.0_20251204` |
| CMake / Ninja | 4.0.3 / 1.12.1 |
| Muse | `7b302e37561652eefcc8a4d58085de6f7f800f29`，只读 checkout |
| ESP-IDF 组件 | 设备目录的 `dependencies.lock` |

激活 ESP-IDF 6.0.2 后，在仓库根目录运行以下命令。构建目录可放私有临时位置。版本作为显式发布元数据传入。日常应用从板上缓存读取素材，编译只需工具链和固定依赖。旧诊断构建需要私有输入，见 [400×400 规格](../media/profiles/400x400/README.md)。

```sh
sh firmware/tools/build-device.sh "$BUILD_DIR" "$MUSE_CHECKOUT" 0.1.40-l-battery-usb-pair-test
sh firmware/tools/test-host.sh "$HOST_WORK_DIR"
sh firmware/tools/test-network.sh "$NETWORK_WORK_DIR"
npm run check
npm test
```

`test-host.sh` 用本机 C++20、ASan／UBSan 和 Python 3 运行玩法规则及播放回环。 `test-network.sh` 使用锁定 ESP-IDF 的 PSA 实现，运行实际 Node／C++ loopback 与 USB 状态向量。Hub 的 USB 配对 C++ 对拍还需要本机 OpenSSL 开发文件，macOS 可用 `OPENSSL_PREFIX` 指定路径。

构建输出是未签名候选。真机留驻版本和现场回退以验证记录为准。使用现有签名发布和部署流程前，先核对目标设备、分区与可用回退。迁移保留原仓固定提交和现场镜像，详见 [验证与回退](../docs/reports/2026-11-20-firmware-repository-migration.md)。
