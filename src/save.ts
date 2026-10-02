import {createGame,step,STATIONS,MAX_ITEMS,MAX_LEVEL,STAGE_CAPACITY,type GameState} from './simulation';
export const SAVE_KEY='mine-line.save.v1';
export const OFFLINE_CAP_SECONDS=1800;
const int=(v:unknown,max=1e12):v is number=>Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<=max;
function valid(s:any):s is GameState {
 if(!s||!int(s.credits)||!int(s.ticks)||!int(s.mined)||!int(s.shipped)||!int(s.nextId)||s.nextId<1||!s.levels)return false;
 if(!STATIONS.every(k=>int(s.levels[k],MAX_LEVEL)&&s.levels[k]>=1))return false;
 if(!Number.isFinite(s.mineTimer)||s.mineTimer<0||s.mineTimer>3.2||!Number.isFinite(s.accumulator)||s.accumulator<0||s.accumulator>=.1)return false;
 if(!Array.isArray(s.items)||s.items.length>MAX_ITEMS||s.mined!==s.shipped+s.items.length)return false;
 const seen=new Set<number>(),counts=Array(6).fill(0);
 return s.items.every((i:any)=>{if(!i||!int(i.id)||i.id<1||i.id>=s.nextId||seen.has(i.id)||!int(i.stage,5)||!Number.isFinite(i.progress)||i.progress<0||i.progress>1)return false;seen.add(i.id);return ++counts[i.stage]<=STAGE_CAPACITY;});
}
export function saveGame(state:GameState,now:number):string {return JSON.stringify({version:1,savedAt:now,state});}
export function loadGame(raw:string|null,now:number):{state:GameState;offlineEarned:number;awaySeconds:number;recovered:boolean} {
 const fresh=()=>({state:createGame(),offlineEarned:0,awaySeconds:0,recovered:!!raw});
 if(!raw)return fresh();
 try {
  const data=JSON.parse(raw);if(data.version!==1||!valid(data.state)||!Number.isFinite(data.savedAt)||!Number.isFinite(now))return fresh();
  const state=data.state as GameState;
  const awaySeconds=Math.min(OFFLINE_CAP_SECONDS,Math.max(0,(now-data.savedAt)/1000));
  const before=state.credits;step(state,awaySeconds);
  return {state,offlineEarned:state.credits-before,awaySeconds,recovered:false};
 } catch {return fresh();}
}
