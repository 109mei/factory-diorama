/** Pure production model. No renderer, wall clock, randomness, or browser state. */
export const STATIONS=['mine','crusher','sorter','smelter','press','packer','shipping'] as const;
export type Station=typeof STATIONS[number];
export const PROCESS_STATIONS=['crusher','sorter','smelter','press','packer'] as const;
export const UNLOCK_COSTS=[40,120,360,900,2200] as const;
export const ITEM_VALUES=[2,4,7,12,20,32] as const;
export type Stage=0|1|2|3|4|5|6|7|8|9|10|11;
export interface Item {id:number;stage:Stage;progress:number;quality:number;value:number;}
export interface GameState {credits:number;unlocked:number;levels:Record<Station,number>;items:Item[];mineTimer:number;accumulator:number;ticks:number;mined:number;shipped:number;nextId:number;}
export const TOTAL_STAGES=(STATIONS.length-1)*2;
export const MAX_LEVEL=6, STAGE_CAPACITY=18, MAX_ITEMS=STAGE_CAPACITY*TOTAL_STAGES, STEP=.1;
export const CYCLE_SECONDS:Record<Station,number>={mine:3.2,crusher:2.4,sorter:2.2,smelter:2.6,press:3.2,packer:2.4,shipping:2};
export const STAGE_SECONDS:readonly number[]=STATIONS.slice(1).flatMap(station=>[1.8,CYCLE_SECONDS[station]]);
export function createGame():GameState {return {credits:0,unlocked:0,levels:Object.fromEntries(STATIONS.map(station=>[station,1])) as Record<Station,number>,items:[],mineTimer:0,accumulator:0,ticks:0,mined:0,shipped:0,nextId:1};}
export function isStationUnlocked(state:GameState,station:Station):boolean {
 const index=STATIONS.indexOf(station);
 return index===0||index===STATIONS.length-1||(index>0&&index<=state.unlocked);
}
export function nextUnlock(state:GameState):typeof PROCESS_STATIONS[number]|null {return PROCESS_STATIONS[state.unlocked]??null;}
export function unlockCost(state:GameState):number {return UNLOCK_COSTS[state.unlocked]??0;}
export function unlockNext(state:GameState):boolean {
 if(nextUnlock(state)===null)return false;
 const cost=unlockCost(state);if(state.credits<cost)return false;
 state.credits-=cost;state.unlocked++;return true;
}
export function upgradeCost(state:GameState,station:Station):number {return Math.ceil(20*2.1**(state.levels[station]-1));}
export function buyUpgrade(state:GameState,station:Station):boolean {
 if(!isStationUnlocked(state,station)||state.levels[station]>=MAX_LEVEL)return false;
 const cost=upgradeCost(state,station);if(state.credits<cost)return false;
 state.credits-=cost;state.levels[station]++;return true;
}
export function stationStats(state:GameState,station:Station){
 const index=STATIONS.indexOf(station);
 const items=index===0?[]:state.items.filter(item=>item.stage===index*2-1);
 return {capacity:state.levels[station],perMinute:60/CYCLE_SECONDS[station]*state.levels[station],queued:Math.max(0,items.length-state.levels[station]),working:Math.min(items.length,state.levels[station]),progress:index===0?state.mineTimer/(CYCLE_SECONDS.mine/state.levels.mine):(items[0]?.progress??0)};
}
function tick(state:GameState){
 // Work downstream first. A unit can cross at most one stage per tick.
 for(let stage=TOTAL_STAGES-1;stage>=0;stage--){
  const row=state.items.filter(item=>item.stage===stage);
  const isMachine=stage%2===1;
  const capacity=isMachine?state.levels[STATIONS[(stage+1)/2]]:STAGE_CAPACITY;
  // Locked processes are bypassed to the next belt, with the same capacity limit.
  let nextStage=stage+1;
  if(!isMachine&&!isStationUnlocked(state,STATIONS[stage/2+1]))nextStage++;
  const nextCount=state.items.filter(item=>item.stage===nextStage).length;
  let room=STAGE_CAPACITY-nextCount;
  for(let index=0;index<row.length;index++){
   const item=row[index];if(isMachine&&index>=capacity)continue;
   item.progress=Math.min(1,item.progress+STEP/STAGE_SECONDS[stage]);
   if(item.progress<1-1e-8)continue;
   if(stage===TOTAL_STAGES-1){state.items.splice(state.items.indexOf(item),1);state.shipped++;state.credits+=item.value;}
   else {
    if(isMachine){item.quality=(stage+1)/2;item.value=ITEM_VALUES[item.quality];}
    if(room>0){item.stage=nextStage as Stage;item.progress=0;room--;}
   }
  }
 }
 const interval=CYCLE_SECONDS.mine/state.levels.mine;
 state.mineTimer+=STEP;
 if(state.mineTimer>=interval-1e-8&&state.items.filter(item=>item.stage===0).length<STAGE_CAPACITY){
  state.mineTimer=Math.max(0,state.mineTimer-interval);state.items.push({id:state.nextId++,stage:0,progress:0,quality:0,value:ITEM_VALUES[0]});state.mined++;
 } else if(state.mineTimer>=interval){
  // A blocked mine stores only one ready unit, never an unlimited backlog.
  state.mineTimer=interval;
 }
 state.ticks++;
}
export function step(state:GameState,dt:number):void {
 if(!Number.isFinite(dt)||dt<=0)return;
 const total=state.accumulator+Math.min(dt,1800);
 const count=Math.floor((total+1e-8)/STEP);
 // Keep fractional frame time instead of rounding every frame and accumulating drift.
 state.accumulator=Math.max(0,total-count*STEP);
 for(let index=0;index<count;index++)tick(state);
}
