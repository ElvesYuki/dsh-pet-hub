import {id,keys,requireThat} from '../core/protocol.mjs';
export {publicObservationView} from '../core/observation-view.mjs';
/** Internal explicit synthetic factory identity only; never a persisted CLI/plugin configuration. */
export function observationReviewDescriptor(option){keys(option,['id','create']);id(option.id);requireThat(typeof option.create==='function','invalid_observation_review');return {schema_version:1,id:option.id,mode:'synthetic-read-only'};}
