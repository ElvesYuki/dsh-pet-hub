import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {Pet4Decoder} from '../packages/core/pet4.mjs';
function python(code){const r=spawnSync('python3',['-B','-c',code],{encoding:'utf8',maxBuffer:2097152});assert.equal(r.status,0,r.stderr);return r.stdout;}
const load=String.raw`import importlib.util, pathlib
s=importlib.util.spec_from_file_location('optimizer',pathlib.Path('scripts/optimize-native400-lossless.py'));o=importlib.util.module_from_spec(s);s.loader.exec_module(o)
`;
test('compression: Python palette dedup/remap PET4 roundtrip preserves RGB pixels using independent JS decoder',()=>{const encoded=python(load+String.raw`import struct,base64
palette=[0,0xf800,0xf800,0x7e0]+[0]*252
frames=[bytes([0,1,2,3])*40000,bytes([3,2,1,0])*40000]
p,table=o.mappings(palette,frames,True)['nearest-rotate2']
codec=o.Codec.__new__(o.Codec)
def literals(data):
 chunks=[]
 for at in range(0,160000,8000):
  raw=data[at:at+8000];n=len(raw)-15;extra=[]
  while n>=255:extra.append(255);n-=255
  packed=bytes([240]+extra+[n])+raw;chunks.extend((struct.pack('<H',len(packed)),packed))
 return b''.join(chunks)
codec.packed=literals
header=bytearray(532);header[:4]=b'PET4';struct.pack_into('<HHHH',header,4,400,400,24,2);struct.pack_into('<HH',header,524,12,1)
b,_,_=codec.encode(header,frames,p,table)
print(base64.b64encode(b).decode())
`);const d=new Pet4Decoder(Buffer.from(encoded.trim(),'base64'),{profile:'native400-candidate-v1'});for(const f of [0,1,0]){const rgb=d.decode(f).rgb565,colors=f?[0x7e0,0xf800,0xf800,0]:[0,0xf800,0xf800,0x7e0];for(let i=0;i<160000;i++)assert.equal(rgb[i*2]|rgb[i*2+1]<<8,colors[i%4]);}});
test('compression: lossy merge keeps black exact and reports foreground error separately',()=>{const out=python(load+String.raw`s=importlib.util.spec_from_file_location('quantizer',pathlib.Path('scripts/quantize-native400-to-limit.py'));q=importlib.util.module_from_spec(s);s.loader.exec_module(q)
palette=[0,0xf800,0xf801,0xf820]+[0]*252
frames=[bytes([0])*159000+bytes([1,2,3])*333+bytes([0])]
_,new,table,_=next(q.quant_tables(palette,frames,[2]))
assert new[table[0]]==0
stats=q.error_stats(palette,new,table,frames)
assert stats['changed_foreground_fraction']>0
assert max(stats['additional_foreground_mae_rgb'])>max(stats['additional_mae_rgb'])
print('ok')
`);assert.equal(out.trim(),'ok');});
