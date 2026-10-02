import {describe,it,expect} from 'vitest';
import {createGame,type Stage} from '../src/simulation';
import {AUDIO_STORAGE_KEY,DEFAULT_AUDIO_PREFERENCES,readAudioPreferences,normalizeAudioPreferences,serializeAudioPreferences,AUDIO_LIMITS,createAudioEventTracker,factoryAudioActivity} from '../src/audio-policy';

describe('audio preference policy',()=>{
 it('starts quietly off and tolerates missing, broken, and unavailable storage',()=>{
  expect(DEFAULT_AUDIO_PREFERENCES).toEqual({enabled:false,volume:.25});
  for(const value of [null,undefined,'','{}','null','[]','bad','{"enabled":"yes","volume":"1"}']){
   expect(readAudioPreferences({getItem:()=>value as string|null})).toEqual({enabled:false,volume:.25});
  }
  expect(readAudioPreferences(null)).toEqual({enabled:false,volume:.25});
  expect(readAudioPreferences({getItem(){throw new Error('blocked');}})).toEqual({enabled:false,volume:.25});
 });
 it('reads only its own key and preserves valid saved intent without side effects',()=>{
  const keys:string[]=[];
  expect(readAudioPreferences({getItem(key){keys.push(key);return '{"enabled":true,"volume":0.4}';}})).toEqual({enabled:true,volume:.4});
  expect(keys).toEqual([AUDIO_STORAGE_KEY]);
 });
 it('clamps finite values and rejects coercion and non-finite volumes',()=>{
  expect(normalizeAudioPreferences({enabled:true,volume:99})).toEqual({enabled:true,volume:1});
  expect(normalizeAudioPreferences({enabled:false,volume:-9})).toEqual({enabled:false,volume:0});
  for(const volume of [NaN,Infinity,-Infinity,null,'0.5'])expect(normalizeAudioPreferences({enabled:true,volume})).toEqual({enabled:true,volume:.25});
  expect(JSON.parse(serializeAudioPreferences({enabled:true,volume:8}))).toEqual({enabled:true,volume:1});
 });
});

describe('observed production audio events',()=>{
 it('baselines an existing busy factory, then emits only newly gained quality or actual shipping',()=>{
  const tracker=createAudioEventTracker(),state=createGame();
  state.items=[{id:1,stage:1,progress:.95,quality:0,value:2}];state.shipped=100;state.ticks=100;
  expect(tracker.update(state,.1)).toEqual([]);
  state.ticks++;state.items[0].quality=1;state.items[0].stage=2;
  expect(tracker.update(state,.2)).toEqual([{station:'crusher',seed:1}]);
  state.ticks++;
  expect(tracker.update(state,.2)).toEqual([]);
  state.ticks++;state.shipped++;
  expect(tracker.update(state,.2)).toEqual([{station:'shipping',seed:101}]);
 });
 it('does not sound locked bypasses, inventory removal, or new already-processed items',()=>{
  const tracker=createAudioEventTracker(),state=createGame();state.items=[{id:1,stage:0,quality:0,progress:1,value:2}];
  tracker.update(state,.1);state.items[0].stage=2;state.ticks++;
  expect(tracker.update(state,.1)).toEqual([]);
  state.items=[];state.ticks++;expect(tracker.update(state,.2)).toEqual([]);
  state.items=[{id:2,stage:6,quality:3,progress:0,value:12}];state.ticks++;expect(tracker.update(state,.2)).toEqual([]);
 });
 it('drops offline catch-up, resets and oversized frames instead of replaying a burst',()=>{
  const tracker=createAudioEventTracker(),state=createGame();tracker.update(state,.1);
  for(const [dt,ticks] of [[30,300],[.016,500],[Infinity,501],[NaN,502],[-1,503],[0,504]]){state.shipped+=100;state.ticks=ticks;expect(tracker.update(state,dt)).toEqual([]);}
  state.ticks=0;state.shipped=0;expect(tracker.update(state,.1)).toEqual([]);
  state.ticks++;state.shipped++;expect(tracker.update(state,.2)).toHaveLength(1);
  tracker.reset();state.shipped+=30;state.ticks+=1;expect(tracker.update(state,.2)).toEqual([]);
 });
 it('bounds aggregate and per-station rates while dropping events rather than delaying them',()=>{
  const tracker=createAudioEventTracker(),state=createGame();state.items=Array.from({length:5},(_,i)=>({id:i+1,stage:1 as Stage,progress:0,quality:0,value:2}));tracker.update(state,.01);
  const emitted:{time:number;station:string}[]=[];
  for(let i=1;i<=200;i++){
   state.ticks=Math.floor(i/10);state.shipped++;for(const item of state.items)item.quality=item.quality===0?1:0;
   for(const event of tracker.update(state,.01))emitted.push({time:i/100,station:event.station});
  }
  expect(emitted.length).toBeGreaterThan(2);
  for(let i=0;i<emitted.length;i++){
   expect(emitted.filter(x=>x.time>=emitted[i].time&&x.time<emitted[i].time+1-1e-8).length).toBeLessThanOrEqual(AUDIO_LIMITS.eventsPerSecond);
   if(i>0)expect(emitted[i].time-emitted[i-1].time).toBeGreaterThanOrEqual(AUDIO_LIMITS.globalInterval-1e-8);
   const previous=emitted.slice(0,i).reverse().find(x=>x.station===emitted[i].station);
   if(previous)expect(emitted[i].time-previous.time).toBeGreaterThanOrEqual(AUDIO_LIMITS.stationInterval-1e-8);
  }
  state.ticks++;expect(tracker.update(state,.2)).toEqual([]);
 });
 it('keeps source and aggregate headroom conservative at full user volume',()=>{
  expect(AUDIO_LIMITS.maxVoices).toBeLessThanOrEqual(4);
  const preLimiter=(AUDIO_LIMITS.humPeak+AUDIO_LIMITS.rollingPeak+AUDIO_LIMITS.maxVoices*AUDIO_LIMITS.eventPeak)*AUDIO_LIMITS.masterGain;
  expect(preLimiter).toBeLessThan(.35);expect(AUDIO_LIMITS.outputCeiling).toBeLessThan(1);
 });
 it('measures only moving belt items and genuinely working processing items with bounded activity',()=>{
  const state=createGame();state.items=[{id:1,stage:0,progress:.3,quality:0,value:2},{id:2,stage:1,progress:.2,quality:0,value:2},{id:3,stage:0,progress:1,quality:0,value:2}];
  expect(factoryAudioActivity(state).rolling).toBeGreaterThan(0);expect(factoryAudioActivity(state).working).toBeGreaterThan(0);
  state.items=[];expect(factoryAudioActivity(state)).toEqual({rolling:0,working:0});
  state.items=Array.from({length:300},(_,id)=>({id,stage:(id%12) as Stage,progress:.4,quality:0,value:2}));
  const activity=factoryAudioActivity(state);expect(activity.rolling).toBeLessThanOrEqual(1);expect(activity.working).toBeLessThanOrEqual(1);
 });
});
