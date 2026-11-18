# TCP-14 Diff（实施前）

- 新runtime/native400-usb-process-consumer：默认拒绝、显式入口pin/参数、安全输出转换、自有进程组信号与实际close。
- TCP13 private config session新增内部控制capability领取；新runtime/native400-config-owner提供单活/pending与退出屏障。
- service仅LAN赢家新增lanConfig本地句柄，cleanup等待TCP与config两屏障，失败保UDS/503；旧IPC/default及deviceTransport=false不变。
- 新原创child fixture/专项/CLI与报告/结构化证据；更新G0及最新端侧部分真机证据与归档，MIT登记。零新依赖，不执行固件工具、实际USB/STA/ESP或调整生产服务/配置，不提交推送。

收尾修复（已实施复验）：第二次全量遇到既有wall-memory smoke的incomplete_window。定时器可能在小数毫秒截止前返回；每个采样tick已改为单调时钟循环等待真实截止，不放宽窗口/间隔门槛，不重试测量或伪造时间。既有墙钟真实IPC专项3/3通过，最终顺序check/test及build通过。

实施状态：28专项/隔离CLI、墙钟专项3/3、最终check与含build全量1656通过；三次顺序全量包含一次旧墙钟边界失败及修复，详见报告。仅原创Node进程/临时文件/UDS，本轮未运行终端Python/USB/STA/ESP。上游部分真机证据独立记账。见[报告](../../reports/2026-11-05-tcp14.md)。
