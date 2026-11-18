/** Shared read-only presentation; accepts only the proposal's public snapshot,
 * renders selected text fields, never references, callback handles or raw reports. */
export function renderNative400TcpObservation(h,v){
 if(v?.profile!=='native400-tcp-observation-proposal/1'||v.wire_supported!==false||v.authenticated!==false||v.device_evidence!==false)return null;
 const action=x=>[0,1,4,11].includes(x)?String(x):'未知',origin=x=>({remote:'远端缓存动作',touch:'本地触摸',local:'本地策略'})[x]??'未知';
 return h('section',{'aria-label':'TCP状态投影候选'},h('h3',null,'TCP 状态投影 · 离线提案'),h('p',null,'扩展尚未联合定版；以下仅为未认证报告的宿主投影。'),
 h('p',null,`目标：${v.desired?action(v.desired.action):'无有效远端目标'}`),
 h('p',null,v.verified?.integrity==='file_sha_metadata_frame0_crc'?`动作 ${action(v.verified.action)}：设备报告文件SHA、元数据与首帧CRC完成；未证明全媒体验证。`:'尚无对应的设备校验报告。'),
 h('p',null,v.actual?`${origin(v.actual.origin)} / ${action(v.actual.action)} / ${v.actual.frame0_committed===true?'报告首帧已提交':'尚无首帧提交'}`:'当前画面未知'),
 v.history?h('p',null,`历史观察：${origin(v.history.origin)} / ${action(v.history.action)}`):null,
 v.phase==='blocked'?h('p',{role:'alert'},'当前报告链已失效，需可信新建投影；未恢复为正在播放。'):null);
}
