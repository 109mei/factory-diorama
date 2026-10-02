import {describe,it,expect} from 'vitest';
import {createGame,step,STATIONS,MAX_ITEMS,STAGE_CAPACITY} from '../src/simulation';
import {loadGame,saveGame} from '../src/save';
import * as persistence from '../src/save';
function legacyState(){return {credits:137,levels:{mine:4,smelter:3,press:2,shipping:5},items:Array.from({length:6},(_,stage)=>({id:51+stage,stage,progress:[0,.15,.35,.55,.75,1][stage]})),mineTimer:.37,accumulator:.042,ticks:1267,mined:49,shipped:43,nextId:61};}
function legacySave(state=legacyState(),savedAt=100000){return JSON.stringify({version:1,savedAt,state});}
describe('versioned persistence',()=>{
 it('writes the v2 wrapper and exposes separate new and legacy storage keys',()=>{
  expect(persistence).toHaveProperty('SAVE_KEY','mine-line.save.v2');expect(persistence).toHaveProperty('LEGACY_SAVE_KEY','mine-line.save.v1');
  expect(JSON.parse(saveGame(createGame(),100000))).toMatchObject({version:2,savedAt:100000});
 });
 it('roundtrips all twelve stages and seven station levels without migration',()=>{
  const state=createGame();state.unlocked=5;step(state,41.7);STATIONS.forEach((station,index)=>state.levels[station]=index%6+1);
  const restored=loadGame(saveGame(state,100000),100000);
  expect(restored).toEqual({state,offlineEarned:0,awaySeconds:0,recovered:false,migrated:false});
 });
 it.each([null,'','broken','{}','null','{"version":99,"state":{}}'])('recovers missing, corrupt and unknown saves: %s',raw=>{
  expect(loadGame(raw,100000)).toEqual({state:createGame(),offlineEarned:0,awaySeconds:0,recovered:!!raw,migrated:false});
 });
 it('rejects malicious v2 saves including duplicate IDs, invalid stages and broken conservation',()=>{
  const mutations=[
   (s:any)=>s.unlocked=-1,(s:any)=>s.unlocked=6,(s:any)=>s.unlocked=.5,(s:any)=>delete s.unlocked,
   (s:any)=>s.items[0].quality=-1,(s:any)=>s.items[0].quality=6,(s:any)=>s.items[0].quality=.5,(s:any)=>delete s.items[0].quality,
   (s:any)=>s.items[0].value=0,(s:any)=>s.items[0].value=999,(s:any)=>s.items[0].value=3,(s:any)=>s.items[0].value=4,
   (s:any)=>s.credits=-10,(s:any)=>s.credits=1e30,(s:any)=>s.credits=.1,
   (s:any)=>s.levels.mine=999,(s:any)=>s.levels.crusher=0,(s:any)=>delete s.levels.packer,
   (s:any)=>s.items=Array(MAX_ITEMS+1).fill({}),
   (s:any)=>s.items[1].id=s.items[0].id,(s:any)=>s.items[0].id=s.nextId,
   (s:any)=>s.items[0].stage=1,(s:any)=>s.items[0].stage=12,(s:any)=>s.items[0].stage=-1,(s:any)=>s.items[0].stage=.5,
   (s:any)=>s.items[0].progress=1.01,(s:any)=>s.items[0].progress=null,
   (s:any)=>s.mined++,(s:any)=>s.shipped=-1,(s:any)=>s.nextId=0,
   (s:any)=>s.mineTimer=3.3,(s:any)=>s.accumulator=.1,(s:any)=>s.ticks=-1,
   (s:any)=>{s.items=Array.from({length:STAGE_CAPACITY+1},(_,id)=>({id:id+1,stage:1,progress:0,quality:0,value:2}));s.mined=s.shipped+s.items.length;s.nextId=100;},
  ];
  for(const mutate of mutations){const state=createGame();step(state,60);mutate(state);const result=loadGame(JSON.stringify({version:2,savedAt:1,state}),1);expect(result.state).toEqual(createGame());expect(result.recovered).toBe(true);expect(result.migrated).toBe(false);}
 });
 it('rejects invalid timestamps safely',()=>{
  for(const savedAt of [null,'100',1e999])expect(loadGame(JSON.stringify({version:2,savedAt,state:createGame()}),100).recovered).toBe(true);
  expect(loadGame(saveGame(createGame(),100),NaN).recovered).toBe(true);
 });
 it('applies offline production by the identical updated simulation',()=>{const state=createGame();step(state,50);const original=state.credits;const raw=saveGame(state,1000);step(state,60);const restored=loadGame(raw,61000);expect(restored.state).toEqual(state);expect(restored.offlineEarned).toBe(state.credits-original);expect(restored.awaySeconds).toBe(60);});
 it('caps offline production at thirty minutes',()=>{const state=createGame(),raw=saveGame(state,1000);step(state,1800);const restored=loadGame(raw,99999999);expect(restored.state).toEqual(state);expect(restored.awaySeconds).toBe(1800);});
 it('does not pay for clock rollback',()=>{const state=createGame();step(state,20);const restored=loadGame(saveGame(state,10000),100);expect(restored.state).toEqual(state);expect(restored.offlineEarned).toBe(0);expect(restored.awaySeconds).toBe(0);});
 it('does not repay offline earnings after the restored state is saved',()=>{
  const first=loadGame(saveGame(createGame(),1000),61000);expect(first.offlineEarned).toBeGreaterThan(0);
  const second=loadGame(saveGame(first.state,61000),61000);expect(second.state).toEqual(first.state);expect(second.offlineEarned).toBe(0);
 });
});
describe('v1 migration',()=>{
 it('preserves all legacy counters, credits, levels, IDs, timers and item progress exactly',()=>{
  const old=legacyState(),restored=loadGame(legacySave(old),100000);
  expect(restored).toEqual({state:{...old,unlocked:4,levels:{mine:4,crusher:1,sorter:1,smelter:3,press:2,packer:1,shipping:5},items:old.items.map((item,index)=>({...item,stage:[0,5,6,7,8,11][index],quality:[0,2,3,3,4,4][index],value:5}))},offlineEarned:0,awaySeconds:0,recovered:false,migrated:true});
 });
 it('validates legacy saves against four stations and six stages before migration',()=>{
  const mutations=[(s:any)=>s.levels.press=0,(s:any)=>delete s.levels.smelter,(s:any)=>s.items[0].stage=6,(s:any)=>s.items[0].stage=11,(s:any)=>s.items[1].id=s.items[0].id,(s:any)=>s.mined++,(s:any)=>s.items[0].progress=-.1,
   (s:any)=>{s.items=Array.from({length:109},(_,id)=>({id:id+1,stage:id%6,progress:0}));s.mined=s.shipped+s.items.length;s.nextId=200;},
  ];
  for(const mutate of mutations){const state=legacyState();mutate(state);const restored=loadGame(legacySave(state),100000);expect(restored.state).toEqual(createGame());expect(restored.recovered).toBe(true);expect(restored.migrated).toBe(false);}
 });
 it('accepts the maximum valid legacy inventory and conserves it during migration',()=>{
  const state=legacyState();state.items=Array.from({length:108},(_,id)=>({id:id+1,stage:Math.floor(id/18),progress:.25}));state.nextId=109;state.mined=state.shipped+108;
  const restored=loadGame(legacySave(state),100000);expect(restored.migrated).toBe(true);expect(restored.state.items).toHaveLength(108);expect(restored.state.mined).toBe(restored.state.shipped+restored.state.items.length);
 });
 it('uses the expanded simulation after migration, including the offline cap',()=>{
  const raw=legacySave(),expected=loadGame(raw,100000).state,before=expected.credits;step(expected,1800);
  const restored=loadGame(raw,1e9);expect(restored.state).toEqual(expected);expect(restored.offlineEarned).toBe(expected.credits-before);expect(restored.awaySeconds).toBe(1800);expect(restored.migrated).toBe(true);
 });
 it('roundtrips a migrated save as v2 and never ships its ready legacy package twice',()=>{
  const first=loadGame(legacySave(),100100);expect(first.state.shipped).toBe(44);expect(first.offlineEarned).toBe(5);expect(first.state.items.some(item=>item.id===56)).toBe(false);
  const second=loadGame(saveGame(first.state,100100),100100);expect(second.state).toEqual(first.state);expect(second.migrated).toBe(false);expect(second.offlineEarned).toBe(0);
 });
});

describe('progression persistence',()=>{
 it('roundtrips every unlock tier with each item value and quality intact',()=>{
  for(let unlocked=0;unlocked<=5;unlocked++){
   const state=createGame();state.unlocked=unlocked;step(state,50);const restored=loadGame(saveGame(state,1000),1000);
   expect(restored.recovered).toBe(false);expect(restored.state).toEqual(state);
  }
 });
 it('keeps legacy five-credit cargo valid through v2 saves without retroactive repricing',()=>{
  const state=loadGame(legacySave(),100000).state;expect(state.unlocked).toBe(4);expect(state.items.every(item=>item.value===5)).toBe(true);
  const restored=loadGame(saveGame(state,100000),100100);expect(restored.recovered).toBe(false);expect(restored.offlineEarned).toBe(5);
 });
});
