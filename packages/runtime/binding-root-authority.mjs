import {requireThat} from '../core/protocol.mjs';
/** Same binding/root owner. prepare runs within its readonly scope, commit MUST run after it exits. */
export function bindingRootAuthority(store){return {
 checkpoint:device=>store.rootCheckpoint(device),
 prepare(context){const data=store.read(),r=store.record(context.device_id);requireThat(store.isAdmitted(r.device_id)&&r.binding_id===context.binding_id&&r.binding_epoch===context.binding_epoch&&r.controller_id===context.controller_id,'stale_binding');return data.revision;},
 commit:(expected,checkpoint)=>store.commitRoot(expected,checkpoint)
};}
