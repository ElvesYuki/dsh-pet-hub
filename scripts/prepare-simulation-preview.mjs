import { openSync, readSync, closeSync, mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
const {values}=parseArgs({options:{'app-asar':{type:'string',default:'/Applications/DeepSeek Harness.app/Contents/Resources/app.asar'}}});
const fd=openSync(values['app-asar'],'r');
try {
  const header=Buffer.alloc(16);readSync(fd,header,0,16,0);
  const length=header.readUInt32LE(12);if(length>32*1024*1024)throw new Error('Unexpected ASAR header');
  const bytes=Buffer.alloc(length);readSync(fd,bytes,0,length,16);const tree=JSON.parse(bytes.toString());const base=8+header.readUInt32LE(4);
  function read(path){let item=tree;for(const key of path.split('/'))item=item.files[key];if(!item || item.size>2*1024*1024 || item.unpacked)throw new Error('Unsupported installed asset');const data=Buffer.alloc(item.size);readSync(fd,data,0,data.length,base+Number(item.offset));return data.toString();}
  const app=JSON.parse(read('package.json'));if(app.version!=='0.2.1-rc.3')throw new Error('Preview extraction validated only for installed DSH 0.2.1-rc.3');
  const assets=tree.files.dsh.files.node_modules.files['@deepseek-ai'].files['dsh-web-frontend'].files.dist.files.assets.files;
  const filename=Object.keys(assets).find(name=>/^index-.*\.js$/.test(name));
  const source=read(`dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/${filename}`);
  const begin=source.indexOf('var l0={exports:{}}'),end=source.indexOf('var Ql={}',begin);
  if(begin<0 || end<=begin || !source.slice(begin,end).includes('Te.version="18.3.1"'))throw new Error('Installed frontend layout changed; inspect before previewing');
  const helpers='function qs(e){return e&&e.__esModule&&Object.prototype.hasOwnProperty.call(e,"default")?e.default:e;}\nfunction P1(t,ss){for(const s of ss)Object.assign(t,s);return t;}\n';
  mkdirSync('.cache/s2',{recursive:true});writeFileSync('.cache/s2/react-seed.js',helpers+source.slice(begin,end)+'\nwindow.React=C;window.ReactDOM=Sn;\n');
  console.log('Prepared local React/ReactDOM preview seed in ignored .cache/s2; application unchanged.');
} finally{closeSync(fd);}
