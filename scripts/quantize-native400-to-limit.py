"""Original color-merge candidate search. This is explicitly lossy and never overwrites source."""
import argparse,heapq,hashlib,json,struct,collections,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('lossless_optimizer',Path(__file__).with_name('optimize-native400-lossless.py'));opt=importlib.util.module_from_spec(spec);spec.loader.exec_module(opt)

def quant_tables(palette,frames,targets):
 counts=collections.Counter(b''.join(frames));weights=collections.Counter()
 for i,n in counts.items():weights[palette[i]]+=n
 nodes={};n=0
 for color,w in weights.items():
  if color==0:continue
  nodes[n]=(w,tuple(x*w for x in opt.rgb(color)));n+=1
 heap=[]
 def distance(a,b):
  wa,sa=nodes[a];wb,sb=nodes[b];return wa*wb/(wa+wb)*sum(weight*(x/wa-y/wb)**2 for weight,x,y in zip((2,3,1),sa,sb))
 def push(a,b):heapq.heappush(heap,(distance(a,b),a,b))
 keys=list(nodes)
 for j,a in enumerate(keys):
  for b in keys[j+1:]:push(a,b)
 for target in targets:
  while len(nodes)+1>target:
   while True:
    _,a,b=heapq.heappop(heap)
    if a in nodes and b in nodes:break
   wa,sa=nodes.pop(a);wb,sb=nodes.pop(b);nodes[n]=(wa+wb,tuple(x+y for x,y in zip(sa,sb)))
   for other in list(nodes):
    if other!=n:push(other,n)
   n+=1
  colors=[0]
  for w,s in nodes.values():
   r,g,b=[min(255,max(0,round(x/w))) for x in s];colors.append((r>>3)<<11|(g>>2)<<5|(b>>3))
  p=list(dict.fromkeys(colors));p+= [0]*(256-len(p));rgb=[opt.rgb(c) for c in p];lut=[]
  for c in palette:
   q=opt.rgb(c);k=0 if c==0 else min(range(len(colors)),key=lambda i:sum(w*(x-y)**2 for w,x,y in zip((2,3,1),q,rgb[i])));lut.append(k)
  yield target,p,bytes(lut),weights

def error_stats(old,new,table,frames):
 counts=collections.Counter(b''.join(frames));total=sum(counts.values());foreground=sum(n for i,n in counts.items() if old[i]!=0);sums=[0,0,0];changed=0;maximum=0
 for i,n in counts.items():
  before=opt.rgb(old[i]);after=opt.rgb(new[table[i]]);errors=[abs(round(a)-round(b)) for a,b in zip(before,after)]
  for c in range(3):sums[c]+=errors[c]*n
  maximum=max(maximum,*errors)
  if old[i]!=new[table[i]]:changed+=n
 return dict(additional_mae_rgb=[s/total for s in sums],additional_foreground_mae_rgb=[s/max(1,foreground) for s in sums],additional_max_channel_error=maximum,changed_pixels_fraction=changed/total,changed_foreground_fraction=changed/max(1,foreground))

def main():
 p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--lossless',required=True);p.add_argument('--output',required=True);p.add_argument('--library',required=True);p.add_argument('--ids');p.add_argument('--targets');p.add_argument('--extended',action='store_true');a=p.parse_args();root=Path(a.input).resolve();loss=Path(a.lossless).resolve();dest=Path(a.output).resolve();assert dest.is_relative_to(Path.cwd().resolve()/'.cache') and not dest.exists();dest.mkdir(parents=True)
 m=json.loads((root/'manifest.json').read_text());l=json.loads((loss/'manifest.json').read_text());original={x['id']:x for x in m['actions']};codec=opt.Codec(a.library);records=[]
 for previous in l['actions']:
  if previous['bytes']<=opt.LIMIT or a.ids and previous['id'] not in set(map(int,a.ids.split(','))):continue
  action=original[previous['id']];src=root/(str(action['id'])+'.pet');b=src.read_bytes();assert hashlib.sha256(b).hexdigest()==action['sha256'];frames=codec.decode(b);palette=list(struct.unpack_from('<256H',b,12));count=len(set(palette));targets=sorted({n for n in (list(map(int,a.targets.split(','))) if a.targets else [count-1,248,240,232,224,216,208,192,176,160,144,128,120,112,104,96]) if 2<=n<count},reverse=True);trials=[];best=None
  for target,pal,table,weights in quant_tables(palette,frames,targets):
   quantized=[frame.translate(table) for frame in frames];orders=opt.mappings(pal,quantized,a.extended);samples=sorted(set([0,len(frames)-1]+list(range(5,len(frames),24))));scores=[]
   for name,(newpal,second) in orders.items():
    composed=bytes(second[table[i]] for i in range(256));score=sum(len(codec.pair(frames[f].translate(composed),frames[f-1].translate(composed) if f else bytes(160000),f%12==0)) for f in samples);scores.append((score,name,newpal,composed))
   # Fully encode the best sampled ordering; use full size, never sample size, for acceptance.
   ranked=sorted(scores,key=lambda r:(r[0],r[1]))[:3] if a.extended else [min(scores,key=lambda r:(r[0],r[1]))]
   if a.extended:ranked+= [r for r in scores if r[1] in ['nearest','morton'] and r[1] not in [x[1] for x in ranked]]
   choices=[]
   for _,name,newpal,composed in ranked:
    encoded,indexsha,extra=codec.encode(b[:532],frames,newpal,composed);choices.append((encoded,indexsha,extra,name,newpal,composed))
   encoded,indexsha,extra,name,newpal,composed=min(choices,key=lambda r:len(r[0]));stats=error_stats(palette,newpal,composed,frames);trial=dict(target_colors=target,actual_colors=len(set(newpal)),scheme=name,bytes=len(encoded),**stats);trials.append(trial);print(action['id'],target,len(encoded),stats['additional_foreground_mae_rgb'],stats['additional_max_channel_error'],flush=True)
   if best is None or len(encoded)<len(best[0]):best=(encoded,indexsha,extra,trial)
   if len(encoded)<=opt.LIMIT:break
  encoded,indexsha,extra,trial=best;(dest/(str(action['id'])+'.pet')).write_bytes(encoded)
  records.append({**action,'original_bytes':action['bytes'],'original_sha256':action['sha256'],'bytes':len(encoded),'sha256':hashlib.sha256(encoded).hexdigest(),'index_sha256':indexsha,'rgb565_sha256':None,'original_rgb565_sha256':action['rgb565_sha256'],'lossless_rgb565':False,'within_legacy_limit':len(encoded)<=opt.LIMIT,'extra_keyframes':extra,'color_quantization':trial,'trials':trials})
  (dest/'progress.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
 out={**m,'recipe':'native400-bounded-color-merge-adaptive-key-hc12-v1','status':'lossy_candidates_pending_pixel_verification_and_visual_review','actions':records,'legacy_limit_bytes':opt.LIMIT};(dest/'manifest.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
