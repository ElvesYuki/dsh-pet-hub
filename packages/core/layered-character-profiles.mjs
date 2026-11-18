import {layeredEqual,layeredRequire} from './layered-character-json.mjs';
// Contract snapshots only: this registry validates data; it does not execute animation.
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const layeredRigParts=freeze([
 ['ahoge','head',[165,77]],['back_left_tip','back_left',[94,258]],['back_right_tip','back_right',[258,248]],
 ['fringe_center','head',[166,101]],['fringe_left','head',[136,102]],['fringe_right','head',[202,106]],
 ['side_left','head',[107,142]],['side_right','head',[231,143]],['hair_cap','head',[174,119]],
 ['back_left','head',[100,145]],['back_right','head',[240,145]],['back_center','head',[174,150]],
 ['body',null,[169,235]],['head','body',[169,202]],['arm_left','body',[143,216]],['arm_right','body',[195,216]],
 ['tail','body',[228,269]],['head_accessories','head',[174,119]],['eyes','head',[166,174]],['brows','head',[166,145]],['mouth','head',[164,193]]
]);
export const layeredDrawOrder=freeze(['back_center','back_right_tip','back_left_tip','back_right','back_left','tail','body','arm_left','arm_right','head','side_right','side_left','hair_cap','brows','eyes','mouth','fringe_right','fringe_left','fringe_center','ahoge','head_accessories']);
export const layeredMovingHair=freeze(['fringe_left','fringe_center','fringe_right','side_left','side_right','back_left','back_center','back_right','ahoge','back_left_tip','back_right_tip']);
const channels={head:{omega:8,zeta:.76,limit:1.15,speed:3.5},head_y:{omega:9,zeta:.9,limit:.65,speed:2},arm_left:{omega:9,zeta:.8,limit:3,speed:12},arm_right:{omega:9,zeta:.8,limit:3,speed:12},tail:{omega:7,zeta:.65,limit:1.1,speed:4}};
for(const id of layeredMovingHair)channels[id]={omega:id==='ahoge'?12:id.endsWith('_tip')?7.6:id.startsWith('back')?6.4:9.5,zeta:id==='ahoge'?.48:id.endsWith('_tip')?.58:.72,limit:id.endsWith('_tip')?1.8:id==='ahoge'?1.6:id==='back_center'?.5:1.2,speed:id.endsWith('_tip')?6:5};
const profiles={
 rig_21_v1:{coordinate:'canvas_px',root_translation:[0,0],root_scale:[1,1],rotation:'clockwise_degrees',pixel_center:[.5,.5]},
 rgba_png_v1:{width:360,height:360,bit_depth:8,color_type:6,interlace:0,alpha:'straight',blend:'source_over'},
 natural_120hz_v1:{integration_hz:120,tick_epsilon:1e-8,channels,moving_hair:layeredMovingHair,breath:{period:4.8,inhale:.42,exhale:.58},head:{sway:.19,sway_pi_divisor:4,breath:.08,head_touch:.95,body_touch:.24},head_y:{breath:-.45,body_touch:.28,head_touch:-.12},arms:{breath:.16,body_touch:.45},tail:{wind:.18,wind_pi_divisor:2.4,body_touch:1},hair:{phase_step:.51,wind_pi_divisor:2.4,wind_back_center:.08,wind_fringe:.12,wind_other:.24,parent_position:.30,parent_velocity:-.11,acceleration_ahoge:-1.4,acceleration_back:-.8,acceleration_other:-.45},touch:{cooldown_ticks:18,pulse_seconds:.6,side_center:175,side_divisor:65,direction_min:.55,direction_range:.45,head_impulse:1.45,body_impulse:.65,hair_impulse_ahoge:2,hair_impulse_tip:1.2,hair_impulse_other:.55,expression_hold:1.07}},
 character_states_v1:{base_states:['idle','thinking','working'],blend_seconds:.45,completion_seconds:1.4,completion_history:32,id_max_length:64,expression_entry:.12,expression_exit_start:1,expression_exit_duration:.30,success_eye_thresholds:[.055,.10,1.05,1.11,1.23],thinking_half_threshold:.5,motion:{head_thinking:.82,head_working:-.25,head_success:.32,sway_thinking:-.5,sway_working:-.65,head_y_working:.13,head_y_success:-.22,arm_amplitude:2.2,arm_pi_divisor:.8,arm_success:1.2,tail_success:.3}},
 expression_v1:{max_seconds:3600,blink:{first:2.15,seed:173,multiplier:1664525,increment:1013904223,modulus:4294967296,interval_min:2.7,interval_range:2.2,thresholds:[.05,.11,.20]},touch:{hold:1.07,entry:.16,release_start:.85,release_duration:.22,eye_entry:[.055,.10],eye_release:[.85,.91,1.02]}},
 silent_speech_v1:{id_max_length:64,duration_default:5,duration_min:.5,duration_max:30,start_seconds:.08,end_seconds:.16,period:1.44,gap_start:1.21,cues:[[0,'small'],[.12,'open'],[.26,'small'],[.39,'round'],[.55,'closed'],[.68,'small'],[.82,'open'],[.97,'small'],[1.09,'round'],[1.21,'closed']],paused_mouth:'closed'},
 wave_v1:{entry_seconds:.45,wave_seconds:1.5,exit_start:1.95,total_seconds:2.4,cancel_seconds:.3,amplitude_degrees:4,cycles:3,angular_frequency_pi:4,shoulder:[195,216],wrist_down:[217,251],wrist_up:[229,200],draw_rule:'right_arm_foreground_during_wave',busy:'reject',cancel:'generation'},
 arm_contour_distance_v1:{mask_alpha:128,roi_alpha:1,margin_px:3,propagation_round_trips:2,edge_offset:.5,edge_slope:1,fill:'nearest_opaque',transform:'shoulder_wrist_similarity',endpoints:'exact'}
};
export const layeredProfileIds=freeze(Object.keys(profiles));
export const layeredBehaviorBaseline=freeze({profiles,rules:{max_replay_seconds:60,max_step_seconds:60,events_per_channel:400,same_time:'caller_order',face_priority:['head_touch','success','blink'],mouth_owner:'speech',wave_owner:'arm_right',return_base:'latest',root:'identity'}});
export const layeredCanvas=freeze({width:360,height:360,origin:'top_left',pixel_center:[.5,.5],center:[180,180],safe_circle_radius:166.5,root_translation:[0,0],root_scale:[1,1]});
export const layeredTouch=freeze({bounds:[70,50,281,315],head_y_lt:204,reference_alpha_min:16,cooldown_seconds:.15});
export const layeredPose=freeze({part:'arm_right',shoulder:[195,216],wrist_down:[217,251],wrist_up:[229,200],draw_rule:'right_arm_foreground_during_wave'});
/** Returns fresh contract data, never engine/DOM state. */
export const layeredBehaviorDefaults=()=>structuredClone(layeredBehaviorBaseline);

const resolvedCharacterBehaviors=new WeakSet([layeredBehaviorBaseline]);
/** Admit the complete fixed v1 behavior before constructing a solver; snapshot external data.
 * Previously admitted snapshots are reusable without reparsing; caller-owned objects are rechecked.
 * No package code is evaluated. Invalid/mutated/unknown behavior throws unsupported_profile.
 */
export function resolveCharacterBehavior(value=layeredBehaviorBaseline){
 if(value&&typeof value==='object'&&resolvedCharacterBehaviors.has(value))return value;
 layeredRequire(layeredEqual(value,layeredBehaviorBaseline),'unsupported_profile');
 const snapshot=freeze(structuredClone(value));resolvedCharacterBehaviors.add(snapshot);return snapshot;
}
