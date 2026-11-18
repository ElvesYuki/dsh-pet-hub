# 签名 DSH Desktop rc.3 只读设备查询 Spec

2026-11-17。使用已安装的 DeepSeek Harness 0.2.2-rc.3。将签名 App 的 DSH_HOME 和 Electron userData 指向同一私有临时根下的不同目录，实测目录归属后再操作界面。仅临时 Desktop profile 装载 Hub，既有 pet 及默认配置保持。

Desktop 的 `dsh-app://app` 经主进程转发。该层校验 app origin 后剥离 Origin，附加已认证 Host cookie。原 Web 同源 POST 校验仍保留。rc.3 Connection Fetch 对精确路由校验 owner principal，桌面设置页另走该传输，并继续要求私有 Hub 授权码、instance 与 revision。配置显式开启，路由及对应 Hub 只允许查询，运行期发布服务、安装和升级入口均不可用。Desktop 对动作库不作推断。

先用独立替身按真实设置页验证非法授权、合法授权和单次 STATUS2。只有固件交接标志就绪及该 USB 空闲才切到独立的真机只读 owner。只点一次查询，记录收到的版本、槽和命令，保留脱敏证据。若断线或未知不重试。清理临时 Desktop、Hub 与调试入口，验证原 profile 摘要和 USB 释放。
