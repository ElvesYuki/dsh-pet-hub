# S2 Diff（实现前）

- 新增packages/simulator/session.mjs，复用core状态机，独立合成素材/证明，仅供显式模拟装配。
- runtime/service添加默认关闭的deviceMode及注入factory，白名单模拟IPC；CLI显式动态导入模拟模块。status新增白名单摘要，不修改真实transport。
- plugin host增加模拟意图/控制代理、错误码和instance代数转发；client与共享UI增加模拟标签/设备卡/交互，保留默认空态。
- 新增跨进程IPC/代理/模型回归及独立浏览器测试台，不安装插件；build继续排除simulator，零新增第三方依赖。
- 更新S2结果和未覆盖项；不写现有profile/pet/bridge，不改固件，不提交推送。
