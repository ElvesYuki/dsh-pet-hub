// Original isolated parent fixture. No external profile or device input.
import {readdirSync} from 'node:fs';import {join} from 'node:path';
import {hostFixture,delay} from './native400-pet-hold-host.mjs';
import {send,command,until} from './native400-controls-test-support.mjs';
const mode=process.argv[2],hooks=[],events=[];let posts=0,paused=false;
const q=await hostFixture({after:fn=>hooks.push(fn)},{runMs:12000,observe:e=>{if(e.method==='POST'){events.push(e);posts++;if(mode==='unknown'&&posts===2&&!paused){paused=true;process.send({kind:'pausing'});process.kill(process.pid,'SIGSTOP');}}}});
await q.started();
process.send({kind:'ready',child_pid:q.host.resources().child_pid,home:join(process.env.TMPDIR,readdirSync(process.env.TMPDIR).find(n=>n.startsWith('pet-hold-host-')))});
process.on('message',async m=>{try{
 if(m.kind==='exit_parent')process.exit(0);
 if(m.kind==='manual_confirm'){
  await until(()=>q.host.snapshot().run?.phase==='unknown');await send(q.x,command(await q.status(),11));q.host.confirm();await until(()=>q.host.snapshot().run?.phase==='stopped');
  const result=await q.host.close(),manual=(await q.status()).shared.desired?.action;await q.close();
  process.send({kind:'done',phase:result.phase,manual,unknown_observed:true,exact_original_body:events.length>=3&&events[1].body_sha256===events[2].body_sha256&&events[1].request_seq===events[2].request_seq,own_resources:q.host.resources(),snapshot_removed:q.snapshot.snapshot().removed});process.disconnect();
 }
}catch{process.send({kind:'failed'});await q.close();process.disconnect();}});
