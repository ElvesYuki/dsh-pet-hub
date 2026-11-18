# TCP22：事件与持续状态保持评审

TCP22历史提案（2026-11-06）。后续[TCP23](native400-pet-hold.md)已实现显式hold及必要私有limits/采样门禁，默认event保持；以下保留提案时语境，不代表当前仍未实施。

## 已验证现状

同一working/counter在4999ms剩1ms，5000ms shared desired=null、设备模型回local；只有1个BASE/revision1。4500ms出现新counter是新事件，产生新5000ms deadline，9500ms同样到期。人工改为1后旧source不夺回，新counter也因CAS冲突blocked；1000ms页面权限到期后不能自助发新BASE。上述为虚拟时间、真实genuine shared IPC/loopback＋模型，不是ESP长测。

所以TCP21适合有界事件提示，**不是持续同步**；持续working会在5秒后回本地。仅提高TTL不能解决来源活性和控制权边界，120秒来源/页面授权也不能自动变长期。

## 可选hold-state合同（下一实现提案）

- 默认仍event；可信owner显式选择hold-state并单独授当前来源代/实例/组/有限终止时间，不经页面GET/重挂启用。
- 每500ms串行只读采样；保活只适用于0/1/11，并要求当前样本ready且来源活性证据在1500ms内。HTTP成功只证明服务应答，不证明任务语义最近变更；允许相同counter，但须来源适配器给可信接收时间。裸page getState缓存没有采样到达年龄，不能每次调用就伪造新鲜度，未补可信活性证据前不用于hold。
- 当前目标仍是本bridge的command_id/revision、同action、剩余TTL>0且<=2000ms时，才发一个新的5000ms BASE。新BASE是新的有界业务请求，不篡改旧命令deadline，也不是TCP重放续期；权利窗口/来源窗口绝不续期。若已过期，不用旧counter自动重启，需新事件或可信显式重新取得控制。
- 任何人工revision、实例/组换代、source代倒退/冲突、paused、撤权、窗口失效、超时/unsupported即停止保活；尽力撤自己的目标，不取消他人目标，不能撤时按最后有限TTL收敛。
- 发送前核CAS及独立来源/权限余量，保留已有单在途/latest门禁。unknown冻结续租/新状态，仅明确确认原完整body；不按当前时间换TTL/request_id盲试。确认后再检查freshness/ownership/剩余寿命，不能把旧ACK当新保活。
- 来源/权限剩余不足发包预算时不发新租约；服务端仍核独立窗口，不能仅靠本地计时或心跳放宽。需明确提供者如何报告来源window余量，不能错把controls.remaining_ms（页面权限）当来源window。

实现前须补正负向量：same-counter新鲜保持、缓存陈旧停止、目标已过期不复活、人工race CAS、unknown、暂停、撤权/窗口预算边界、close与晚样本、多页重挂无续权。当前CONT01–04只验证既有事件模式及保活必须遵守的边界，不记为hold已实现或生产准入。
