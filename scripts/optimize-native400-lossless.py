"""Original lossless PET4 index/extra-key optimization; external liblz4 is not bundled."""
import argparse,ctypes,hashlib,json,struct,zlib,collections,math
from pathlib import Path
LIMIT=5865472

def rgb(c):return ((c>>11)*255/31,((c>>5)&63)*255/63,(c&31)*255/31)
def morton(c):
 r,g,b=(c>>11)<<1,(c>>5)&63,(c&31)<<1
 return sum(((r>>i)&1)<<(3*i+2)|((g>>i)&1)<<(3*i+1)|((b>>i)&1)<<(3*i) for i in range(6))
def mappings(palette,frames,extended=False):
 colors=list(dict.fromkeys(palette));colors.remove(0);counts=collections.Counter(b''.join(frames));weights=collections.Counter()
 for i,n in counts.items():weights[palette[i]]+=n
 nearest=[];left=set(colors);previous=0
 while left:
  q=rgb(previous);c=min(left,key=lambda c:(sum(w*(x-y)**2 for w,x,y in zip((2,3,1),q,rgb(c))),c));nearest.append(c);left.remove(c);previous=c
 orders={'deduplicate':colors,'rgb':sorted(colors),'luminance':sorted(colors,key=lambda c:(sum(x*w for x,w in zip(rgb(c),(2,3,1))),c)),'morton':sorted(colors,key=lambda c:(morton(c),c)),'frequency':sorted(colors,key=lambda c:(-weights[c],c)),'nearest':nearest}
 if extended:
  def kd(cs):
   if len(cs)<=1:return cs
   spans=[max(rgb(c)[i] for c in cs)-min(rgb(c)[i] for c in cs) for i in range(3)];axis=max(range(3),key=lambda i:spans[i]);cs=sorted(cs,key=lambda c:(rgb(c)[axis],c));mid=len(cs)//2;return kd(cs[:mid])+kd(cs[mid:])
  orders['kdtree']=kd(colors)
  for name in ['nearest','morton','kdtree']:
   original=orders[name]
   for n in [1,2,4,8,16,32,64]:
    at=n%len(original) if original else 0;orders[name+'-rotate'+str(n)]=original[at:]+original[:at]
 result={}
 for name,order in orders.items():
  p=[0]+order+[0]*(255-len(order));reverse={c:i for i,c in reversed(list(enumerate(p)))};table=bytes(reverse[c] for c in palette);assert all(p[table[i]]==palette[i] for i in range(256));result[name]=(p,table)
 return result

class Codec:
 def __init__(self,path):
  self.lib=ctypes.CDLL(str(Path(path).resolve()));self.lib.LZ4_decompress_safe.argtypes=[ctypes.c_void_p,ctypes.c_void_p,ctypes.c_int,ctypes.c_int];self.lib.LZ4_compress_HC.argtypes=[ctypes.c_void_p,ctypes.c_void_p,ctypes.c_int,ctypes.c_int,ctypes.c_int]
 def decode(self,b):
  w,h,fps,n=struct.unpack_from('<HHHH',b,4);assert b[:4]==b'PET4' and (w,h,fps)==(400,400,24) and 1<=n<=241 and struct.unpack_from('<HH',b,524)==(12,1)
  assert zlib.crc32(b[4:528])==struct.unpack_from('<I',b,528)[0];base=532+4*(2*n+1);offsets=struct.unpack_from('<'+'I'*(n+1),b,532);crcs=struct.unpack_from('<'+'I'*n,b,532+4*(n+1));assert offsets[0]==0 and offsets[-1]==len(b)-base
  frames=[];previous=bytes(160000)
  for f in range(n):
   pos=base+offsets[f];end=base+offsets[f+1];tag=b[pos];pos+=1;assert tag in (0,1) and (f%12 or tag==0);frame=bytearray()
   for off in range(0,160000,8000):
    size=struct.unpack_from('<H',b,pos)[0];pos+=2;packed=b[pos:pos+size];pos+=size;out=ctypes.create_string_buffer(8000);assert pos<=end and self.lib.LZ4_decompress_safe(packed,out,size,8000)==8000
    frame.extend((int.from_bytes(out.raw,'little')^int.from_bytes(previous[off:off+8000],'little')).to_bytes(8000,'little') if tag else out.raw)
   assert pos==end and zlib.crc32(frame)==crcs[f];frames.append(bytes(frame));previous=frames[-1]
  return frames
 def packed(self,data):
  chunks=[]
  for at in range(0,160000,8000):
   out=ctypes.create_string_buffer(8047);size=self.lib.LZ4_compress_HC(data[at:at+8000],out,8000,8047,12);assert 0<size<=8047;chunks.extend((struct.pack('<H',size),out.raw[:size]))
  return b''.join(chunks)
 def pair(self,frame,previous,forced):
  key=b'\0'+self.packed(frame)
  if forced:return key
  delta=(int.from_bytes(frame,'little')^int.from_bytes(previous,'little')).to_bytes(160000,'little');packed=b'\1'+self.packed(delta)
  return key if len(key)<len(packed) else packed
 def encode(self,header,frames,palette,table):
  parts=[];crcs=[];previous=bytes(160000);digest=hashlib.sha256();extra=0
  for f,original in enumerate(frames):
   frame=original.translate(table);part=self.pair(frame,previous,f%12==0);extra+=int(f%12!=0 and part[0]==0);parts.append(part);crcs.append(zlib.crc32(frame));digest.update(frame);previous=frame
  head=bytearray(header);struct.pack_into('<256H',head,12,*palette);struct.pack_into('<I',head,528,zlib.crc32(head[4:528]));offsets=[0]
  for p in parts:offsets.append(offsets[-1]+len(p))
  return bytes(head)+struct.pack('<'+'I'*len(offsets),*offsets)+struct.pack('<'+'I'*len(crcs),*crcs)+b''.join(parts),digest.hexdigest(),extra

def main():
 p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--output',required=True);p.add_argument('--library',required=True);p.add_argument('--ids');p.add_argument('--extended',action='store_true');a=p.parse_args();root=Path(a.input).resolve();dest=Path(a.output).resolve();assert dest.is_relative_to(Path.cwd().resolve()/'.cache') and not dest.exists()
 for parent in [Path(a.output),*Path(a.output).parents]:assert not parent.is_symlink()
 m=json.loads((root/'manifest.json').read_text());assert m['profile']=='native400-candidate-v1' and m['license_ref']=='dsh-pet-nc-86181ce';codec=Codec(a.library);dest.mkdir(parents=True);records=[];chosen=set(map(int,a.ids.split(','))) if a.ids else None
 for action in m['actions']:
  if action['bytes']<=LIMIT or chosen is not None and action['id'] not in chosen:continue
  src=root/(str(action['id'])+'.pet');assert not src.is_symlink();b=src.read_bytes();assert hashlib.sha256(b).hexdigest()==action['sha256'];frames=codec.decode(b);assert hashlib.sha256(b''.join(frames)).hexdigest()==action['index_sha256'];palette=list(struct.unpack_from('<256H',b,12));maps=mappings(palette,frames,a.extended);samples=sorted(set([0,len(frames)-1]+list(range(5,len(frames),24))))
  scores=[]
  for name,(pal,table) in maps.items():
   score=sum(len(codec.pair(frames[f].translate(table),frames[f-1].translate(table) if f else bytes(160000),f%12==0)) for f in samples);scores.append((score,name))
  ranked=[name for _,name in sorted(scores)[:2]];ranked=list(dict.fromkeys((['deduplicate','nearest','morton'] if a.extended else ['deduplicate'])+ranked));best=b;best_name='original';best_index=action['index_sha256'];best_extra=0;trials=[]
  for name in ranked:
   pal,table=maps[name];encoded,indexsha,extra=codec.encode(b[:532],frames,pal,table);trials.append({'scheme':name,'bytes':len(encoded),'extra_keys':extra})
   if len(encoded)<len(best):best,best_name,best_index,best_extra=encoded,name,indexsha,extra
   print(action['id'],name,len(encoded),'limit',LIMIT,flush=True)
  (dest/(str(action['id'])+'.pet')).write_bytes(best);record={**action,'original_bytes':action['bytes'],'original_sha256':action['sha256'],'bytes':len(best),'sha256':hashlib.sha256(best).hexdigest(),'index_sha256':best_index,'rgb565_sha256':action['rgb565_sha256'],'scheme':best_name,'extra_keyframes':best_extra,'within_legacy_limit':len(best)<=LIMIT,'lossless_rgb565':True,'trials':trials};records.append(record)
  (dest/'progress.json').write_text(json.dumps(records,ensure_ascii=False,indent=2));print('BEST',action['id'],len(b),'->',len(best),best_name,flush=True)
 out={**m,'recipe':'native400-lossless-index-relabel-adaptive-key-hc12-v1','status':'lossless_candidates_pending_host_rgb_verification','actions':records,'legacy_limit_bytes':LIMIT};(dest/'manifest.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
