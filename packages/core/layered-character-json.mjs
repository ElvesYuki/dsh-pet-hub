export function layeredRequire(ok,code='invalid_format',resourceId){if(!ok){const error=new Error(code);error.code=code;if(resourceId)error.resource_id=resourceId;throw error;}}
/** Bounded fatal UTF-8 JSON parser with decoded duplicate-key and depth checks before materialization. */
export function parseLayeredJson(bytes,limit=262144){
 layeredRequire(bytes instanceof Uint8Array&&bytes.byteLength<=limit,'resource_limit');
 let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{layeredRequire(false);}
 let pos=0,nodes=0;const whitespace=()=>{while(/[\x20\x09\x0a\x0d]/.test(text[pos]??'!'))pos++;};
 const string=()=>{const start=pos++;while(pos<text.length){const c=text[pos++];if(c==='"'){try{return JSON.parse(text.slice(start,pos));}catch{layeredRequire(false);}}if(c==='\\')pos++;}layeredRequire(false);};
 function value(depth){
  layeredRequire(depth<=16&&++nodes<=20000,'resource_limit');whitespace();const c=text[pos];
  if(c==='"')return string();
  if(c==='{'||c==='['){pos++;const object=c==='{',result=object?Object.create(null):[],seen=new Set(),end=object?'}':']';whitespace();if(text[pos]===end){pos++;return result;}
   while(pos<text.length){let key;if(object){layeredRequire(text[pos]==='"');key=string();layeredRequire(!seen.has(key));seen.add(key);whitespace();layeredRequire(text[pos++]===':');}const item=value(depth+1);if(object)result[key]=item;else result.push(item);whitespace();if(text[pos]===end){pos++;return result;}layeredRequire(text[pos++ ]===',');whitespace();}layeredRequire(false);
  }
  for(const [token,result] of [['true',true],['false',false],['null',null]])if(text.startsWith(token,pos)){pos+=token.length;return result;}
  const match=/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(pos));layeredRequire(match);pos+=match[0].length;const result=Number(match[0]);layeredRequire(Number.isFinite(result));return result;
 }
 const result=value(0);whitespace();layeredRequire(pos===text.length);return result;
}
export function layeredKeys(value,expected,code='invalid_format'){
 layeredRequire(value!==null&&typeof value==='object'&&!Array.isArray(value),code);const keys=Object.keys(value);layeredRequire(keys.length===expected.length&&keys.every(k=>expected.includes(k)),code);
}
export function layeredEqual(a,b){if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b)||(Array.isArray(a)&&a.length!==b.length))return false;const ak=Object.keys(a),bk=Object.keys(b);return ak.length===bk.length&&ak.every(k=>Object.hasOwn(b,k)&&layeredEqual(a[k],b[k]));}
