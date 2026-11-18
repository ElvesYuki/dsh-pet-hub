"""Original offline experiment wrapper; reuses our HC12 PET4 encoder with explicitly installed liblz4."""
import argparse,hashlib,importlib.util,json,struct
from pathlib import Path

spec=importlib.util.spec_from_file_location('native400_codec',Path(__file__).with_name('optimize-native400-lossless.py'))
codec_module=importlib.util.module_from_spec(spec);spec.loader.exec_module(codec_module)

def sample_frames(count):
 assert isinstance(count,int) and 1<=count<=241
 return sorted({f for f in [0,30,60,120,180,count-1] if f<count})

def main():
 p=argparse.ArgumentParser();p.add_argument('--job',required=True);p.add_argument('--library',required=True);args=p.parse_args()
 job_path=Path(args.job).absolute();root=(Path.cwd()/'.cache').resolve()
 for parent in [job_path,*job_path.parents]:assert not parent.is_symlink(),'unsafe_job'
 assert job_path.resolve().is_relative_to(root),'job_outside_cache'
 job=json.loads(job_path.read_text());folder=job_path.parent
 assert isinstance(job['frames'],int) and 1<=job['frames']<=241 and len(job['palette'])==256 and all(isinstance(c,int) and 0<=c<=65535 for c in job['palette'])
 assert job['palette'][0]==0
 for key in ['indices_file','output_file','result_file']:assert Path(job[key]).name==job[key] and job[key] not in ['.','..']
 raw=(folder/job['indices_file']).read_bytes();assert len(raw)==160000*job['frames'] and hashlib.sha256(raw).hexdigest()==job['index_sha256']
 frames=[raw[p:p+160000] for p in range(0,len(raw),160000)];palette=job['palette'];codec=codec_module.Codec(args.library)
 orders=codec_module.mappings(palette,frames);sample=sample_frames(job['frames']);scores=[]
 for name,(new_palette,table) in orders.items():
  score=sum(len(codec.pair(frames[f].translate(table),frames[f-1].translate(table) if f else bytes(160000),f%12==0)) for f in sample)
  scores.append((score,name,new_palette,table))
 _,name,new_palette,table=min(scores,key=lambda item:(item[0],item[1]))
 header=bytearray(532);header[:4]=b'PET4';struct.pack_into('<HHHH',header,4,400,400,24,len(frames));struct.pack_into('<HH',header,524,12,1)
 encoded,index_sha,extra=codec.encode(header,frames,new_palette,table)
 with (folder/job['output_file']).open('xb') as f:f.write(encoded)
 result=dict(bytes=len(encoded),sha256=hashlib.sha256(encoded).hexdigest(),index_sha256=index_sha,extra_keyframes=extra,index_order=name,sample_order_scores=[dict(scheme=item[1],bytes=item[0]) for item in scores])
 with (folder/job['result_file']).open('x') as f:json.dump(result,f,indent=2)
 print(json.dumps(dict(output=job['output_file'],bytes=len(encoded),order=name)),flush=True)

if __name__=='__main__':main()
