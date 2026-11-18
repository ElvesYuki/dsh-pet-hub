import {openBindingStore} from '../../packages/runtime/binding-store.mjs';
import {readFileSync} from 'node:fs';
const [directory,stage,checkpointFile]=process.argv.slice(2);
const store=openBindingStore({directory,rootState:true,fault:at=>{if(at===stage)process.kill(process.pid,'SIGKILL');}});
store.commitRoot('1',JSON.parse(readFileSync(checkpointFile,'utf8')));
throw new Error('crash cutpoint not reached');
