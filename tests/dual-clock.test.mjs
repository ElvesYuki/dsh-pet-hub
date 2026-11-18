import test from 'node:test';import assert from 'node:assert/strict';import {createDualClockLab} from '../packages/simulator/dual-clock.mjs';
const reject=(fn,code)=>assert.throws(fn,{code});const setup=(opts)=>{const l=createDualClockLab(opts),ctx=l.connect(),p=l.acquire(ctx);l.observe(ctx,p);return {l,ctx,p};};
for(const [h,d] of [[0,800000],[900000,0]])test(`dual clocks: offsets host=${h} device=${d}, elapsed independent of host uptime`,()=>{
 const {l,ctx,p}=setup({hostStart:h,deviceStart:d});l.play(ctx,p,l.command(11,'1'));l.device.advance(4000);l.host.advance(100);assert.equal(l.registry.report(ctx,l.actor.report()),true);assert.equal(l.registry.summary().devices[0].actual,11);assert.equal(l.registry.summary().devices[0].started,h);l.close();
});
test('relative deadline: delayed grant uses original send time, exact expiry rejects without mutation',()=>{
 const l=createDualClockLab(),ctx=l.connect(),p=l.acquire(ctx);l.send('control',ctx,p,{delay:3000});l.host.advance(3000);l.device.advance(3000);l.link.advance(3000);assert.equal(l.queue.flush()[0].ok,true);l.host.advance(12000);const before=l.registry.summary();reject(()=>l.observe(ctx,p),'lease_expired');assert.deepEqual(l.registry.summary(),before);assert.equal(before.devices[0].controlled,false);
});
test('late acquire response expires; duplicate response cannot renew deadline',()=>{
 const l=createDualClockLab(),ctx=l.connect(),p=l.acquire(ctx);l.send('control',ctx,p,{copies:2});assert.ok(l.queue.flush().every(r=>r.ok));l.host.advance(15000);reject(()=>l.observe(ctx,p),'lease_expired');assert.equal(l.registry.summary().devices[0].controlled,false);
 const other=createDualClockLab(),c=other.connect(),g=other.acquire(c);other.host.advance(16000);reject(()=>other.observe(c,g),'lease_expired');assert.equal(other.registry.summary().devices[0].controlled,false);
});
test('renew response reorder rejects old observation; old report cannot replace current grant',()=>{
 const {l,ctx,p}=setup();l.play(ctx,p,l.command(0,'1'));const old=l.actor.report();l.host.advance(5000);l.device.advance(5000);const next=l.renew(ctx,p);l.send('control',ctx,p);l.send('control',ctx,next);const results=l.queue.flush({reverse:true});assert.equal(results[0].ok,true);assert.equal(results[1].code,'stale_control');reject(()=>l.registry.report(ctx,old),'stale_control');assert.equal(l.registry.report(ctx,l.actor.report()),true);reject(()=>l.registry.control(ctx,next.grant),'invalid_message');
});
test('fast device expiration is authoritative, newer epoch fences old owner before host deadline',()=>{
 const {l,ctx,p}=setup();l.play(ctx,p,l.command(0,'1'));l.device.advance(15000);reject(()=>l.actor.set(ctx,p.grant,l.command(11,'2')),'lease_expired');const newer=l.acquire(ctx);l.observe(ctx,newer);reject(()=>l.actor.set(ctx,p.grant,l.command(11,'2')),'stale_control');reject(()=>l.observe(ctx,p),'stale_control');l.play(ctx,newer,l.command(58,'1'));assert.equal(l.registry.summary().devices[0].actual,58);
});
test('slow/paused device does not extend host belief; fresh renewal explicitly restores control',()=>{
 const {l,ctx,p}=setup();l.play(ctx,p,l.command(0,'1'));l.host.advance(15000);assert.equal(l.actor.snapshot().controlled,true);assert.equal(l.registry.summary().devices[0].controlled,false);reject(()=>l.registry.report(ctx,l.actor.report()),'lease_expired');const next=l.renew(ctx,p);l.observe(ctx,next);assert.equal(l.registry.summary().devices[0].controlled,true);
});
test('disconnect fences queued results and reconnect converges to latest target instead of old set',()=>{
 const {l,ctx,p}=setup();l.play(ctx,p,l.command(0,'1'));const oldcmd=l.command(11,'2');l.send('set',ctx,{grant:p.grant,command:oldcmd},{delay:100});l.send('report',ctx,l.actor.report(),{delay:100});l.registry.disconnect(ctx);l.actor.disconnect(ctx);assert.equal(l.registry.summary().devices[0].actual,0);assert.equal(l.registry.summary().devices[0].connection,'offline');
 const fresh=l.connect(),g=l.acquire(fresh);l.observe(fresh,g);assert.equal(l.registry.summary().devices[0].actual,null);l.play(fresh,g,l.command(58,'1'));l.link.advance(100);assert.ok(l.queue.flush({reverse:true}).every(r=>r.code==='stale_session'));assert.equal(l.registry.summary().devices[0].actual,58);
});
test('boot and host restart discard old receipt contexts; dropped set needs new latest revision',()=>{
 const {l,ctx,p}=setup();l.play(ctx,p,l.command(0,'1'));const old=l.actor.report();l.send('set',ctx,{grant:p.grant,command:l.command(11,'2')},{drop:true});assert.deepEqual(l.queue.flush(),[]);l.play(ctx,p,l.command(58,'3'));assert.equal(l.registry.summary().devices[0].actual,58);
 l.actor.reboot();const c=l.connect(),g=l.acquire(c);l.observe(c,g);reject(()=>l.registry.report(ctx,old),'stale_boot');l.restartHost();reject(()=>l.registry.report(c,old),'stale_session');const c2=l.connect('H'),g2=l.acquire(c2);l.observe(c2,g2);l.play(c2,g2,l.command(11,'1'));assert.equal(l.registry.summary().devices[0].actual,11);
});
test('snapshot messages and duplicate/out-of-order reports cannot rewind target or timer',()=>{
 const {l,ctx,p}=setup();l.play(ctx,p,l.command(0,'1'));const payload=l.actor.report();l.send('report',ctx,payload,{copies:2});payload.target.action_id=58;const duplicate=l.queue.flush();assert.equal(duplicate[0].value,true);assert.equal(duplicate[1].value,false);assert.ok(duplicate.every(r=>r.ok));const started=l.registry.summary().devices[0].started;l.device.advance(1000);l.host.advance(1000);assert.equal(l.registry.report(ctx,l.actor.report()),true);assert.equal(l.registry.summary().devices[0].started,started);
 l.send('report',ctx,l.actor.report());l.play(ctx,p,l.command(58,'2'));assert.equal(l.queue.flush()[0].code,'stale_revision');
});
test('relative observation schema/future time errors preserve registry; close fences queued callbacks',()=>{
 const {l,ctx,p}=setup(),before=l.registry.summary();for(const observation of [{sent_at:1,lease_ms:15000},{sent_at:0,lease_ms:0},{sent_at:0,lease_ms:15000,extra:1}])reject(()=>l.registry.control(ctx,p.grant,observation),'invalid_message');assert.deepEqual(l.registry.summary(),before);l.send('heartbeat',ctx,'1');l.close();assert.equal(l.queue.flush()[0].code,'closed');reject(()=>l.connect(),'closed');
});
test('bounded rate mismatch: repeated renewals converge at both clock ratios without timer reset',()=>{
 for(const [h,d] of [[4000,6000],[6000,4000]]){const {l,ctx,p}=setup();let current=p;l.play(ctx,p,l.command(11,'1'));const started=l.registry.summary().devices[0].started;
  for(let n=0;n<100;n++){l.host.advance(h);l.device.advance(d);current=l.renew(ctx,current);l.observe(ctx,current);assert.equal(l.registry.report(ctx,l.actor.report()),true);assert.equal(l.registry.summary().devices[0].started,started);assert.equal(l.actor.snapshot().controlled,true);}
  l.close();
 }
});
test('heartbeat freshness belongs only to host clock; replay cannot keep a lost link online',()=>{
 const {l,ctx}=setup();l.registry.heartbeat(ctx,'1');l.host.advance(15000);assert.equal(l.registry.summary().devices[0].connection,'online');assert.equal(l.registry.heartbeat(ctx,'1'),false);l.host.advance(1);assert.equal(l.registry.summary().devices[0].connection,'stale');l.host.advance(15000);assert.equal(l.registry.summary().devices[0].connection,'offline');assert.equal(l.device.now(),800000);l.registry.disconnect(ctx);reject(()=>l.registry.heartbeat(ctx,'2'),'stale_session');
});
