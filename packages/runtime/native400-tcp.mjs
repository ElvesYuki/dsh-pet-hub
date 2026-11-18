import {createHash} from 'node:crypto';
import {tcpBytes,TcpParser,TcpTx,decodeTcp} from '../core/native400-tcp.mjs';
/** Exact draft mapping, caller supplies independently recovered/approved inventory.
 * This function does not discover inventory or grant approval. */
export function native400TcpMapping(v){const h=createHash('sha256');h.update('pet400-tcp-map-draft/1\0');for(const key of ['namespace_sha256','source_manifest_sha256','hub_index_sha256'])h.update(tcpBytes(v[key]));const records=[...v.records].sort((a,b)=>a.action-b.action);if(records.map(x=>x.action).join(',')!=='0,1,4,11')throw Error('tcp_inventory');for(const r of records){if(!Number.isSafeInteger(r.bytes)||r.bytes<1||r.bytes>0xffffffff||r.frames!==241)throw Error('tcp_inventory');const b=Buffer.alloc(8);b.writeUInt16LE(r.action);b.writeUInt32LE(r.bytes,2);b.writeUInt16LE(r.frames,6);h.update(b);h.update(tcpBytes(r.asset_sha256));}return h.digest('hex');}
/** Explicit borrowed socket; no listener/dial/config discovery. One record queued,
 * backpressure serialized; disconnect invalidates generation before callbacks. */
export function attachNative400Tcp(socket,model,{onProgress=()=>{},onClose=()=>{},beforeReceive}={}){
 const generation=model.connect(),parser=new TcpParser();let closed=false,blocked=false,resolveClosed;const done=new Promise(r=>resolveClosed=r);
 const progress=()=>{if(!closed)onProgress();};
 const fail=()=>{if(closed)return;closed=true;blocked=false;model.close(generation);try{onClose();}finally{socket.destroy();}};
 const send=r=>{if(closed||blocked)throw Error('tcp_tx_busy');const tx=new TcpTx();tx.start(r);blocked=true;const b=tx.data;try{socket.write(b,error=>{if(closed)return;if(error){fail();return;}tx.advance(b.length);blocked=false;progress();});}catch(error){fail();throw error;}};
 socket.on('data',bytes=>{if(closed)return;try{parser.feed(bytes,r=>{if(beforeReceive&&beforeReceive()!==true)throw Error('tcp_receive_fenced');const reply=model.receive(r,generation);if(reply)send(reply);return true;});progress();}catch{fail();}});
 socket.on('end',()=>{try{parser.eof();}catch{}finally{fail();}});socket.on('error',fail);socket.on('close',()=>{try{fail();}finally{resolveClosed();}});
 return {send,tick(){try{model.tick();}catch{fail();}},close:fail,done,get closed(){return closed;},get busy(){return blocked;}};
}
/** Bridge existing validated native400 metadata and explicit recovered inventory.
 * Namespace/index are explicit domains: never inferred from offline namespace/P/M. */
export function native400TcpCatalog(metadata,recovered,{namespace_sha256,hub_index_sha256}){
 const records=recovered.map(r=>{const a=metadata.manifest.actions.find(x=>x.id===r.action),t=metadata.package.content.timing.find(x=>x.id===r.action);if(!a||!t||a.sha256!==r.asset_sha256||a.bytes!==r.bytes||t.frames!==r.frames)throw Error('tcp_identity');return {...r};});
 const input={namespace_sha256,source_manifest_sha256:metadata.package.content.source_manifest_sha256,hub_index_sha256,records};return {mapping:native400TcpMapping(input),records,identity:input};
}
