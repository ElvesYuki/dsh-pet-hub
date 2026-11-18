// Display-only sizing. Logical character coordinates and source textures always stay 360.
export function characterDisplayMetrics(dpr=1,zoom=1,mode='smooth'){
 if(![1,2].includes(zoom)||!['smooth','pixels'].includes(mode))throw new Error('invalid_character_display');
 const ratio=Number.isFinite(dpr)&&dpr>0?dpr:1,backing=Math.max(360,Math.min(1440,Math.round(360*zoom*ratio)));
 return {logical:360,css:360*zoom,backing,scale:backing/360,dpr:ratio,zoom,mode};
}
/** Resize only display surfaces, repaint even while paused, and release resize/DPR listeners.
 * environment is a browser window (injectable for lifecycle tests); onChange never advances time. */
export function createCharacterDisplay({canvases,onChange,environment=window,signal}){
 let zoom=1,mode='smooth',metrics=null,closed=false,query=null;
 function unwatch(){query?.removeEventListener('change',dprChanged);query=null;}
 function watch(){unwatch();if(environment.matchMedia){query=environment.matchMedia(`(resolution: ${environment.devicePixelRatio}dppx)`);query.addEventListener('change',dprChanged);}}
 function refresh(force=false){if(closed)return;const next=characterDisplayMetrics(environment.devicePixelRatio,zoom,mode);if(!force&&metrics&&JSON.stringify(next)===JSON.stringify(metrics))return;
  for(const canvas of canvases){if(canvas.width!==next.backing)canvas.width=next.backing;if(canvas.height!==next.backing)canvas.height=next.backing;}metrics=next;onChange({...metrics});
 }
 function resized(){refresh();}
 function dprChanged(){if(closed)return;watch();refresh();}
 function close(){if(closed)return;closed=true;unwatch();environment.removeEventListener('resize',resized);signal?.removeEventListener('abort',close);}
 if(signal?.aborted){closed=true;}else{environment.addEventListener('resize',resized);signal?.addEventListener('abort',close,{once:true});watch();}
 return {refresh:()=>refresh(true),set(next){if(closed)return;const z=next.zoom??zoom,m=next.mode??mode;characterDisplayMetrics(environment.devicePixelRatio,z,m);zoom=z;mode=m;refresh();},status:()=>metrics?{...metrics}:null,close};
}
/** Present a canonical frame with an explicit sampling policy; never read pixels back into art. */
export function presentCharacterFrame(target,source,scale,{pixels=false}={}){
 target.setTransform(1,0,0,1,0,0);target.clearRect(0,0,target.canvas.width,target.canvas.height);target.imageSmoothingEnabled=!pixels;target.imageSmoothingQuality='low';target.setTransform(scale,0,0,scale,0,0);target.drawImage(source,0,0);target.setTransform(1,0,0,1,0,0);
}
