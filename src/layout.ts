import {STATIONS,STAGE_CAPACITY,type GameState,type Station,type Item} from './simulation';
export const STATION_POSITIONS:Record<Station,[number,number]>={mine:[-1,-8],smelter:[1,-2.7],press:[-1,2.7],shipping:[1,8]};
export const BELT_ROUTES=[ [[-1,-7.1],[2.8,-7.1],[2.8,-2.7],[1,-2.7]], [[1,-1.75],[-2.8,-1.75],[-2.8,2.7],[-1,2.7]], [[-1,3.65],[2.8,3.65],[2.8,8],[1,8]] ];
function pointOnRoute(route:number,t:number):[number,number,number]{
 const points=BELT_ROUTES[route];const lengths=points.slice(1).map((b,i)=>Math.hypot(b[0]-points[i][0],b[1]-points[i][1]));
 let distance=Math.max(0,Math.min(.999,t))*lengths.reduce((a,b)=>a+b,0);
 for(let i=0;i<lengths.length;i++){if(distance<=lengths[i]||i===lengths.length-1){const a=points[i],b=points[i+1],p=distance/lengths[i];return [a[0]+(b[0]-a[0])*p,a[1]+(b[1]-a[1])*p,Math.atan2(b[0]-a[0],b[1]-a[1])];}distance-=lengths[i];}
 return [0,0,0];
}
/** Fit the entire bounded FIFO on the belt: blocked outlets and batch infeed alike. */
export function visualItemPosition(item:Item,state:GameState):[number,number,number,number]{
 if(item.stage%2===0){
  const row=state.items.filter(i=>i.stage===item.stage);
  const index=row.indexOf(item),gap=1/(STAGE_CAPACITY-.5);
  let progress=1+gap;
  for(let i=0;i<=index;i++)progress=Math.max((row.length-1-i)*gap,Math.min(row[i].progress,progress-gap));
  const [x,z,angle]=pointOnRoute(item.stage/2,progress);return [x,1.02,z,angle];
 }
 const station=STATIONS[(item.stage+1)/2],same=state.items.filter(i=>i.stage===item.stage),index=same.indexOf(item),[x,z]=STATION_POSITIONS[station];
 if(index<state.levels[station])return [x+(index%3-1)*.36,.95,z-.45+Math.floor(index/3)*.38,0];
 const q=index-state.levels[station];return [x-1.07+(q%4)*.36,.77,z+1.18+Math.floor(q/4)*.28,0];
}
