# 圆屏互联网校时与天气

当前 Hub 离线候选通过已绑定 USB 管理多 Wi-Fi 和独立天气地点。历史单网络请求仍由同一后端解析。上板与日常设置页联调留到统一验收。

## 多网络管理

```text
DESKNET3 <id> LIST
DESKNET3 <id> SET <ssid_hex> <password_hex_or_-> <ntp_host> <weather_host_or_-> <utc_minutes> <lat_times_10000> <lon_times_10000>
DESKNET3 <id> REMOVE <ssid_hex>
@VP8_DESKNET3 id=<id> status=<ok|saved|removed> mode=<online|offline> link=<off|connecting|online|unavailable> active=<ssid_hex_or_-> profiles=<comma_separated_ssid_hex_or_->
@VP8_DESKNET3 id=<id> status=<busy|invalid|storage_failed|full|missing>
```

请求 ID 为 8 个小写十六进制字符。列表最多四项，按设备尝试顺序返回，每项原始 SSID 为 1–32 字节。连接中和离线时 `active` 为 `-`，已连接时指向列表中的一项。更新相同 SSID 保持位置，移除只作用于该项。SET 同时提交全局 NTP、UTC 偏移及天气连接参数，独立天气地点仍用下节协议。LIST 只回传状态与 SSID，设备本地菜单控制在线模式。

桌面候选的绑定路由以二进制传送凭证，元数据以独立的 `version: 3` 选择列表契约，省略时进入旧单网络入口。LIST 失败后的旧 INFO 仅供展示。写入前在同一已核对的串口执行 LIST，收到匹配 `saved` 或 `removed` 才更新设备列表。无写入回执时页面要求重新读取，避免自动重试和旧 CLEAR 清空整个列表。 [Spec／Diff](../../context/plans/wifi-profiles-and-dsh-motion.md)

固件构建开启 `VP8_DESKTOP_INTERNET`。通过可信 USB 维护口写入私有 Wi-Fi、时间主机、UTC 偏移和天气位置。重新上电沿用配置。USB 不参与日常同步。

私有 JSON 包含 `ssid`、`password`、`ntp_server`、`utc_offset_minutes`。启用天气时追加 `weather_host`、`latitude`、`longitude`。时间服务器和天气主机填 DNS 主机名。UTC 偏移按分钟配置，例如东八区为 480。固定偏移在旅行或夏令时变化时重新设置。天气主机使用兼容 Open-Meteo `/v1/forecast` 的接口，固件发送用户配置的坐标精度为小数点后四位。[天气接口](https://open-meteo.com/en/docs)

配置指令是 `DESKNET1 <ssid_hex> <password_hex_or_-> <ntp_host> <weather_host_or_-> <utc_minutes> <lat_times_10000> <lon_times_10000>`。删除指定配置用 `DESKNET1 CLEAR`。应答为 `@VP8_DESKNET1 CONFIGURED|CLEARED|BUSY|INVALID|STORAGE_FAILED`。生成命令的宿主工具禁止输出配置内容。配置以 `vp8_desktop/net_v1` 保存，和绑定记录分开。更改或清除配置立即使旧桌面时间及天气无效，电量查询继续工作。

## DSH 页面使用的关联回执

```text
DESKNET2 <id> INFO
DESKNET2 <id> SET <ssid_hex> <password_hex_or_-> <ntp_host> <weather_host_or_-> <utc_minutes> <lat_times_10000> <lon_times_10000>
DESKNET2 <id> CLEAR
@VP8_DESKNET2 id=<id> status=<ok|saved|cleared> configured=<0|1> link=<off|connecting|online|unavailable>
@VP8_DESKNET2 id=<id> status=<busy|invalid|storage_failed>
```

请求 ID 为 8 个小写十六进制字符。INFO 为只读，回执只包含配置有无和连接状态。SET 与 CLEAR 由页面按钮显式发起，Hub 使用同一条已经核对设备绑定的独占串口。SET 收到 `saved` 表示已写入设备 NVS，联网状态另用 INFO 观察。USB 传送密码只做当次写入，状态响应、运行日志及页面状态快照不包含凭据。无回执时保存结果未知，管理端可以查询状态并让用户决定是否再次保存。

设备连接路由器后使用 ESP-NETIF SNTP。获取合理 UTC 时间后启动天气 HTTPS 请求，使用平台证书包校验服务端。天气正常每 30 分钟更新，请求失败两分钟后重试，已有天气在六小时后隐藏。固件只接纳完整、有界、带有效观测时间的摄氏天气。离线时，已同步的墙钟由设备单调时间延续，专注计时从头到尾使用单调时间。

相同 Wi-Fi 的 OTA 和素材维护复用已连接的 STA，暂停桌面 HTTPS 请求。未配置长期 Wi-Fi 时，OTA 沿用原来的临时 STA。设备状态和播放走 [认证 TCP](tcp-session.md)。

## 独立天气地点

```text
DESKWEATHER1 <id> INFO
DESKWEATHER1 <id> SET <lat_e4> <lon_e4>
DESKWEATHER1 <id> CLEAR
@VP8_DESKWEATHER1 id=<id> status=<ok|saved> configured=1 lat_e4=<lat_e4> lon_e4=<lon_e4>
@VP8_DESKWEATHER1 id=<id> status=<ok|cleared> configured=0
@VP8_DESKWEATHER1 id=<id> status=<busy|invalid|storage_failed>
```

所有命令以 LF 结尾。请求 ID 为 8 个小写十六进制字符。SET 使用 WGS84 有符号整数经纬度，纬度范围 ±900000、经度 ±1800000，单位万分之一度。INFO 返回有效地点，含旧配置里的天气位置。只返回配置状态和坐标。SET、CLEAR 回执在设备持久保存后返回，与是否联网或已取得天气无关。Hub 使用既有 USB 绑定校验和同一独占串口；若保存超时，可先读 INFO 复核，不自动发送第二次写请求。

新地点独立保存在 `vp8_desktop/weather_v1`。SET 后由设备向 `api.open-meteo.com` 请求天气。CLEAR 记为显式关闭，并屏蔽此前嵌在 Wi-Fi 配置中的天气地点。历史记录在没有独立设置时依旧生效。清除 Wi-Fi 配置会断开联网，保留独立的天气地点。更改独立地点会立即隐藏旧天气并重启天气请求，STA、时钟及电量叠层分别依照原状态继续运行。

损坏的独立地点记录按未配置回报，设备允许用户重新选择并保存。实际存储访问失败返回 `storage_failed`。
