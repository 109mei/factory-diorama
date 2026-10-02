import {step,type GameState} from './simulation';
import {OFFLINE_CAP_SECONDS} from './save';
/** Owns the single background interval, including delayed pagehide saves. */
export function createLifecycle(state:GameState){
 let hiddenAt:number|null=null;
 return {
  advance(seconds:number){if(hiddenAt===null)step(state,seconds);},
  hide(now:number){if(hiddenAt===null)hiddenAt=now;},
  resume(now:number){if(hiddenAt===null)return {seconds:0,earned:0};const seconds=Math.min(OFFLINE_CAP_SECONDS,Math.max(0,(now-hiddenAt)/1000));hiddenAt=null;const before=state.credits;step(state,seconds);return {seconds,earned:state.credits-before};},
  saveTimestamp(now:number){return hiddenAt??now;}
 };
}
