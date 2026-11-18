import {crc32} from './pet4.mjs';
const sizes={1:56,2:40,3:0,4:0,128:56,129:16,130:24};
const need=(b,c='tcp_invalid')=>{if(!b)throw Object.assign(new Error(c),{code:c});};
export const tcpU64=x=>{need(typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&BigInt(x)<(1n<<64n));return BigInt(x);};
export function tcpBytes(hex,n=32){need(typeof hex==='string'&&new RegExp(`^[a-f0-9]{${n*2}}$`).test(hex));return Uint8Array.from((hex.match(/../g)??[]),x=>parseInt(x,16));}
export const tcpHex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
export function tcpPayload(type,v={}){const b=new Uint8Array(sizes[type]),d=new DataView(b.buffer),u64=(o,x)=>d.setBigUint64(o,tcpU64(x),true);
 if(type===128){u64(0,v.boot);b.set(tcpBytes(v.mapping),8);[400,400,24,4].forEach((x,i)=>d.setUint16(40+2*i,x,true));d.setUint32(48,10000,true);d.setUint32(52,256,true);}
 else if(type===1){u64(0,v.boot);b.set(tcpBytes(v.mapping),8);b.set(tcpBytes(v.controller,16),40);}
 else if(type===2){need(Number.isInteger(v.action)&&v.action>=0&&v.action<=65535&&Number.isInteger(v.ttl)&&v.ttl>=0&&v.ttl<=0xffffffff);d.setUint16(0,v.action,true);d.setUint32(4,v.ttl,true);b.set(tcpBytes(v.asset),8);}
 else if(type===129){d.setUint16(0,v.code,true);d.setUint16(2,v.action??65535,true);u64(8,v.token??'0');}
 else if(type===130){u64(0,v.token);u64(8,v.source);d.setUint32(16,v.frame??0,true);d.setUint16(20,v.action,true);}
 else need(type===3||type===4);return b;
}
export function encodeTcp({type,session,seq,payload=new Uint8Array()}){need(Object.hasOwn(sizes,type)&&payload instanceof Uint8Array&&payload.length===sizes[type]);const s=tcpU64(session),q=tcpU64(seq);need(q>0n&&(type===128)===(s===0n)&&(type!==128||q===1n));const b=new Uint8Array(32+payload.length),d=new DataView(b.buffer);b.set([80,84,67,49,1,type]);d.setUint32(8,payload.length,true);d.setBigUint64(12,s,true);d.setBigUint64(20,q,true);b.set(payload,32);const crc=new Uint8Array(28+payload.length);crc.set(b.subarray(0,28));crc.set(payload,28);d.setUint32(28,crc32(crc),true);return b;}
export function decodeTcp(b){need(b instanceof Uint8Array&&b.length>=32&&b.length<=288);const d=new DataView(b.buffer,b.byteOffset,b.byteLength),type=b[5],n=d.getUint32(8,true);need(b[0]===80&&b[1]===84&&b[2]===67&&b[3]===49&&b[4]===1&&!b[6]&&!b[7]&&Object.hasOwn(sizes,type)&&n===sizes[type]&&b.length===32+n);const r={type,session:d.getBigUint64(12,true).toString(),seq:d.getBigUint64(20,true).toString(),payload:b.slice(32)};const expected=encodeTcp(r);need(tcpHex(expected)===tcpHex(b),'tcp_crc');return r;}
/** Bounded sticky fail-closed stream parser; no resynchronization or message queue. */
export class TcpParser {buffer=new Uint8Array(288);used=0;expected=32;failed=false;
 feed(bytes,consume){try{need(!this.failed&&bytes instanceof Uint8Array);for(const x of bytes){this.buffer[this.used++]=x;if(this.used===32){const d=new DataView(this.buffer.buffer);const n=d.getUint32(8,true);need(n<=256&&Object.hasOwn(sizes,this.buffer[5])&&n===sizes[this.buffer[5]]&&this.buffer[4]===1&&!this.buffer[6]&&!this.buffer[7]&&tcpHex(this.buffer.subarray(0,4))==='50544331');this.expected=32+n;}if(this.used===this.expected){need(consume(decodeTcp(this.buffer.slice(0,this.used)))!==false);this.used=0;this.expected=32;}}}catch(e){this.failed=true;throw e;}}
 eof(){if(this.used)this.failed=true;need(!this.failed,'tcp_truncated');}
}
export class TcpTx {bytes=null;offset=0;start(r){need(!this.remaining,'tcp_tx_busy');this.bytes=encodeTcp(r);this.offset=0;}get remaining(){return (this.bytes?.length??0)-this.offset;}get data(){return this.bytes?.subarray(this.offset)??new Uint8Array();}advance(n){need(Number.isInteger(n)&&n>=0&&n<=this.remaining);this.offset+=n;}close(){this.bytes=null;this.offset=0;}}
