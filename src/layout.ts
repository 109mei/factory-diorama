import {STATIONS,STAGE_CAPACITY,STAGE_SECONDS,type GameState,type Station,type Item} from './simulation';
export const STATION_POSITIONS:Record<Station,[number,number]>={mine:[-1.3,-15],crusher:[1.3,-10],sorter:[-1.3,-5],smelter:[1.3,0],press:[-1.3,5],packer:[1.3,10],shipping:[-1.3,15]};
export const BELT_ROUTES=STATIONS.slice(0,-1).map((station,index)=>{
 const a=STATION_POSITIONS[station],b=STATION_POSITIONS[STATIONS[index+1]],side=index%2===0?3.75:-3.75;
 return [[a[0],a[1]],[a[0],a[1]+1.02],[side,a[1]+1.02],[side,b[1]],[b[0],b[1]]];
});
function pointOnRoute(route:number,t:number):[number,number,number]{
 const points=BELT_ROUTES[route],lengths=points.slice(1).map((b,i)=>Math.hypot(b[0]-points[i][0],b[1]-points[i][1]));
 let distance=Math.max(0,Math.min(.999,t))*lengths.reduce((a,b)=>a+b,0);
 for(let i=0;i<lengths.length;i++){if(distance<=lengths[i]||i===lengths.length-1){const a=points[i],b=points[i+1],p=distance/lengths[i];return [a[0]+(b[0]-a[0])*p,a[1]+(b[1]-a[1])*p,Math.atan2(b[0]-a[0],b[1]-a[1])];}distance-=lengths[i];}
 return [0,0,0];
}
/** A bounded physical queue, with sub-tick interpolation before camera/render easing. */
export function visualItemPosition(item:Item,state:GameState):[number,number,number,number]{
 if(item.stage%2===0){
  const row=state.items.filter(i=>i.stage===item.stage),index=row.indexOf(item),gap=1/(STAGE_CAPACITY-.5);let progress=1+gap;
  for(let i=0;i<=index;i++){const smooth=Math.min(1,row[i].progress+state.accumulator/STAGE_SECONDS[item.stage]);progress=Math.max((row.length-1-i)*gap,Math.min(smooth,progress-gap));}
  const [x,z,angle]=pointOnRoute(item.stage/2,progress);return [x,1.13,z,angle];
 }
 const station=STATIONS[(item.stage+1)/2],same=state.items.filter(i=>i.stage===item.stage),index=same.indexOf(item),[x,z]=STATION_POSITIONS[station];
 if(index<state.levels[station])return [x+(index%3-1)*.43,1.17,z-.42+Math.floor(index/3)*.43,0];
 const q=index-state.levels[station];return [x-1.12+(q%4)*.45,.86,z+1.2+Math.floor(q/4)*.43,0];
}
