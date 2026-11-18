import {bounded,clone,requireThat} from '../core/protocol.mjs';

/** Logical durable medium owned by the caller, retained across model reboot/reopen.
 * No V2 binary format, physical sector timing or real persistence. fault(stage) is trusted/synchronous. */
export class MemoryNative360Flash {
 #roots=[null,null];#objects=Array(5).fill(null);#owner=null;#fault;
 constructor({fault=()=>{}}={}){this.#fault=fault;}
 claim(owner){requireThat(!this.#owner,'flash_owner_busy');this.#owner=owner;}
 release(owner){requireThat(this.#owner===owner,'flash_owner');this.#owner=null;}
 isErased(){return this.#roots.every(r=>r===null)&&this.#objects.every(o=>o===null);}
 readRoot(index){bounded(index,0,1);this.#fault('before_root_read');const r=this.#roots[index];return r?.valid?clone(r.value):null;}
 eraseRoot(index){bounded(index,0,1);this.#fault('before_erase_root');this.#roots[index]=null;}
 prepareObject(slot,length){bounded(slot,0,4);bounded(length,544,5865472);this.#fault('before_erase_object');this.#objects[slot]={header:null,data:new Uint8Array(length)};}
 writeChunk(slot,offset,bytes){const o=this.#objects[slot];requireThat(o&&bytes instanceof Uint8Array);bounded(offset,0,o.data.length);bounded(bytes.length,1,Math.min(4096,o.data.length-offset));this.#fault('before_payload');o.data.set(bytes,offset);this.#fault('after_payload');}
 readHeader(slot){bounded(slot,0,4);this.#fault('before_header_read');return clone(this.#objects[slot]?.header??null);}
 readBytes(slot,offset,length){bounded(slot,0,4);this.#fault('before_payload_read');const o=this.#objects[slot];requireThat(o,'flash_object_missing');bounded(offset,0,o.data.length);bounded(length,0,o.data.length-offset);return o.data.slice(offset,offset+length);}
 writeHeader(slot,header){this.#fault('before_object_header');requireThat(this.#objects[slot]);this.#objects[slot].header=clone(header);this.#fault('after_object_header');}
 writeRoot(index,value){bounded(index,0,1);this.#fault('before_root_marker');this.#roots[index]={valid:true,value:clone(value)};this.#fault('after_root_marker');}
 /** Test-only corruption/crash input; never exposed to UI or device messages. */
 damageRoot(index,work){bounded(index,0,1);requireThat(this.#roots[index]);work(this.#roots[index]);}
 damageObject(slot,work){bounded(slot,0,4);requireThat(this.#objects[slot]);work(this.#objects[slot]);}
 resources(){return {owner:this.#owner!==null,root_records:this.#roots.filter(Boolean).length,object_records:this.#objects.filter(Boolean).length};}
}
