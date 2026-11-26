# 固件来源

1.75C-EN 圆屏产品源码从 `ai-embedded-studio` 的 `b04a1920f107de66bbe3acf40c3a158b65c871d3` 导入。源提交仍可用于迁移前构建与回退。

主入口来自 `tools/round-pet/vp8-probe`，板级依赖来自 `boards/esp32s3-touch-amoled-175c`，共用协议和绑定依赖来自 `apps/round-pet/common` 与相应设备目录。USB 登记宿主测试的 OpenSSL 适配取自同一源仓的 `4b3ce3c4a73a6884fe5d7190d19f2a679a9fb71d`。

源仓代码采用 [Apache 2.0](LICENSE)。圆屏驱动中的 Waveshare 文件保留其 [许可](devices/esp32s3-touch-amoled-175c/board/round_display/LICENSE-Waveshare) 与原有声明。来自 Source Han Sans 和 Montserrat 的字体内容保留 [各自 OFL](licenses/)。Muse 解码器与转换代码由构建读取独立固定提交，ESP-IDF 及托管组件按各自许可与锁文件管理。素材边界见 [400×400 规格](../media/profiles/400x400/README.md)。

圆屏局域网发现使用 ESP Component Registry 的 `espressif/mdns` `1.11.3`，Apache 2.0。以设备目录锁文件中的组件摘要为准，源码由构建读取。[组件来源](https://components.espressif.com/components/espressif/mdns/versions/1.11.3)
