import {readFileSync,appendFileSync} from 'node:fs';import {join} from 'node:path';
import {prepareNative400SourceReview} from '../../packages/runtime/native400-source-review-host.mjs';
import {startOrAttach} from '../../packages/runtime/service.mjs';
// Explicit test-only private root and original MIT metadata. No source reads or devices.
const root=process.argv[2],inputs=JSON.parse(readFileSync(join(root,'inputs.json'),'utf8'));
const sourceReview=prepareNative400SourceReview({...inputs,createJournal:true,beforeOpen:()=>appendFileSync(join(root,'owner-opens'),'open\n',{mode:0o600})});
const hub=await startOrAttach({directory:join(root,'service'),sourceReview});let closing=false;
const stop=async()=>{if(closing)return;closing=true;try{await hub.close();process.exitCode=0;}catch{process.exitCode=1;}finally{process.stdin.destroy();}};
process.on('SIGTERM',stop);process.on('SIGINT',stop);process.stdin.resume();
process.stdout.write(JSON.stringify({role:hub.role})+'\n');
