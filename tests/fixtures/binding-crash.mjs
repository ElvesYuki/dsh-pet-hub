import {openBindingStore} from '../../packages/runtime/binding-store.mjs';
const [directory,stage]=process.argv.slice(2);
const store=openBindingStore({directory,fault:at=>{if(at===stage)process.kill(process.pid,'SIGKILL');}});
store.freeze('D');store.revoke('1','D','crash-operation');
throw new Error('crash cutpoint not reached');
