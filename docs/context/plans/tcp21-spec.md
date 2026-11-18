# TCP21 Spec：0.2.2候选与pet→shared受控桥接（实施前）

2026-11-06。读取终端交接/预检/真实framed-peer报告及本仓库规则。范围仅代码、静态安装核对、构建和临时宿主验证；不启动任何DSH profile、不安装插件、不访问ESP或当前pet服务、不猜端点。pet实际getState可用性仍须在以后获准的宿主上下文探测；缺失unsupported、首拍null为pending，均不得当idle。

安装已为DSH/Connection0.2.2-rc.1、Cordis4.1.0、Schemastery3.19.0。复核ASAR JS及frontend bundle，明确实际React字符串/slots和Config静态契约，不把候选版本声明等同动态准入。建立独立dist-dsh022候选，精确peer，单Connection bundle；原dist/rc.3/raw保持。新入口默认连接既有服务，不发权、不启动监听，Connection工厂仍需可信resolve。

新增默认关闭的Node pet共享桥接，输入只读read函数（可用已有readPetPageState或readPetState包装）、已经独立授权的shared scoped client、可信expectedRevision、TTL。来源不经LAN service的source/page，不修改source=disabled门禁，不调用owner.base。显式start串行定时poll；同一counter/state无副作用，不自动续TTL；counter倒退或同counter异state封锁本来源代，重建需新可信选择。ready state=null才按既有scheduler映射idle0，thinking1/working11；其他43/58/7/55不支持并撤本桥旧目标。pending/unsupported/unavailable/读错撤自己的目标回本地；没有权限则保原TTL收敛，不自助续权。

每次新命令读原controls envelope，核shared及固定实例/组和expectedRevision，复用seq/request_id/CAS/body/ACK；外部手动更新或服务换代停止自动接管。unknown冻结新源读/新命令，仅可信confirm对原完整body幂等确认；不得因新状态或GET/重挂自动重发。重复事件不续动作TTL。后台来源桥close停止定时器、丢弃晚读并尝试撤仍由自己持有的目标，不end共享组/取消他人意图；未知命令不盲目取消，最多按原TTL收敛。页面卸载不关闭后台桥，可信source owner负责close。

验收：真实genuine audit/window/shared IPC/loopback，reader模拟公开只读状态；覆盖三映射、重复/倒退/冲突、pending/null/unsupported、未知确认、权限到期、外部修改、旧读/close/定时串行与资源清理。真实DSH/pet变化和ESP自动链路不在本轮执行，终端已通过的手动shared链路按上游报告单独记账。check/test/build、新候选核对、上下文更新归档。回退关闭桥、await当前poll、按原end/revoke清自己的授权/窗口；不清别人组，unknown保现场；删独立候选即可回旧包，无profile/持久格式迁移。

实施状态：本轮候选与宿主桥接已完成；16专项/隔离CLI、check及含构建全量1820通过，旧/新独立候选均构建通过。真实pet与新DSH动态profile/Config/slots尚待，不把模型成功作实际自动闭环。
