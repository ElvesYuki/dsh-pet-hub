// Original MIT process fixture, no USB, network or external tool imports.
import {readFileSync,lstatSync} from 'node:fs';import {spawn} from 'node:child_process';
const args=process.argv.slice(2);if(args.length!==7||args[0]!=='--config'||args[2]!=='--apply'||args[3]!=='--port'||args[5]!=='--hold-seconds')process.exit(2);
const file=args[1],mode=args[4].slice('/dev/'.length),config=JSON.parse(readFileSync(file,'utf8'));
if((lstatSync(file).mode&0o077)!==0||config.profile!=='native400-device-lan-ram/1'||process.env.PYTHONPATH!==undefined||process.env.PYTHONDONTWRITEBYTECODE!=='1')process.exit(2);
const queued=JSON.stringify({result:'queued-not-connected-or-presented'})+'\n',status=JSON.stringify({result:'status',phase:3,cleanup_complete:false})+'\n';
function finish(text,code=0){process.stdout.write(text,()=>process.exit(code));}
if(mode==='queued')finish(queued+status);
else if(mode==='duplicate')finish(queued+queued);
else if(mode==='statusfirst')finish(status);
else if(mode==='truncated')finish(queued.trim());
else if(mode==='badjson')finish('{"result":');
else if(mode==='duplicatekeys')finish('{"result":"status","result":"queued-not-connected-or-presented"}\n');
else if(mode==='extra')finish('{"result":"queued-not-connected-or-presented","extra":true}\n');
else if(mode==='phase')finish(queued+'{"result":"status","phase":7,"cleanup_complete":false}\n');
else if(mode==='failed')finish(JSON.stringify({result:'failed-or-unconfirmed',reason:'original-refusal',automatic_retry:false})+'\n',1);
else if(mode==='utf8')process.stdout.write(Buffer.from([0xff,10]),()=>process.exit(0));
else if(mode==='stdoutflood')finish('x'.repeat(140000));
else if(mode==='stderrflood')process.stderr.write('x'.repeat(18000),()=>finish(queued));
else if(mode==='secret')finish(config.wifi.password+'\n');
else if(mode==='stderr')process.stderr.write(config.wifi.password+'\n',()=>finish(queued));
else if(mode==='nonzero')finish(queued,1);
else if(mode==='wait'||mode==='ignoreterm'){
 process.on('SIGTERM',()=>{if(mode==='wait')setTimeout(()=>process.exit(0),150);});process.stdout.write(queued);setInterval(()=>{},1000);
}else if(mode==='pipechild'){
 process.stdout.write(queued,()=>{spawn(process.execPath,['-e','setTimeout(()=>{},250)'],{stdio:['ignore','inherit','inherit']});process.exit(0);});
}else process.exit(2);
