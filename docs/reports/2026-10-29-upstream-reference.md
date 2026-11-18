# dsh-pet 上游参考补核

日期：2026-10-29。直接参考用户指定的 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)，而非仅依赖本机安装产物。通过GitHub API解析main，固定本轮参考提交 **8963384e33400d0c83965bd82f98bd8f81d22863**。只下载少量文档/源码到系统临时目录；没有clone动画库、运行安装脚本或升级pet。

## 公开接口与更正

之前“没有找到公开状态服务”的结论不完整。已直接阅读：

- [API.md](https://github.com/PC2005-cloud/dsh-pet/blob/8963384e33400d0c83965bd82f98bd8f81d22863/API.md)：HTTP接口概览。
- [openapi.yaml](https://github.com/PC2005-cloud/dsh-pet/blob/8963384e33400d0c83965bd82f98bd8f81d22863/openapi.yaml)：公开HTTP完整契约，state支持普通/长轮询。
- [CORDIS-API.md](https://github.com/PC2005-cloud/dsh-pet/blob/8963384e33400d0c83965bd82f98bd8f81d22863/CORDIS-API.md)和[CORDIS.md](https://github.com/PC2005-cloud/dsh-pet/blob/8963384e33400d0c83965bd82f98bd8f81d22863/CORDIS.md)：公开服务概览及完整契约。
- [client/app.ts](https://github.com/PC2005-cloud/dsh-pet/blob/8963384e33400d0c83965bd82f98bd8f81d22863/dsh-pet/src/client/app.ts)：实际provide成员与能力探测说明。
- [package.json](https://github.com/PC2005-cloud/dsh-pet/blob/8963384e33400d0c83965bd82f98bd8f81d22863/dsh-pet/package.json)与[cordis.patch.yml](https://github.com/PC2005-cloud/dsh-pet/blob/8963384e33400d0c83965bd82f98bd8f81d22863/dsh-pet/cordis.patch.yml)：双端发布、bundle挂载与生命周期入口。

| 层 | 上游公开接口 | hub使用策略 |
| --- | --- | --- |
| 同一DSH页面 | ctx.get('petApi7340').getState() | 优先能力探测，仅读取workStatus；不发额外HTTP请求 |
| 宿主Cordis容器 | 同名服务的balance/voice分组 | 没有任务状态getState，不能跨容器调用页面服务 |
| 宿主/独立进程 | GET /dsh-pet-7340/state | 使用公开HTTP契约及受限loopback适配 |

getState给共享快照引用，不能修改；null表示首拍未到，不等于空闲。menuEvents读取会消费，不用于本项目状态来源。pose/progress是桌宠表现，不是实体设备控制或播放确认。服务没有公开的任务状态订阅事件；不要因此重复监听session/event。

## 同版本实际差异

上游package和本机安装包都写0.3.8，但本机src/client/app.ts:85实际只provide `{pose,progress}`；上游提供 `{getState,menuEvents,pose,progress}`，且源码明确要求单独探测成员。不能把上游main等同已发布包或当前运行实例。

本机app.ts SHA-256：89512d91eab1de73037f5c93f22acfe1ca6deb00135e7e9744ba9d5cfee44075。
上游app.ts SHA-256：f878b4d486fe097090e2f14a8d1b0c79b1f165860f239414cd524c38246b8c9d。

因此保留已实测HTTP来源，同时新增可选readPetPageState入口；服务缺成员返回unsupported，首拍未到返回pending，有快照仅返回新建语义对象，异常/schema未知明确抛错。本轮没有自动切换运行源、升级pet或在真实页面加载该入口。后续装配只启用一条主来源，避免重复转发；页面关闭后后台服务可独立读取HTTP，不能依赖页面持续存活。

## 架构参考的具体落点

参考其host/client/shared/standalone分层、name/inject/apply和ctx.effect资源释放、client模块工厂及settings.section注入方式。hub保留独立core/runtime/ui与DSH壳，避免将DSH上下文带入设备核心。上游bundle patch使用与包名一致的唯一entry id；未来hub需自己的id，不能复用dsh-pet。peerDependencies由宿主提供，不能直接复制其依赖范围当作hub已验证版本。

上游现有Electron helper/standalone说明平台能力可以由进程外壳提供；它并未证明hub已具备BLE配网。BLE仍按现有权限专项方案验证。参考项目实现模式不等于复制桌宠动画控制、配置或其专用管道。

## 验证及下一入口

新增公开页面服务适配的宿主测试：旧成员/未启用、首拍null、语义过滤、冻结共享引用不被修改、服务异常。静态检查和全部6组宿主测试通过；真实页面服务仍待隔离宿主验证，真实HTTP结论沿用P0报告。

下一步P1先明确“DSH页面公开服务”和“后台公开HTTP”的装配选择、源状态与故障策略，再构建client入口与隔离宿主包。所有真实集成沿用P0方案和回退，不自动安装/启用或改动正在运行的配置。
