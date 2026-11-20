# round-pet VP8 动作 1 更新候选契约

适用板为 Waveshare ESP32-S3-Touch-AMOLED-1.75C-EN。设备需启用 `VP8_ACTION_UPDATE`。报文协议为 UTF-8 的 ASCII 子集，每行以 LF 结束。设备应用串口可能同时输出播放日志，调用端只解析 `@VP8_UPDATE ` 前缀。调用端等待一项更新结束再启动下一项。

```text
STATUS1
UPDATE1 <host-ipv4> <http-port> <ssid-hex> <password-hex-or-dash>
CANCEL1
SHOW1
```

- `STATUS1` 返回 `STATUS committed=0|1 busy=0|1`。提交状态属于这次构建内固定的动作 1 对象。启动时见到同样一行表示初始化完毕。
- `UPDATE1` 接收后先返回 `ACCEPTED`。固件向同网段端点发起 `GET /vp8/update/1-400.ivf`。HTTP 200、唯一且精确的 `Content-Length`、无分块编码、无压缩或 `identity`。Wi‑Fi 凭证仅当次使用。该测试入口由本机 USB 控制，HTTP 服务仅发布同一个预先确认的对象。
- `SAVED id=1 existing=0` 表示读回确认、SHA 与 IVF 校验及提交标记写入均成功。`existing=1` 说明对象早已保存，本次无需 HTTP 请求。
- `CANCEL1` 可在提交前中止正在进行的更新，收到 `CANCELLED` 后可发起新请求。失败使用 `FAILED reason=...`，忙碌时返回 `BUSY`。若在保存过程中串口断开，重连后用 `STATUS1` 查询结果。
- `SHOW1` 在下一次动作边界申请播放动作 1，实体触摸挥手优先。`PLAY id=1 committed=1` 表示选中新版，完成播放还需等待 `@VP8_RESULT 1-400`。

本轮对象是 400×400、VP8 profile 1、IVF、24 fps 源、241 帧、418,536 B，SHA-256 为 `c47eae037765066dfd9c5c632ee32019487d22f831a8e9a83e4ab1a51710838c`。与原动作使用同一份源和同一裁切规则。

接入管理端时先用 `STATUS1` 识别该候选，校验文件身份，只有明确收到 `SAVED` 或重新查询得到 `committed=1` 时才显示已保存。历史适配器位于源仓交接提交的 `tools/round-pet/vp8-probe/action_update_host.py`。PMA1 现有入口仍适用于 PET4。后续多动作与现场替换需要共同定义 VP8 素材身份及正式控制通道。
