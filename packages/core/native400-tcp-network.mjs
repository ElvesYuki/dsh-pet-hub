const need=ok=>{if(!ok)throw Object.assign(Error('tcp_network_invalid'),{code:'tcp_network_invalid'});};
/** Canonical explicit IPv4 only. Incoming mapped IPv4 is normalized by allows,
 * never by the trusted configuration parser. No DNS, CIDR or address discovery. */
export function native400PeerAddress(value){
 need(typeof value==='string'&&value.length<=15);const parts=value.split('.');
 need(parts.length===4&&parts.every(x=>/^(0|[1-9][0-9]{0,2})$/.test(x)&&Number(x)<=255));
 need(Number(parts[0])>0&&Number(parts[0])<224&&parts.map(Number).join('.')===value);return value;
}
/** Local single-publisher link epoch. No I/O or authentication. New epochs must
 * synchronously fence the owning transport even for up/up; stale events do not
 * mutate readiness. Address is intentionally omitted from public snapshots. */
export function createNative400TcpNetwork({peerAddress}){
 const peer=native400PeerAddress(peerAddress);let epoch=0,ready=false;
 return {link(next,up){need(Number.isInteger(next)&&next>0&&next<=0xffffffff&&typeof up==='boolean');if(next<=epoch)return false;epoch=next;ready=next<0xffffffff&&up;return true;},
  allows(address){if(!ready||typeof address!=='string')return false;const text=address.startsWith('::ffff:')?address.slice(7):address;try{return native400PeerAddress(text)===peer;}catch{return false;}},
  snapshot(){return {epoch,ready,peer_selected:true,authenticated:false};}};
}
