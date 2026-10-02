/** Pure production model. No renderer, wall clock, randomness, or browser state. */
export const STATIONS=['mine','smelter','press','shipping'] as const;
export type Station=typeof STATIONS[number];
export type Stage=0|1|2|3|4|5;
export interface Item {id:number;stage:Stage;progress:number;}
export interface GameState {credits:number;levels:Record<Station,number>;items:Item[];mineTimer:number;accumulator:number;ticks:number;mined:number;shipped:number;nextId:number;}
export const MAX_LEVEL=6, STAGE_CAPACITY=18, MAX_ITEMS=STAGE_CAPACITY*6, STEP=.1;
export const STAGE_SECONDS=[3,2.6,3,3.2,3,2] as const;
export const CYCLE_SECONDS:Record<Station,number>={mine:3.2,smelter:2.6,press:3.2,shipping:2};
export function createGame():GameState {return {credits:0,levels:{mine:1,smelter:1,press:1,shipping:1},items:[],mineTimer:0,accumulator:0,ticks:0,mined:0,shipped:0,nextId:1};}
export function upgradeCost(state:GameState,station:Station):number {return Math.ceil(20*2.1**(state.levels[station]-1));}
export function buyUpgrade(state:GameState,station:Station):boolean {
 if(!STATIONS.includes(station)||state.levels[station]>=MAX_LEVEL)return false;
 const cost=upgradeCost(state,station);if(state.credits<cost)return false;
 state.credits-=cost;state.levels[station]++;return true;
}
export function stationStats(state:GameState,station:Station){
 const index=STATIONS.indexOf(station);
 const items=station==='mine'?[]:state.items.filter(i=>i.stage===index*2-1);
 return {capacity:state.levels[station],perMinute:60/CYCLE_SECONDS[station]*state.levels[station],queued:Math.max(0,items.length-state.levels[station]),working:Math.min(items.length,state.levels[station]),progress:station==='mine'?state.mineTimer/(3.2/state.levels.mine):(items[0]?.progress??0)};
}
function tick(s:GameState){
 // Work downstream first. A unit can cross at most one stage per tick.
 for(let stage=5;stage>=0;stage--){
  const row=s.items.filter(x=>x.stage===stage);
  const isMachine=stage%2===1;
  const capacity=isMachine?s.levels[STATIONS[(stage+1)/2]]:STAGE_CAPACITY;
  const nextCount=s.items.filter(x=>x.stage===stage+1).length;
  let room=STAGE_CAPACITY-nextCount;
  for(let i=0;i<row.length;i++){
   const item=row[i];if(isMachine&&i>=capacity)continue;
   item.progress=Math.min(1,item.progress+STEP/STAGE_SECONDS[stage]);
   if(item.progress<1-1e-8)continue;
   if(stage===5){s.items.splice(s.items.indexOf(item),1);s.shipped++;s.credits+=5;}
   else if(room>0){item.stage=(stage+1) as Stage;item.progress=0;room--;}
  }
 }
 const interval=3.2/s.levels.mine;
 s.mineTimer+=STEP;
 if(s.mineTimer>=interval-1e-8&&s.items.filter(x=>x.stage===0).length<STAGE_CAPACITY){
  s.mineTimer=Math.max(0,s.mineTimer-interval);s.items.push({id:s.nextId++,stage:0,progress:0});s.mined++;
 } else if(s.mineTimer>=interval){
  // A blocked mine stores only one ready unit, never an unlimited backlog.
  s.mineTimer=interval;
 }
 s.ticks++;
}
export function step(state:GameState,dt:number):void {
 if(!Number.isFinite(dt)||dt<=0)return;
 const total=state.accumulator+Math.min(dt,1800);
 const count=Math.floor((total+1e-8)/STEP);
 state.accumulator=Math.max(0,Math.round((total-count*STEP)*1e9)/1e9);
 for(let i=0;i<count;i++)tick(state);
}
