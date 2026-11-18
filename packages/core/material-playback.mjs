import {clone,compatible,same} from './protocol.mjs';
/** Virtual frames with sync/async injected decoding; no hardware submit claims. */
export class MaterialPlayback {
  #resolve;#read;#verify;#clock;#available;#prepare;#release;#states=new Map();#tasks=new Set();
  constructor({resolve,readAsset,verifyAsset,clock,hasAsset=()=>true,prepare,release=()=>{}}){
    this.#resolve=resolve;this.#read=readAsset;this.#verify=verifyAsset;this.#clock=clock;this.#available=hasAsset;this.#prepare=prepare;this.#release=release;
  }
  #run(value,success,failure){
    if(value&&typeof value.then==='function'){
      const task=Promise.resolve(value).then(success).catch(failure).finally(()=>this.#tasks.delete(task));this.#tasks.add(task);
    }else success(value);
  }
  #clear(s,deviceId){if(s.key)this.#release(deviceId);s.pending=null;s.player=null;s.key=null;s.framePending=false;}
  async settle(){while(this.#tasks.size)await Promise.all([...this.#tasks]);}
  stop(){for(const [id,s] of this.#states){this.#clear(s,id);s.phase='offline';}}
  tick(deviceId,{online,session,actionId,intentRevision}){
    let s=this.#states.get(deviceId);if(!s){s={actual:null,phase:'unassigned',pending:null,key:null};this.#states.set(deviceId,s);}
    if(!online){this.#clear(s,deviceId);s.phase='offline';return;}
    const selected=this.#resolve(deviceId);
    if(selected.status!=='compatible'){this.#clear(s,deviceId);s.phase=selected.status;return;}
    const m=selected.manifest;
    if(m.package_schema===2||!['SIM2','PET4'].includes(m.codec)||!m.actions.every(a=>this.#available(a.sha256))){this.#clear(s,deviceId);s.phase='metadata_only';return;}
    const key={revision:selected.revision,manifest_sha256:m.sha256,session,actionId,intentRevision};
    if(!same(s.key,key)){this.#clear(s,deviceId);s.key=clone(key);s.phase='accepted';s.pending={at:this.#clock.now()};}
    const p=s.pending;
    if(!p){
      if(s.phase==='playing'&&s.player&&!s.framePending){
        const player=s.player,actual=s.actual;s.framePending=true;
        const valid=()=>s.player===player&&s.actual===actual&&s.phase==='playing';
        const fail=()=>{if(valid()){s.phase='failed';s.player=null;s.framePending=false;}};
        try{const value=player.frame(Math.floor((this.#clock.now()-actual.started_ms)*player.fps/1000)%player.frames);
          this.#run(value,decoded=>{if(valid()){actual.decoded_frame=decoded;s.framePending=false;}},fail);
        }catch{fail();}
      }return;
    }
    const valid=()=>s.pending===p;
    const fail=()=>{if(valid()){s.phase='failed';s.pending=null;this.#release(deviceId);}};
    try{
      if(s.phase==='accepted'&&this.#clock.now()-p.at>=300){
        const action=compatible(selected.caps,m,actionId);s.phase='verifying';
        const value=this.#prepare?this.#prepare(deviceId,action,m):this.#verify(this.#read(action.sha256),action,m);
        this.#run(value,proof=>{if(valid()){if(!proof)throw new Error('asset_integrity_failed');p.proof=proof;s.phase='verified';}},fail);
      }
      if(s.phase==='verified'&&this.#clock.now()-p.at>=400){
        const player=typeof p.proof?.frame==='function'?p.proof:null;s.phase='submitting';
        this.#run(player?player.frame(0):null,decoded=>{
          if(!valid())return;
          const actual={character_id:m.character_id,variant_id:m.variant_id,manifest_sha256:m.sha256,action_id:actionId,started_ms:this.#clock.now(),presentation:selected.presentation};
          if(decoded)actual.decoded_frame=decoded;s.actual=actual;s.player=player;s.phase='playing';s.pending=null;
        },fail);
      }
    }catch{fail();}
  }
  snapshot(deviceId){const s=this.#states.get(deviceId);return {synthetic:true,phase:s?.phase??'unassigned',actual:clone(s?.actual??null),desired:s?.key?Object.fromEntries(['revision','manifest_sha256','actionId','intentRevision'].map(k=>[k,s.key[k]])):null};}
}
