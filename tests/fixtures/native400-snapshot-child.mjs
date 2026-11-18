import {result} from './native400-snapshot-dependency.mjs';
const at=process.argv.indexOf('--hold-seconds'),hold=Number(process.argv[at+1]);
console.log(JSON.stringify({result}));
if(hold)await new Promise(resolve=>{const timer=setTimeout(resolve,hold*1000);process.once('SIGTERM',()=>{clearTimeout(timer);setTimeout(resolve,80);});});
