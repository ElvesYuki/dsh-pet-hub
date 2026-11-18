/** Read-only synthetic candidate. No transport, actions, image preview or device-control callbacks. */
export function renderObservationPanel(h,review){
 if(!review)return null;
 const phases={requested:'本地已请求',sent:'本地已发送',accepted:'设备接纳报告',downloading:'下载报告',verified:'校验报告',playing:'首帧提交报告',failed:'失败',cancelled:'已取消',ended:'已结束'};
 const maintenance={unknown:'等待设备维护状态',none:'无维护报告',loading:'加载中',verifying:'验证中',saving:'保存中',recovering:'恢复中',blocked:'已阻塞'};
 const saved={saved:'历史保存确认',deferred:'保存延后',failed:'保存失败',outcome_unknown:'保存结果未知，需查询库存'};
 const label=value=>value===null?'未知':value?'可离线使用':'当前不可离线使用';
 return h('section',{'aria-label':'单设备观察离线候选',style:{border:'1px solid #8885',padding:18,borderRadius:12,marginBottom:16}},h('h3',null,'设备观察 · 离线候选 · 非实物'),
  h('p',{role:'note'},'只读合成回执；宿主预览、HTTP成功和素材导入不代表设备播放或保存。'),
  ...review.devices.map(d=>h('article',{key:d.device_id,'aria-label':`${d.device_id} 观察`},h('h4',null,d.device_id),
   h('p',null,`设备会话：${({online:'候选会话在线',offline:'离线，保留历史',diagnostic:'版本不支持，仅诊断'})[d.connection]} · ${d.controlled?'候选控制权有效':'无当前控制权'}`),
   h('p',null,`目标：${d.desired?`动作 ${d.desired.action_id} / revision ${d.desired.revision}${d.desired.is_current?'':'（历史）'}`:'—'} · ${phases[d.request_status]??'尚未请求'}`),
   h('p',null,`播放回执：${d.playback?`${phases[d.playback.phase]}${d.playback.is_current?'':'（历史）'}`:'等待设备报告'}；实际画面：${d.actual?`动作 ${d.actual.action_id} / ${d.actual.origin==='local'?'设备本地':'远端目标'} / ${d.actual.elapsed_ms}ms${d.actual.is_current?'':'（最后观测，非当前）'}${d.actual.approved_asset?'':'（未映射当前批准素材）'}`:'未知'}`),
   h('p',{role:'status'},`${maintenance[d.maintenance]}；${d.display_state==='held_last_valid'?'保留最后有效画面，动画已暂停':d.display_state==='playing'?'画面播放报告已确认':'等待设备画面状态'}`),
   h('p',null,`离线库存：${d.inventory.known?'已确认完整根':'当前性未知'} · ${d.inventory.root_seq===null?'尚无根观测':`最后确认 root ${d.inventory.root_seq}`}`),
   h('details',null,h('summary',null,'每动作离线可用状态'),h('ul',null,...d.inventory.actions.map(a=>h('li',{key:a.action_id},`动作 ${a.action_id}：${label(a.offline_available)}${a.offline_available===null&&a.last_confirmed_available!==null?`（最后确认：${label(a.last_confirmed_available)}）`:''}`)))),
   h('p',null,'保存历史不保证当前库存；淘汰或断连后以最新完整库存为准。'),
   h('ul',{'aria-label':'保存历史'},...d.storage.map((s,i)=>h('li',{key:i},`动作 ${s.action_id} / revision ${s.revision} · ${saved[s.status]}${s.root_seq?` · root ${s.root_seq}`:''}${s.is_current?'':'（旧会话）'}`)))
  )));
}
