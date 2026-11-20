# VP8 独立天气地点候选

2026-11-19。DSH `0.2.2-rc.3` 的组合主包 `0.0.7` 和登记包 `0.0.4` 已提供独立「天气地点」区。[Spec](../context/plans/vp8-desktop-weather-spec.md) · [Diff](../context/plans/vp8-desktop-weather-diff.md)

## 行为

- 用户提交城市查询后，宿主只把搜索词和固定选项发送到 Open-Meteo。页面显示加载、空结果或失败，手动选择前列出同名地点的行政区、国家或地区和坐标。搜索无需连接 USB，结果只保留在当前页。公开端点遵守非商业 API 条款，地点来源为 GeoNames。[Geocoding API](https://open-meteo.com/en/docs/geocoding-api) · [服务条款](https://open-meteo.com/en/terms)
- 保存前在同一独占串口核对持久绑定、Keychain、revision 和只读天气能力。SET 只发两个 WGS84 万分之一度整数。设备状态只返回配置有无和坐标。旧固件只读探测，失败无降级写入。
- `saved` 与 `cleared` 是设备持久回执。换城后的联网和天气更新由固件执行。写入超时不重发，直到一次 INFO 成功时恢复页面写按钮。清除使设备停用旧兼容天气地点，现有 Wi-Fi 输入及 NTP、原设备查询沿用。

## 离线验证

- 使用合成同名地点，核对安全查询参数、受限响应读取、无结果、失败、取消和旧搜索隔离。解包候选后驱动设置组件，验证精确选项、只提交经纬度、写入未知和只读恢复。
- Node/C++ 用只读固件头文件对拍 DESKWEATHER1 的命令包络和坐标解析，覆盖 INFO、SET、CLEAR、回读和坐标边界。回执由离线夹具提供。共享 USB 测试覆盖短写、分片、错误坐标回执、错版本和与 Wi-Fi 的并发互斥。搜索可在设备忙时继续。
- `npm run check`、`npm run build`、`npm test` 和 `git diff --check` 通过。全量 2,099 项通过，无失败或跳过。候选包独立构建并检查文件清单。

| 候选包 | SHA-256 |
| --- | --- |
| `dsh-pet-hub-0.0.7.tgz` | `f192240fbbb450e74bb717234b671574bfd3a66fc45b8037ce05394eb34c177c` |
| `dsh-pet-hub-boot-review-0.0.4.tgz` | `3fe4d142447c586c1cd5290361baba9960696f1884e5567256278cf9da2e4d3a` |

## 现场与回退

固件仓库 `apps/round-pet/reports/2026-11-19-vp8-weather-city.md` 记录 `0.1.26` 已构建验签，当前板上 `0.1.25` 尚无独立天气地点。真实城市由用户在最终设置页主动搜索。后续验收应覆盖实际搜索结果、固件持久化、圆屏天气、清除和原时钟／Wi-Fi 状态。本轮未部署候选、访问真板或修改 DSH profile。

主包与登记包可成对回退到 `0.0.6`／`0.0.3`，退回后按旧配置流程使用设备；板上独立地点由固件保留。
