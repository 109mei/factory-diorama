import {createGame,step,STATIONS,TOTAL_STAGES,MAX_LEVEL,STAGE_CAPACITY,CYCLE_SECONDS,STEP,isStationUnlocked,PROCESS_STATIONS,ITEM_VALUES,type GameState,type Stage,type Item} from './simulation';
export const SAVE_KEY='mine-line.save.v2';
export const LEGACY_SAVE_KEY='mine-line.save.v1';
export const OFFLINE_CAP_SECONDS=1800;
const LEGACY_STATIONS=['mine','smelter','press','shipping'] as const;
const LEGACY_STAGE_MAP:readonly Stage[]=[0,5,6,7,8,11];
const LEGACY_QUALITY_MAP=[0,2,3,3,4,4] as const;
type LegacyState=Omit<GameState,'levels'|'items'|'unlocked'>&{levels:Record<typeof LEGACY_STATIONS[number],number>;items:(Omit<Item,'quality'|'value'|'stage'>&{stage:0|1|2|3|4|5})[]};
const int=(value:unknown,max=1e12):value is number=>Number.isSafeInteger(value)&&Number(value)>=0&&Number(value)<=max;
function valid(state:any,stations:readonly string[],stageCount:number,legacy=false):boolean {
 if(!state||!int(state.credits)||!int(state.ticks)||!int(state.mined)||!int(state.shipped)||!int(state.nextId)||state.nextId<1||!state.levels)return false;
 if(!legacy&&!int(state.unlocked,PROCESS_STATIONS.length))return false;
 if(!stations.every(station=>int(state.levels[station],MAX_LEVEL)&&state.levels[station]>=1))return false;
 if(!Number.isFinite(state.mineTimer)||state.mineTimer<0||state.mineTimer>CYCLE_SECONDS.mine||!Number.isFinite(state.accumulator)||state.accumulator<0||state.accumulator>=STEP)return false;
 if(!Array.isArray(state.items)||state.items.length>STAGE_CAPACITY*stageCount||state.mined!==state.shipped+state.items.length)return false;
 const seen=new Set<number>(),counts=Array(stageCount).fill(0);
 return state.items.every((item:any)=>{
  if(!item||!int(item.id)||item.id<1||item.id>=state.nextId||seen.has(item.id)||!int(item.stage,stageCount-1)||!Number.isFinite(item.progress)||item.progress<0||item.progress>1)return false;
  if(!legacy&&(!int(item.quality,state.unlocked)||(item.value!==5&&item.value!==ITEM_VALUES[item.quality])))return false;
  if(!legacy&&item.stage%2===1&&!isStationUnlocked(state,STATIONS[(item.stage+1)/2]))return false;
  seen.add(item.id);return ++counts[item.stage]<=STAGE_CAPACITY;
 });
}
function migrate(state:LegacyState):GameState {
 return {...state,unlocked:4,levels:{mine:state.levels.mine,crusher:1,sorter:1,smelter:state.levels.smelter,press:state.levels.press,packer:1,shipping:state.levels.shipping},items:state.items.map(item=>({...item,stage:LEGACY_STAGE_MAP[item.stage],quality:LEGACY_QUALITY_MAP[item.stage],value:5}))};
}
export function saveGame(state:GameState,now:number):string {return JSON.stringify({version:2,savedAt:now,state});}
export function loadGame(raw:string|null,now:number):{state:GameState;offlineEarned:number;awaySeconds:number;recovered:boolean;migrated:boolean} {
 const fresh=()=>({state:createGame(),offlineEarned:0,awaySeconds:0,recovered:!!raw,migrated:false});
 if(!raw)return fresh();
 try {
  const data=JSON.parse(raw);
  if(!data||!Number.isFinite(data.savedAt)||!Number.isFinite(now))return fresh();
  let state:GameState;
  const migrated=data.version===1;
  if(migrated){
   // Validate the original schema before a legacy stage can enter the expanded line.
   if(!valid(data.state,LEGACY_STATIONS,LEGACY_STAGE_MAP.length,true))return fresh();
   state=migrate(data.state);
  } else {
   if(data.version!==2||!valid(data.state,STATIONS,TOTAL_STAGES))return fresh();
   state=data.state;
  }
  const awaySeconds=Math.min(OFFLINE_CAP_SECONDS,Math.max(0,(now-data.savedAt)/1000));
  const before=state.credits;step(state,awaySeconds);
  return {state,offlineEarned:state.credits-before,awaySeconds,recovered:false,migrated};
 } catch {return fresh();}
}
