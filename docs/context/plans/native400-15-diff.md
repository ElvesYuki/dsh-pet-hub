# 400-15 Diff（实施前）

状态：2026-11-03已完成本片评审/原创离线验证与共享UI真实浏览器范围，见[报告](../../reports/2026-11-03-native400-15.md)。正式broker/DSH身份/native dialog与rc.5动态profile仍未实现或未验；原实施前边界如下。

- docs/protocol/native400-provider-review：安装DSH身份/请求边界/原生对话框事实、证据SHA、交接/撤销状态机、推荐路径/失败关闭/独立profile后续执行与回退。
- tests/fixtures：仅自有临时浏览器harness，复用14 service/channel/proxy及原选择/reader/journal，不加生产授权入口。
- tests/native400-15及verify CLI：harness/可信控制边界的宿主负例与实际I/O退出，浏览器证据单列。
- 忽略目录：安装代码只读审阅、React种子/真实浏览器截图/原始日志及私有控制输入；不入Git，不安装依赖。
- docs/reports/闭合vectors/当前摘要/下一入口/主题history：核定已验与未验，替换并归档“下一15评审”与旧最新验证。

预期不改packages/apps生产代码、wire/recipe/selector/controller/reader/journal、依赖/锁文件、现有DSH/pet/bridge/固件。若真实浏览器发现缺陷，先记录再最小修复与对应回归，不假定本轮需构造正式DSH权限provider或OS dialog。
