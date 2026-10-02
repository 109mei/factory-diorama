import {STATIONS,type GameState,type Station} from './simulation';

export interface AudioPreferences {enabled:boolean;volume:number;}
export const AUDIO_STORAGE_KEY='factory-audio-v1';
export const DEFAULT_AUDIO_PREFERENCES:Readonly<AudioPreferences>=Object.freeze({enabled:false,volume:.25});
export function normalizeAudioPreferences(value:unknown):AudioPreferences {
 const candidate=value&&typeof value==='object'?value as Partial<AudioPreferences>:{};
 return {enabled:candidate.enabled===true,volume:typeof candidate.volume==='number'&&Number.isFinite(candidate.volume)?Math.max(0,Math.min(1,candidate.volume)):DEFAULT_AUDIO_PREFERENCES.volume};
}
/** Storage can be blocked or corrupt without affecting the production save. */
export function readAudioPreferences(storage:Pick<Storage,'getItem'>|null|undefined):AudioPreferences {
 try{return normalizeAudioPreferences(JSON.parse(storage?.getItem(AUDIO_STORAGE_KEY)??'null'));}
 catch{return {...DEFAULT_AUDIO_PREFERENCES};}
}
export function serializeAudioPreferences(value:AudioPreferences):string{return JSON.stringify(normalizeAudioPreferences(value));}

/** Conservative source budget before the final output soft limiter. */
export const AUDIO_LIMITS=Object.freeze({maxVoices:4,globalInterval:.16,stationInterval:.55,eventsPerSecond:5,maxFrameGap:.4,masterGain:.5,eventPeak:.11,humPeak:.055,rollingPeak:.08,outputCeiling:.7});
export interface FactoryAudioEvent {station:Station;seed:number;}

/** Observe immutable snapshots, never mutate simulation or queue missed events. */
export function createAudioEventTracker(){
 let previous:Map<number,number>|null=null,shipped=0,ticks=0,time=0,lastGlobal=-Infinity;
 const lastStation=new Map<Station,number>();let recent:number[]=[];
 function reset(){previous=null;time=0;lastGlobal=-Infinity;lastStation.clear();recent=[];}
 function update(state:GameState,dt:number):FactoryAudioEvent[]{
  const current=new Map(state.items.map(item=>[item.id,item.quality]));
  const discontinuity=!Number.isFinite(dt)||dt<=0||dt>AUDIO_LIMITS.maxFrameGap||state.ticks<ticks||state.ticks-ticks>5||state.shipped<shipped;
  const candidates:FactoryAudioEvent[]=[];
  if(previous&&!discontinuity){
   if(state.shipped>shipped)candidates.push({station:'shipping',seed:state.shipped});
   for(const item of state.items){
    const before=previous.get(item.id);
    if(before!==undefined&&item.quality>before&&Number.isInteger(item.quality)&&item.quality>=1&&item.quality<=5)candidates.push({station:STATIONS[item.quality],seed:item.id});
   }
  }
  if(discontinuity){time=0;lastGlobal=-Infinity;lastStation.clear();recent=[];}
  else time+=dt;
  previous=current;shipped=state.shipped;ticks=state.ticks;
  recent=recent.filter(at=>time-at<1-1e-8);
  if(time-lastGlobal+1e-8<AUDIO_LIMITS.globalInterval||recent.length>=AUDIO_LIMITS.eventsPerSecond)return [];
  const event=candidates.find(candidate=>time-(lastStation.get(candidate.station)??-Infinity)+1e-8>=AUDIO_LIMITS.stationInterval);
  if(!event)return [];
  lastGlobal=time;lastStation.set(event.station,time);recent.push(time);return [event];
 }
 return {reset,update};
}

export function factoryAudioActivity(state:GameState):{rolling:number;working:number}{
 let rolling=0,working=0;const queued=new Map<number,number>();
 for(const item of state.items){
  if(item.stage%2===0){if(item.progress<1)rolling++;}
  else {
   const index=queued.get(item.stage)??0;queued.set(item.stage,index+1);
   if(item.progress<1&&index<state.levels[STATIONS[(item.stage+1)/2]])working++;
  }
 }
 return {rolling:Math.min(1,rolling/24),working:Math.min(1,working/12)};
}
