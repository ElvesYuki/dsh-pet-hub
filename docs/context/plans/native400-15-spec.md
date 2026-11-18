# 400-15 Spec：可信provider／原生选源交接与隔离浏览器评审

状态：2026-11-03已完成本片评审/原创离线验证与共享UI真实浏览器范围，见[报告](../../reports/2026-11-03-native400-15.md)。正式broker/DSH身份/native dialog与rc.5动态profile仍未实现或未验；原实施前边界如下。

2026-11-03，实施前。先读AGENTS/README/当前上下文/开发与维护规则、14 API及旧P0/P1宿主报告。不用子智能体，保留修改，不修改现有配置或安装启用插件，不接设备/生产listener/真实素材或固件，不提交推送。新代码MIT、零项目依赖。

## 范围与方案

本片先评审当前安装DSH的真实身份、请求入口与文件对话框契约，不推导“可显示dialog即已验证用户/来源”。只读安装产物（版本/导出/类型/实现摘要和SHA），不读现有profile凭据/运行日志，不启动DSH或Electron，不调用对话框/系统授权。列出身份来源、授权主体、文件路径归属、服务端校验、撤销/期限/重开与不可用时的只读策略；选择推荐下一实现切片，不能用模拟provider取代正式契约。

若已有Playwright与浏览器可用，验证400-14既有构建产物在真实React DOM/浏览器中经临时proxy/UDS/source/journal的闭环。仅新增原创隔离验证harness/检查，不改13/14生产实现，发现实际缺陷再明确最小修复。使用已安装React种子只在忽略目录，不复制外部库入Git、不安装依赖或下载浏览器。默认页面无审阅权限；浏览器自动化的受信侧把随机HttpOnly/SameSite=Strict页会话cookie交接到自有context，server绑定scoped client；无HTTP自授权/任意文件/上传/reopen入口。此为模拟可信交接，不能写成DSH身份/native picker已验。

## 隔离运行与验收

明确启动顺序：新临时私有root/原创28MiB fixture→显式controls service（仅UDS）→动态127.0.0.1自有HTTP proxy/静态React及已构建client→单独浏览器会话/context。fixture信任控制只通过本次进程stdin/私有本地控制文件，不提供浏览器管理API，不使用现有端口/配置/source。拒绝外站请求，安全页不加载CDN/遥测；不从HTTP或DOM发放review凭据/路径。原角色/media/cache不读。

实际DOM验收：未授权只读；受信交接后显式审阅/历史复验、选源安全名/摘要、取消等待真实I/O、响应丢失手动同请求确认、页刷新/卸载不重放或停owner、会话撤销旧页失效/新页交接、unknown历史重开与默认回退。区分原生React实际渲染、真实HTTP/UDS和内部测试故障注入，单列仍未测的DSH加载/身份/原生dialog。截图/端口/页cookie/原始日志只在忽略的本地目录，不复制入公开证据；输出仅闭合布尔/计数/固定版本与安装代码SHA。

先harness宿主负例/独立临时CLI，浏览器按实际refs顺序操作；不得用直接调后端成功代替点击与DOM结果。完成后npm run check（语法）及npm test（含build）。工具不可用时记录真实限制，不安装来补验；交付完整契约/方案/回退与已执行项。

## 回退

关闭本次浏览器context/会话→卸载自有proxy/撤可信页会话→关闭自有owner并等待真实I/O→移除自有临时root/socket与随机页cookie/控制输入。只终止自己创建的进程，不按名称/端口杀进程。故障先放行自有测试gate以等退出，不删journal坏档/残锁来“修复”；需要审阅历史的unknown以新实例恢复，只读回退不修改格式。安装产物仅只读核验，无现有DSH/pet/bridge/固件变更可回滚。真实设备/用途/G0/资源/Flash/TLS/24fps仍独立，外部沿400-06快照。
