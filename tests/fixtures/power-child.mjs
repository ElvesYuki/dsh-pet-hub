const mode=process.argv[2];
const emit=(type,seq)=>process.stdout.write(JSON.stringify({protocol:'hub-power/1',type,seq})+'\n');
if(mode==='bad-start')emit('resume','0');
else if(mode==='oversize')process.stdout.write('x'.repeat(513));
else if(mode==='partial')process.stdout.write('{');
else if(mode==='utf8')process.stdout.write(Buffer.from([255,10]));
else if(mode==='exit')process.exitCode=0;
else if(mode!=='silent'){
 emit('ready','0');
 setImmediate(()=>{if(mode==='sequence')emit('suspend','2');else if(mode==='ordered'){emit('suspend','1');emit('resume','2');}else if(mode==='schema')process.stdout.write('{"protocol":"hub-power/1","seq":"1","type":"resume","extra":true}\n');else if(mode==='eof')process.exit(0);});
}
if(mode!=='exit')process.stdin.resume();
