import {makeNative400NodeControls} from './native400-node-controls.mjs';
import {makeDeviceUpdatePanel} from './device-update-panel.mjs';
import {makeNative400ReviewControls} from './native400-review-controls.mjs';
import {publicNative400SourceReviewView} from '../core/native400-source-review-view.mjs';
import {renderNative400SourceReview} from './native400-source-review.mjs';
import {makeFramePreview} from './frame-preview.mjs';
import {publicObservationView} from '../core/observation-view.mjs';
import {renderObservationPanel} from './round-pet-observations.mjs';
import {publicAssemblyView} from '../core/assembly-view.mjs';
/** Shared allowlist presentation model; no IPC credentials or device wire context. */
export function hubViewModel(status) {
  const simulation=status?.deviceMode==='simulation' && status?.synthetic===true;
  let observationReview=null,observationError=false;try{observationReview=publicObservationView(status?.observationReview);}catch{observationError=true;}
  let assemblyReview=null,assemblyError=false;try{assemblyReview=publicAssemblyView(status?.assemblyReview);}catch{assemblyError=true;}
  let sourceReview=null,sourceReviewError=false;try{sourceReview=publicNative400SourceReviewView(status?.sourceReview);}catch{sourceReviewError=true;}
  return { sourceReview,sourceReviewError,title:status?.displayName ?? '实体宠物设备',phase:sourceReview?'400 · 来源文件审阅候选':assemblyReview?'A5 · 默认关闭装配候选':observationReview?'A3 · 观察离线候选':simulation?'S2 · 模拟设备':'P1 · 管理骨架',connection:status?'服务已连接':'服务未连接',
    assemblyReview,assemblyError,observationReview,observationError,roles:status?.roles??null,catalog:status?.catalog??null,source:status?.source ?? {mode:'disabled',status:'unavailable',state:null},simulation,
    time_ms:simulation?status.simulation.time_ms:0,
    devices:simulation?(status.devices ?? []).filter(d=>d.synthetic===true).map(d=>Object.fromEntries(['device_id','name','binding','connection','controlled','desired','actual','phase','mode','intent_revision','material','material_playback'].map(k=>[k,d[k]]))):[],pairingAvailable:false };
}
export function simulationRequest(status,clientId,action,requestId) {
  if(status?.deviceMode!=='simulation' || status.synthetic!==true) throw new Error('simulation_disabled');
  const common={client_id:clientId,service_instance_id:status.serviceInstanceId};
  if(action.type==='material') {
    const device=status.devices.find(d=>d.device_id===action.device_id);
    const choice=device?.material?.candidates.find(c=>c.variant_id===action.variant_id && (!action.character_id || c.character_id===action.character_id));
    if(!choice)throw new Error('unknown_variant');
    return {path:'material',body:{service_instance_id:status.serviceInstanceId,device_id:device.device_id,expected_revision:action.expected_revision,character_id:choice.character_id,variant_id:choice.variant_id,manifest_sha256:choice.manifest_sha256}};
  }
  if(action.type==='intent') {
    const device=status.devices.find(d=>d.device_id===action.device_id); if(!device)throw new Error('unknown_device');
    return {path:'intent',body:{...common,device_id:device.device_id,intent_id:requestId,expected_revision:device.intent_revision,kind:action.kind,...(action.kind==='manual'?{action_id:action.action_id}:{})}};
  }
  return {path:'control',body:{...common,request_id:requestId,expected_revision:status.simulation.revision,operation:action.operation,
    ...(action.ms!==undefined?{ms:action.ms}:{}),...(action.device_id?{device_id:action.device_id}:{}),...(action.status?{status:action.status,state:action.state}:{} )}};
}
export function makeHubPanel(React,transport,readPage) {
  const {createElement:h,useState,useEffect}=React;
  const NodeControls=transport.nodeControlStatus?makeNative400NodeControls(React,transport):null;
  const DeviceUpdateSection=transport.deviceUpdateStatus?makeDeviceUpdatePanel(React,transport):null;
  const ReviewControls=transport.reviewStatus?makeNative400ReviewControls(React,transport):null;
  const MaterialPicker=makeMaterialPicker(React);
  const RepositoryPanel=makeRepositoryPanel(React,transport);
  const RolePanel=makeRolePanel(React,transport);
  return function HubPanel() {
    const [status,setStatus]=useState(null),[error,setError]=useState(''),[session,setSession]=useState(null),[pending,setPending]=useState(false);
    useEffect(()=>{
      const active={controller:new AbortController(),clientId:globalThis.crypto.randomUUID(),busy:false,generation:0,commandError:false}; let timer;
      setSession(active);
      async function update() {
        const generation=active.generation;
        try {
          if(!active.busy) {
            const next=await transport.status(active.controller.signal);
            if(active.controller.signal.aborted)return;
            if(next.source.mode==='page') {
              let report; try {report=readPage();}catch{report={status:'unavailable'};}
              await transport.publish({clientId:active.clientId,...report},active.controller.signal);
            }
            if(!active.controller.signal.aborted && active.generation===generation) {setStatus(next);if(!active.commandError)setError('');}
          }
        }catch{if(!active.controller.signal.aborted && active.generation===generation){setStatus(null);setError('无法读取管理服务，请检查是否已启动。');}}
        if(!active.controller.signal.aborted)timer=setTimeout(update,1000);
      }
      void update(); return ()=>{active.controller.abort();clearTimeout(timer);};
    },[]);
    async function act(action) {
      if(!session || session.busy || session.controller.signal.aborted)return;
      session.busy=true;session.commandError=false;session.generation++;setPending(true);setError('');
      let failure='';
      try {
        const request=simulationRequest(status,session.clientId,action,globalThis.crypto.randomUUID());
        await transport[request.path](request.body,session.controller.signal);
      }catch(e){session.commandError=true;failure=e.status===409?'状态已变化，请检查最新状态后重新操作。':'操作未完成，请检查服务状态和已保存选择；未自动重试。';}
      try {
        const latest=await transport.status(session.controller.signal);
        if(!session.controller.signal.aborted){setStatus(latest);setError(failure);}
      }catch{if(!session.controller.signal.aborted){setStatus(null);setError('管理服务不可用，操作结果未确认。');}}
      finally{session.busy=false;if(!session.controller.signal.aborted)setPending(false);}
    }
    return renderHubPanel(h,hubViewModel(status),error,{act,pending:pending || !session,MaterialPicker,RepositoryPanel,RolePanel,ReviewControls,NodeControls,
      DeviceUpdateSection:status?.deviceUpdateAvailable===true?DeviceUpdateSection:null,serviceInstanceId:status?.serviceInstanceId,
      deviceNoCode:!!transport.localDeviceStatus && status?.desktopDeviceNoCode === true});
  };
}
export function renderHubPanel(h,model,error='',{act,pending=false,MaterialPicker,RepositoryPanel,RolePanel,ReviewControls,NodeControls,DeviceUpdateSection,serviceInstanceId,deviceNoCode=false}={}) {
  const card={padding:'18px',border:'1px solid #8885',borderRadius:'12px',marginBottom:'16px'},row={display:'flex',flexWrap:'wrap',gap:'8px',margin:'12px 0'};
  const labels={disabled:'未启用',pending:'等待首拍',connected:'已连接',unsupported:'pet 未提供页面状态接口',unavailable:'不可用',online:'在线',offline:'离线',stale:'心跳过期',bound:'已绑定',accepted:'已受理',verified:'素材已校验',playing:'首帧已提交',failed:'失败',cancelled:'已取消'};
  const materialLabels={verifying:'后台校验中',submitting:'解码首帧中',unassigned:'未选择',unsupported:'不兼容',accepted:'已受理',verified:'素材已校验',playing:'模拟首帧已提交',failed:'校验失败',offline:'离线（保留最后观测）',metadata_only:'仅规格参考'};
  const button=(label,action,disabled=false)=>h('button',{type:'button',disabled:pending || disabled || !act,onClick:()=>act?.(action),style:{padding:'7px 12px',borderRadius:'6px',border:'1px solid #8886',cursor:'pointer'}},label);
  return h('section',{'aria-label':model.title,style:{padding:'20px',maxWidth:'860px',fontFamily:'system-ui, sans-serif',lineHeight:1.65}},
    h('header',null,h('h2',null,model.title),h('p',null,`${model.phase} · ${model.connection}`)),
    model.simulation?h('aside',{role:'note',style:{...card,background:'#fff4d8',color:'#5e4200'}},h('strong',null,'模拟模式 · 非实物'),h('p',null,`虚拟时间 ${(model.time_ms/1000).toFixed(1)} 秒；仅点击推进才流逝，未连接真实设备或 pet。`),
      h('div',{style:row},button('推进 1 帧（42ms）',{operation:'advance',ms:42}),button('推进 1 秒',{operation:'advance',ms:1000}),button('推进 10 秒',{operation:'advance',ms:10000}),button('模拟工作状态',{operation:'source',status:'connected',state:'working'}),button('模拟来源离线',{operation:'source',status:'unavailable',state:null}))):null,
    model.catalog?h('p',{role:'status'},`素材仓库：${({pending:'准备中',validating:'后台校验中',ready:'已就绪',failed:'校验失败',closed:'已关闭'})[model.catalog.phase] ?? '未知'} · 已校验 ${model.catalog.validated_assets} 个文件 / ${Math.round(model.catalog.validated_bytes/1048576)} MiB`):null,
    model.roles&&RolePanel?h(RolePanel,{roles:model.roles,serviceInstanceId}):null,
    model.catalog&&RepositoryPanel?h(RepositoryPanel,{serviceInstanceId}):null,
    error?h('p',{role:'alert'},error):null,
    model.observationError?h('p',{role:'alert'},'观察状态无效，未展示为设备确认；请重新读取服务状态。'):null,
    model.assemblyError?h('p',{role:'alert'},'装配状态无效；未开启任何设备通道。'):null,
    model.assemblyReview?h('aside',{role:'note',style:card},h('strong',null,'默认关闭装配候选 · 非实物'),h('p',null,`阶段：${model.assemblyReview.phase}；临时review：${model.assemblyReview.review_enabled?'已显式启用':'关闭'}；生产 listener：关闭`),h('p',null,`库存确认：${model.assemblyReview.inventory_confirmed?'已确认':'未知'}；写入门禁：${({blocked:'阻塞',inventory_unknown:'等待初始库存',playback_unverified:'等待当前素材验证',already_available:'已有离线素材，不重复保存',needs_victim:'满缓存，需显式选择可淘汰动作',ready:'仍需逐次校验'})[model.assemblyReview.write_gate]}`)):null,
    model.sourceReviewError?h('p',{role:'alert'},'来源审阅记录无效，未展示为本次通过。'):null,
    renderNative400SourceReview(h,model.sourceReview),
    model.sourceReview&&ReviewControls?h(ReviewControls,null):null,
    NodeControls?h(NodeControls,null):null,
    DeviceUpdateSection?h(DeviceUpdateSection,{key:serviceInstanceId,serviceInstanceId,noCode:deviceNoCode}):null,
    renderObservationPanel(h,model.observationReview),
    h('article',{style:card},h('h3',null,'任务状态来源'),h('p',null,`${model.source.mode} / ${labels[model.source.status] ?? '未知状态'}`),h('p',null,`任务语义：${model.source.status==='connected'?model.source.state ?? '空闲':'—'}`),
      h('small',null,model.simulation?'此处为合成状态，不读取桌面 pet。':'读取 pet 的聚合状态；桌面宠物保持独立播放。')),
    ...model.devices.map(device=>h('article',{key:device.device_id,'aria-label':device.name,style:card},h('h3',null,`${device.name} · 模拟`),
      h('p',null,`${labels[device.binding] ?? device.binding} · ${labels[device.connection] ?? device.connection} · ${device.controlled?'持有模拟控制权':'无控制权'}`),
      h('p',null,`参考动作模型：目标 ${device.desired ?? '—'} / 已观测动作 ${device.actual ?? '—'} · ${labels[device.phase] ?? '未播放'}`),
      h('p',null,`模式：${device.mode==='manual'?'手动':'自动'}${device.connection==='offline'?'；动作仅为断连前最后观测':''}`),
      device.material_playback?h('p',null,`导入素材模拟：${materialLabels[device.material_playback.phase] ?? '未知状态'}；首帧已观测：${device.material_playback.actual?`${device.material_playback.actual.character_id} / ${device.material_playback.actual.variant_id} / 动作 ${device.material_playback.actual.action_id}${device.material_playback.actual.decoded_frame?` / 已解码帧 ${device.material_playback.actual.decoded_frame.frame_index}`:''}`:'—'}`):null,
      MaterialPicker && device.material?h(MaterialPicker,{key:`${device.device_id}:${device.material.revision}`,device,act,pending}):null,
      h('div',{style:row},button(`${device.name} 待机`,{type:'intent',device_id:device.device_id,kind:'manual',action_id:0},device.connection!=='online'),
        button(`${device.name} 工作`,{type:'intent',device_id:device.device_id,kind:'manual',action_id:11},device.connection!=='online'),
        button(`${device.name} 庆祝`,{type:'intent',device_id:device.device_id,kind:'manual',action_id:58},device.connection!=='online'),
        button(`${device.name} 自动`,{type:'intent',device_id:device.device_id,kind:'auto'},device.connection!=='online'),
        button(device.connection==='offline'?`${device.name} 重连`:`${device.name} 断连`,{operation:device.connection==='offline'?'reconnect':'offline',device_id:device.device_id})))),
    h('article',{style:card},h('h3',null,'实体设备'),h('p',null,model.devices.length?'以上均为模拟设备；暂无真实设备接入':'暂无已接入设备'),
      h('p',null,'配对、角色与动作映射、素材分发和设备运行状态将在后续阶段接入。'),h('button',{type:'button',disabled:true,title:'BLE 配对尚未实现'},'添加设备（待开放）')),
    deviceNoCode ? null : h('p',null,model.simulation?'播放与虚拟时间重启后重置；已确认素材偏好保存在此模拟服务目录，重启恢复。':DeviceUpdateSection?'安装素材须经本地授权。已保存以设备回执或查询为准。':NodeControls?'缓存动作需可信宿主授权；提交后仍需设备首帧回执。':'当前页面不会连接设备或下发动作。'));
}

/** Draft is local; polling does not select or save a recommendation. Revision key resets after refresh. */
export function makeMaterialPicker(React) {
  const {createElement:h,useState}=React;
  return function MaterialPicker({device,act,pending}) {
    const m=device.material;
    const [draft,setDraft]=useState('');
    return h('fieldset',{disabled:pending},h('legend',null,'素材选择（合成目录）'),
      h('p',null,`模拟屏幕 ${m.display.width}×${m.display.height}；已保存：${m.selection?.variant_id ?? '尚未选择'}${m.status==='unsupported'?'（当前不兼容）':''}`),
      h('label',null,`${device.name} 素材规格`,h('select',{'aria-label':`${device.name} 素材规格`,value:draft,onChange:e=>setDraft(e.target.value)},
        h('option',{value:''},'请选择素材'),...m.candidates.map(c=>h('option',{key:`${c.character_id}:${c.variant_id}`,value:`${c.character_id}:${c.variant_id}`},`${c.character_id} / ${c.variant_id} · ${c.playable?'可模拟播放':'仅规格参考'} · ${c.width}×${c.height} · ${c.presentation.mode==='center'?'原尺寸居中':'等尺寸'}${c.variant_id===m.recommended?' · 推荐':''}`)))),
      h('button',{type:'button',disabled:pending || !draft || !m.candidates.some(c=>`${c.character_id}:${c.variant_id}`===draft),onClick:()=>act({type:'material',device_id:device.device_id,character_id:draft.split(':')[0],variant_id:draft.split(':')[1],expected_revision:m.revision})},`保存 ${device.name} 素材选择`),
      h('p',null,m.candidates.length?'保存偏好后，已校验的导入素材将在推进虚拟时间时装配模拟播放；不安装或控制实物。':'没有兼容素材，无法保存。'));
  };
}

export function makeRepositoryPanel(React,transport){
  const {createElement:h,useState,useEffect}=React;
  return function RepositoryPanel({serviceInstanceId}){
    const [repository,setRepository]=useState(null),[review,setReview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
    const [controller]=useState(()=>new AbortController());
    useEffect(()=>()=>controller.abort(),[]);
    const labels={activated:'已激活角色包',selected:'设备已选择',actual:'正在播放或最后观测',pending:'待播放目标',active_catalog:'当前装配目录',active_validation:'正在校验',unknown_metadata:'元数据不完整',unresolved_reference:'存在无法归属的设备引用',unsafe_entry:'不安全的文件',unknown_entry:'未知内容'};
    async function refresh(){setBusy(true);setReview(null);setError('');try{const r=await transport.versions(controller.signal);if(!controller.signal.aborted)setRepository(r.repository);}catch{if(!controller.signal.aborted)setError('无法读取仓库列表，请刷新后重试。');}finally{if(!controller.signal.aborted)setBusy(false);}}
    async function remove(){if(!review||!repository)return;setBusy(true);setError('');try{
      const r=await transport.cleanup({service_instance_id:serviceInstanceId,expected_revision:repository.revision,entry_ids:[review.entry_id]},controller.signal);
      if(!controller.signal.aborted){setRepository(r.repository);setReview(null);}
    }catch(e){if(!controller.signal.aborted){setReview(null);setError(e.status===409?'版本或引用已变化，未按旧列表清理；请刷新核对。':'清理未确认，请刷新核对；不会自动重试。');}}
    finally{if(!controller.signal.aborted)setBusy(false);}}
    const bytes=n=>n===null?'未知':n<1048576?`${n} B`:`${(n/1048576).toFixed(2)} MiB`;
    return h('article',{'aria-label':'素材仓库管理',style:{padding:'18px',border:'1px solid #8885',borderRadius:'12px',marginBottom:'16px'}},
      h('h3',null,'素材仓库版本'),h('button',{type:'button',disabled:busy,onClick:refresh},'刷新仓库列表'),
      error?h('p',{role:'alert'},error):null,
      repository?h('p',null,`已用 ${bytes(repository.used_bytes)} · 预留 ${bytes(repository.reserved_bytes)} · 配额 ${bytes(repository.quota_bytes)}${repository.over_quota?'（已超配额，新导入将被拒绝）':''}`):h('p',null,'刷新列表后可审阅未使用版本；不会自动清理。'),
      repository&&!repository.valid?h('p',{role:'alert'},'清单含不安全项，统计不完整；暂停清理与新导入。'):null,
      ...(repository?.entries??[]).map(entry=>h('div',{key:entry.entry_id,style:{margin:'12px 0'}},
        h('p',null,`${entry.kind==='version'?'版本':entry.kind==='staging'?'暂存':entry.kind==='trash'?'隔离残留':'未知项'} ${entry.entry_id.slice(0,16)}${entry.characters?.length?' · '+entry.characters.join('、'):''} · ${bytes(entry.bytes)}${entry.protected?' · '+entry.reasons.map(r=>labels[r]??'受保护').join('、'):''}`),
        h('button',{type:'button',disabled:busy||entry.protected||!repository.valid,onClick:()=>setReview(entry)},'审阅清理 '+entry.entry_id.slice(0,12)))),
      review?h('aside',{role:'note'},h('p',null,`将永久删除 ${review.entry_id}（${bytes(review.bytes)}）。服务会再次核对引用与版本；素材选择不会被删除。`),
        h('button',{type:'button',disabled:busy,onClick:remove},'确认清理此项'),h('button',{type:'button',disabled:busy,onClick:()=>setReview(null)},'取消清理')):null);
  };
}

export function makeRolePanel(React,transport){
  const {createElement:h,useState,useEffect}=React;
  const FramePreview=makeFramePreview(React,transport);
  const names={idle:'待机',thinking:'思考',working:'工作',result:'结果',success:'成功',waiting:'等待',error:'错误',touch:'触摸'};
  const phases={inactive:'未激活',unavailable:'等待重验或不可用',preparing:'准备中',restoring:'重启重验中',active:'激活成功',playing:'模拟播放中',completed:'一次动作已完成',offline:'离线，保留最后观测',failed:'失败，保留旧版本',cancelled:'候选已取消',cancelling:'取消中'};
  function Device({device,packages,execute,busy,instance,job}){
    const available=packages.filter(p=>p.display.width<=device.display.width&&p.display.height<=device.display.height&&p.display.shape===device.display.shape);
    const blocked=busy||!device.online||!!(job?.running&&job.device_id===device.device_id);
    const [pack,setPack]=useState(''),[action,setAction]=useState('');
    const candidate=available.find(p=>`${p.version_id}:${p.character_id}:${p.variant_id}`===pack);
    return h('article',{'aria-label':`${device.device_id} 已激活角色`,style:{border:'1px solid #8885',padding:12,margin:'12px 0'}},
      h('h4',null,device.device_id),h('p',null,`已激活：${device.activation.character_id??'—'} / ${device.activation.variant_id??'—'} · ${phases[device.phase]??device.phase}`),
      h('p',null,`实际动作 ${device.actual?.action_id??'—'} · 帧 ${device.actual?.decoded_frame?.frame_index??'—'} · ${device.mode==='manual'?'手动':'自动'}`),
      h(FramePreview,{device,serviceInstanceId:instance}),
      h('p',null,device.resources?`后台线程：${device.resources.worker_alive?'存活':'已停止'} · 在途 ${device.resources.pending_requests??0} · 峰值 ${device.resources.max_pending_requests??0} · 超时 ${device.resources.timeouts??0}`:'尚无角色线程'),
      h('button',{type:'button',disabled:busy||!!job?.running||!device.online||device.activation.revision==='0'||!['failed','unavailable'].includes(device.phase),onClick:()=>execute('retryRole',{service_instance_id:instance,device_id:device.device_id,expected_revision:device.activation.revision})},`重验恢复 ${device.device_id}`),
      h('label',null,'角色包版本',h('select',{'aria-label':`${device.device_id} 角色包版本`,value:pack,disabled:busy,onChange:e=>setPack(e.target.value)},h('option',{value:''},'选择完整角色包'),...available.map(p=>h('option',{key:`${p.version_id}:${p.character_id}:${p.variant_id}`,value:`${p.version_id}:${p.character_id}:${p.variant_id}`},`${p.character_id} / ${p.variant_id} · ${p.display.width}×${p.display.height} · ${p.version_id.slice(0,8)}`)))),
      h('button',{type:'button',disabled:busy||!device.online||!!job?.running||!candidate,onClick:()=>execute('activate',{service_instance_id:instance,device_id:device.device_id,expected_revision:device.activation.revision,version_id:candidate.version_id,character_id:candidate.character_id,variant_id:candidate.variant_id,manifest_sha256:candidate.manifest_sha256})},`激活到 ${device.device_id}`),
      h('label',null,'手动动作',h('select',{'aria-label':`${device.device_id} 角色动作`,value:action,disabled:blocked,onChange:e=>setAction(e.target.value)},h('option',{value:''},'选择动作'),...device.actions.map(a=>h('option',{key:a.id,value:String(a.id)},`${a.id} · ${a.semantics.map(k=>names[k]).join('/')} · ${a.fps}FPS/${a.frames}帧 · ${{loop:'循环',once_hold:'播完停末帧',once_idle:'播完回待机'}[a.loop]}`)))),
      h('button',{type:'button',disabled:blocked||!action,onClick:()=>execute('roleIntent',{service_instance_id:instance,device_id:device.device_id,expected_revision:device.intent_revision,kind:'manual',action_id:Number(action)})},`播放 ${device.device_id} 角色动作`),
      h('button',{type:'button',disabled:blocked||!device.actual,onClick:()=>execute('roleIntent',{service_instance_id:instance,device_id:device.device_id,expected_revision:device.intent_revision,kind:'auto'})},`${device.device_id} 角色自动`));
  }
  return function RolePanel({roles,serviceInstanceId}){
    const [packages,setPackages]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[controller]=useState(()=>new AbortController());
    useEffect(()=>()=>controller.abort(),[]);
    async function execute(op,body){setBusy(true);setError('');try{if(op==='list'){const r=await transport.versions(controller.signal);if(!controller.signal.aborted)setPackages(r.repository.entries.filter(e=>e.kind==='version').flatMap(e=>(e.packages??[]).map(p=>({...p,version_id:e.entry_id}))));}else await transport[op](body,controller.signal);}catch(e){if(!controller.signal.aborted)setError(e.status===409?'状态或任务已变化，请核对后重试；未自动重试。':'角色操作未确认，请核对任务与已激活版本。');}finally{if(!controller.signal.aborted)setBusy(false);}}
    return h('section',{'aria-label':'完整角色包激活',style:{border:'1px solid #8885',padding:18,borderRadius:12,marginBottom:16}},h('h3',null,'完整角色包与版本激活'),
      h('p',null,'素材偏好与已激活角色包独立；候选包重验并解码首帧后才切换，准备期间保留旧版本。全部播放均为离线模拟。'),
      h('button',{type:'button',disabled:busy,onClick:()=>execute('list')},'刷新可激活角色包'),
      roles.job?h('p',{role:'status'},`激活任务：${phases[roles.job.phase]??roles.job.phase}${roles.job.error?' · '+roles.job.error:''}`):null,
      roles.job?.running&&roles.job.phase!=='active'?h('button',{type:'button',disabled:busy,onClick:()=>execute('cancelRole',{service_instance_id:serviceInstanceId,job_id:roles.job.job_id})},'取消候选激活'):null,
      error?h('p',{role:'alert'},error):null,
      ...roles.devices.map(device=>h(Device,{key:`${device.device_id}:${device.activation.revision}`,device,packages,execute,busy,job:roles.job,instance:serviceInstanceId})));
  };
}
