import {native400ReviewEnvelope,native400StartAck,native400CancelAck} from '../core/native400-review-access.mjs';
const reviewProtocol='native400-source-review-controls/1';
/** Shared review component. Private references and uncertain requests stay in the
 * component closure; render state contains only allowlisted presentation values.
 * Polling never writes. Unmount aborts own HTTP, not a shared admitted operation. */
export function makeNative400ReviewControls(React,transport){
 const {createElement:h,useState,useEffect}=React;
 return function Native400ReviewControls(){
  const [view,setView]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
  const [local]=useState(()=>({abort:new AbortController(),generation:0,grant:null,pending:null,busy:false,identity:null,stale:false,readError:false}));
  function ingest(raw){const next=native400ReviewEnvelope(raw),identity=next.controls.service_instance_id+':'+next.controls.session?.reviewer_session_id;
   if(local.identity!==null&&local.identity!==identity){local.stale=true;local.grant=null;setView(null);setMessage('审阅会话已变化，请重新打开页面并由可信宿主授权。');return false;}
   local.identity=identity;local.grant=next.selection;setView({controls:next.controls,sourceReview:next.sourceReview});return true;
  }
  async function refresh(){if(local.busy)return;const gen=++local.generation;try{const raw=await transport.reviewStatus(local.abort.signal);if(!local.abort.signal.aborted&&gen===local.generation&&!local.stale){if(ingest(raw)&&local.readError&&!local.pending){local.readError=false;setMessage('');}}}
   catch(e){if(!local.abort.signal.aborted&&gen===local.generation){local.grant=null;local.readError=true;setView(null);setMessage([401,403,404].includes(e.status)?'当前页面只读，需可信宿主授权并选择来源文件。':'无法读取审阅状态；未自动重试操作。');}}
  }
  useEffect(()=>{let timer;async function poll(){await refresh();if(!local.abort.signal.aborted)timer=setTimeout(poll,1000);}void poll();return()=>{local.abort.abort();clearTimeout(timer);local.grant=null;};},[]);
  async function execute(kind){
   if(local.abort.signal.aborted||local.busy||local.stale)return;
   if(!local.pending){const c=view?.controls;if(!c?.session?.active)return;
    if(kind==='cancel'){if(!c.active_job)return;local.pending={kind:'cancel',body:{protocol:reviewProtocol,service_instance_id:c.service_instance_id,reviewer_session_id:c.session.reviewer_session_id,job_id:c.active_job.job_id}};}
    else{const g=local.grant;if(!g||c.phase!=='ready'||view.sourceReview.phase==='uncertain'||kind==='revalidate'&&!view.sourceReview.history)return;
     const request_id=Array.from(globalThis.crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
     local.pending={kind:'start',body:{protocol:reviewProtocol,service_instance_id:g.service_instance_id,reviewer_session_id:g.reviewer_session_id,selection_id:g.selection_id,request_seq:g.next_request_seq,request_id,expected_revision:g.expected_revision,kind}};local.grant=null;}
   }
   const request=local.pending;local.busy=true;local.generation++;setBusy(true);local.readError=false;setMessage('');
   try{const result=await transport[request.kind==='start'?'reviewStart':'reviewCancel'](request.body,local.abort.signal);if(local.abort.signal.aborted)return;
    if(request.kind==='start')native400StartAck(result,request.body);else native400CancelAck(result,request.body);
    local.pending=null;setUncertain(false);setMessage(request.kind==='start'?'已受理；仍需等待实际检查与持久结果。':'已请求取消；以实际 I/O 退出状态为准。');
   }catch(e){if(local.abort.signal.aborted)return;
    if([400,401,403,404,409,413].includes(e.status)){local.pending=null;setUncertain(false);setMessage('请求已拒绝，请核对最新状态与可信宿主授权。');}
    else{setUncertain(true);setMessage('操作结果未确认。可用原请求确认一次；不会自动重试或生成新操作。');}
   }finally{local.busy=false;if(!local.abort.signal.aborted){setBusy(false);await refresh();}}
  }
  const c=view?.controls,blocked=busy||uncertain||local.stale||!c?.session?.active||c.phase==='blocked',ready=!blocked&&c?.phase==='ready';
  return h('section',{'aria-label':'来源审阅操作'},h('h3',null,'来源审阅操作 · 临时离线候选'),
   h('p',{role:'note'},'来源由可信宿主选择；页面不提供文件路径或设备操作。'),
   message?h('p',{role:'status'},message):null,
   c?h('div',null,h('p',null,`阶段：${c.phase} · 来源：${c.selection?.source_name??c.active_job?.source_name??'未选择'}`),
    c.selection?h('p',null,`批准输入 SHA256：${c.selection.approval_inputs_sha256}`):null,
    c.active_job?h('p',null,`${c.active_job.cancel_requested?'取消已请求，等待实际 I/O 退出':'后台检查进行中'}；尚未退出`):null,
    c.last_job?h('p',null,`最近任务：${c.last_job.status} · I/O 已退出${c.last_job.error?' · '+c.last_job.error:''}`):null,
    c.phase==='blocked'?h('p',{role:'alert'},'结果未知或已阻塞；需可信宿主关闭后独立重开核定，页面不能修复。'):null):null,
   h('button',{type:'button',disabled:!ready,onClick:()=>execute('review')},'开始审阅'),
   h('button',{type:'button',disabled:!ready||!view?.sourceReview.history,onClick:()=>execute('revalidate')},'按历史复验'),
   h('button',{type:'button',disabled:blocked||!c?.active_job||c.active_job.cancel_requested,onClick:()=>execute('cancel')},'请求取消'),
   uncertain?h('button',{type:'button',disabled:busy||local.stale,onClick:()=>execute('confirm')},'确认上次请求'):null);
 };
}
