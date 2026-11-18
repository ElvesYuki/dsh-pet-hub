"""Original offline wrapper around an explicitly supplied installed liblz4; no vendor code bundled."""
import argparse,ctypes,hashlib,json,struct,zlib
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--output',required=True);p.add_argument('--library',required=True);a=p.parse_args()
root=Path(a.input).resolve();dest=Path(a.output).resolve();repo=Path.cwd().resolve()
if not dest.is_relative_to(repo/'.cache') or dest.exists():raise ValueError('new_cache_output_required')
for ancestor in [Path(a.output),*Path(a.output).parents]:
 if ancestor.is_symlink():raise ValueError('output_symlink')
m=json.loads((root/'manifest.json').read_text());assert m['profile']=='native400-candidate-v1' and m['license_ref']=='dsh-pet-nc-86181ce'
lib=ctypes.CDLL(str(Path(a.library).resolve()));lib.LZ4_versionString.restype=ctypes.c_char_p
lib.LZ4_decompress_safe.argtypes=[ctypes.c_void_p,ctypes.c_void_p,ctypes.c_int,ctypes.c_int];lib.LZ4_compress_HC.argtypes=[ctypes.c_void_p,ctypes.c_void_p,ctypes.c_int,ctypes.c_int,ctypes.c_int]
dest.mkdir(parents=True);records=[]
for action in m['actions']:
 b=(root/(str(action['id'])+'.pet')).read_bytes();assert hashlib.sha256(b).hexdigest()==action['sha256']
 width,height,fps,frames=struct.unpack_from('<HHHH',b,4);assert (width,height,fps)==(400,400,24) and 1<=frames<=241
 assert zlib.crc32(b[4:528])==struct.unpack_from('<I',b,528)[0]
 base=532+4*(2*frames+1);offsets=struct.unpack_from('<'+'I'*(frames+1),b,532);crcs=struct.unpack_from('<'+'I'*frames,b,532+4*(frames+1));assert offsets[0]==0 and offsets[-1]==len(b)-base
 parts=[];previous=bytes(160000);indices_hash=hashlib.sha256();maximum=0
 for f in range(frames):
  pos=base+offsets[f];end=base+offsets[f+1];tag=b[pos];pos+=1;assert tag in (0,1) and (f%12!=0 or tag==0)
  chunks=[bytes([tag])];frame=bytearray(160000)
  for off in range(0,160000,8000):
   n=struct.unpack_from('<H',b,pos)[0];pos+=2;packed=b[pos:pos+n];pos+=n;assert len(packed)==n and pos<=end
   raw=ctypes.create_string_buffer(8000);assert lib.LZ4_decompress_safe(packed,raw,n,8000)==8000
   source=raw.raw;out=ctypes.create_string_buffer(8047);size=lib.LZ4_compress_HC(source,out,8000,8047,12);assert 0<size<=8047;maximum=max(maximum,size);chunks+=[struct.pack('<H',size),out.raw[:size]]
   frame[off:off+8000]=(int.from_bytes(source,'little')^int.from_bytes(previous[off:off+8000],'little')).to_bytes(8000,'little') if tag else source
  assert pos==end and zlib.crc32(frame)==crcs[f];indices_hash.update(frame);previous=bytes(frame);parts.append(b''.join(chunks))
 assert indices_hash.hexdigest()==action['index_sha256'];table=[];off=0
 for part in parts:table.append(off);off+=len(part)
 table.append(off);result=b[:532]+struct.pack('<'+'I'*len(table),*table)+struct.pack('<'+'I'*frames,*crcs)+b''.join(parts)
 assert len(result)<=16777216
 (dest/(str(action['id'])+'.pet')).write_bytes(result)
 record={**action,'greedy_reference_bytes':action['bytes'],'greedy_reference_sha256':action['sha256'],'bytes':len(result),'sha256':hashlib.sha256(result).hexdigest(),'max_packed_tile_bytes':maximum,'exceeds_legacy_device_asset_limit':len(result)>5865472}
 records.append(record);print(action['id'],action['bytes'],'->',len(result),flush=True)
m.update(recipe='native400-rgb8-black-median-cut256-nearest-lz4hc12-v1',actions=records,compression={'backend':'external installed liblz4','version':lib.LZ4_versionString().decode(),'level':12},independent_index_validation=True,status='offline_hc12_candidate_not_device_approved')
(dest/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2))
