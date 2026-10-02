import {describe,it,expect} from 'vitest';
import {createGame,step,buyUpgrade,upgradeCost,stationStats,STATIONS,MAX_ITEMS,MAX_LEVEL,STAGE_CAPACITY,STAGE_SECONDS,CYCLE_SECONDS,type Stage} from '../src/simulation';
import * as simulation from '../src/simulation';
const expectedStations=['mine','crusher','sorter','smelter','press','packer','shipping'];
function setAllLevels(state:ReturnType<typeof createGame>,level:number){state.unlocked=5;for(const station of STATIONS)state.levels[station]=level;}
function expectConservedAndBounded(state:ReturnType<typeof createGame>){
 expect(state.mined).toBe(state.shipped+state.items.length);
 expect(state.items.length).toBeLessThanOrEqual(MAX_ITEMS);
 expect(new Set(state.items.map(item=>item.id)).size).toBe(state.items.length);
 expect(Number.isSafeInteger(state.credits)).toBe(true);
 expect(state.credits).toBeGreaterThanOrEqual(0);
 for(let stage=0;stage<12;stage++)expect(state.items.filter(item=>item.stage===stage).length).toBeLessThanOrEqual(STAGE_CAPACITY);
 for(const item of state.items){expect(item.stage).toBeGreaterThanOrEqual(0);expect(item.stage).toBeLessThan(12);expect(item.progress).toBeGreaterThanOrEqual(0);expect(item.progress).toBeLessThanOrEqual(1);expect(Number.isFinite(item.progress)).toBe(true);}
}
describe('expanded deterministic production',()=>{
 it('defines seven stations and twelve alternating belt and machine stages',()=>{
  expect(STATIONS).toEqual(expectedStations);
  expect(simulation).toHaveProperty('TOTAL_STAGES',12);
  expect(STAGE_SECONDS).toEqual([1.8,2.4,1.8,2.2,1.8,2.6,1.8,3.2,1.8,2.4,1.8,2]);
  expect(CYCLE_SECONDS).toEqual({mine:3.2,crusher:2.4,sorter:2.2,smelter:2.6,press:3.2,packer:2.4,shipping:2});
  expect(MAX_ITEMS).toBe(216);expect(STAGE_CAPACITY).toBe(18);expect(MAX_LEVEL).toBe(6);
  expect(Object.keys(createGame().levels)).toEqual(expectedStations);
 });
 it('moves an ore unit through all twelve stages before shipping it exactly once',()=>{
  const state=createGame(),visited=new Set<number>();state.unlocked=5;
  for(let tick=0;tick<600;tick++){step(state,.1);const first=state.items.find(item=>item.id===1);if(first)visited.add(first.stage);}
  expect([...visited]).toEqual(Array.from({length:12},(_,stage)=>stage));
  expect(state.items.some(item=>item.id===1)).toBe(false);
  expect(state.credits).toBe(state.shipped*32);expect(state.shipped).toBeGreaterThan(0);
 });
 it('never skips a stage even when elapsed time spans many ticks',()=>{
  const state=createGame();state.unlocked=5;state.items=[{id:1,stage:0,progress:1,quality:0,value:2}];state.mined=1;state.nextId=2;
  step(state,.1);expect(state.items[0]).toEqual({id:1,stage:1,progress:0,quality:0,value:2});
 });
 it('keeps every mined unit either in the line or shipped',()=>{
  const state=createGame();for(let second=0;second<180;second++){step(state,1);expectConservedAndBounded(state);}
 });
 it('gives the first 20-credit upgrade within the first minute and supports each unlocked station',()=>{
  const state=createGame();step(state,60);expect(state.credits).toBeGreaterThanOrEqual(20);state.unlocked=5;
  for(const station of STATIONS){const copy=structuredClone(state);expect(upgradeCost(copy,station)).toBe(20);expect(buyUpgrade(copy,station)).toBe(true);expect(copy.levels[station]).toBe(2);expect(copy.credits).toBe(state.credits-20);}
 });
 it('rejects unaffordable and repeated purchases atomically',()=>{const state=createGame();expect(buyUpgrade(state,'mine')).toBe(false);state.credits=20;expect(buyUpgrade(state,'mine')).toBe(true);expect(buyUpgrade(state,'mine')).toBe(false);expect(state.credits).toBe(0);expect(state.levels.mine).toBe(2);});
 it('uses equivalent fixed steps for different frame sizes',()=>{const a=createGame(),b=createGame(),c=createGame();step(a,60);for(let tick=0;tick<600;tick++)step(b,.1);for(let frame=0;frame<3600;frame++)step(c,1/60);expect(a).toEqual(b);expect(c).toEqual(a);});
 it.each([1,6])('stays finite, bounded and conserved for thirty minutes at level %s',level=>{const state=createGame();setAllLevels(state,level);step(state,1800);expectConservedAndBounded(state);});
 it('contains a thirty-minute bottleneck without losing units or storing unlimited mine time',()=>{
  const state=createGame();state.unlocked=5;state.levels.mine=6;step(state,1800);expectConservedAndBounded(state);expect(state.mineTimer).toBeLessThanOrEqual(CYCLE_SECONDS.mine/state.levels.mine);expect(state.items.some(item=>item.progress===1)).toBe(true);
 });
 it('upgrades each station through all levels and rejects purchases at the maximum',()=>{
  for(const station of STATIONS){const state=createGame();state.unlocked=5;state.credits=100000;for(let level=1;level<MAX_LEVEL;level++){const before=state.credits,cost=upgradeCost(state,station);expect(buyUpgrade(state,station)).toBe(true);expect(state.levels[station]).toBe(level+1);expect(state.credits).toBe(before-cost);}const before=structuredClone(state);expect(buyUpgrade(state,station)).toBe(false);expect(state).toEqual(before);}
 });
 it('upgrades processing capacity enough to increase whole-line throughput',()=>{const base=createGame(),fast=createGame();setAllLevels(base,1);setAllLevels(fast,6);step(base,180);step(fast,180);expect(fast.shipped).toBeGreaterThan(base.shipped*3);});
 it('ignores invalid and negative elapsed time',()=>{const state=createGame(),start=structuredClone(state);for(const dt of [NaN,-1,Infinity,0])step(state,dt);expect(state).toEqual(start);});
 it('caps one elapsed-time update at thirty minutes',()=>{const a=createGame(),b=createGame();step(a,999999);step(b,1800);expect(a).toEqual(b);});
});
describe('station capacities and advertised rates',()=>{
 it.each([1,2,3,4,5,6])('preserves fractional tick time at mine level %s',level=>{
  const state=createGame();setAllLevels(state,6);state.levels.mine=level;step(state,1800);
  expect(state.mined).toBe(Math.floor((1800+1e-7)/(3.2/level)));expectConservedAndBounded(state);
 });
 it('reports every station at all six levels using its own cycle and machine stage',()=>{
  for(const station of STATIONS)for(let level=1;level<=6;level++){
   const state=createGame();state.unlocked=5;state.levels[station]=level;
   const index=STATIONS.indexOf(station);
   if(index>0)state.items=Array.from({length:8},(_,id)=>({id:id+1,stage:(index*2-1) as Stage,progress:.35,quality:0,value:2}));
   const stats=stationStats(state,station);
   expect(stats.capacity).toBe(level);expect(stats.perMinute).toBe(60/CYCLE_SECONDS[station]*level);
   expect(stats.working).toBe(index>0?level:0);expect(stats.queued).toBe(index>0?8-level:0);expect(stats.progress).toBe(index>0?.35:0);
  }
 });
 it('processes only the purchased number of simultaneous units at every downstream machine',()=>{
  for(const station of STATIONS.slice(1))for(let level=1;level<=6;level++){
   const state=createGame(),stage=(STATIONS.indexOf(station)*2-1) as Stage;state.unlocked=5;state.levels[station]=level;
   state.items=Array.from({length:7},(_,id)=>({id:id+1,stage,progress:0,quality:0,value:2}));state.mined=7;state.nextId=8;
   step(state,.1);expect(state.items.filter(item=>item.stage===stage&&item.progress>0)).toHaveLength(level);
   expect(state.items.filter(item=>item.stage===stage&&item.progress===0)).toHaveLength(7-level);
  }
 });
});

describe('progressive factory expansion',()=>{
 it('starts with mining and shipping, five sequential unlocks, and six increasing item values',()=>{
  const state=createGame();expect(state.unlocked).toBe(0);
  expect(simulation.PROCESS_STATIONS).toEqual(['crusher','sorter','smelter','press','packer']);
  expect(simulation.UNLOCK_COSTS).toEqual([40,120,360,900,2200]);expect(simulation.ITEM_VALUES).toEqual([2,4,7,12,20,32]);
  expect(simulation.isStationUnlocked(state,'mine')).toBe(true);expect(simulation.isStationUnlocked(state,'shipping')).toBe(true);
  for(const station of STATIONS.slice(1,-1))expect(simulation.isStationUnlocked(state,station)).toBe(false);
  expect(simulation.nextUnlock(state)).toBe('crusher');expect(simulation.unlockCost(state)).toBe(40);
 });
 it('rejects locked upgrades atomically even when the player can afford them',()=>{
  const state=createGame();state.credits=100000;
  for(const station of STATIONS.slice(1,-1)){const before=structuredClone(state);expect(buyUpgrade(state,station)).toBe(false);expect(state).toEqual(before);}
 });
 it('unlocks each process once at its exact price and handles the final unlock gracefully',()=>{
  const state=createGame();for(const [index,station] of simulation.PROCESS_STATIONS.entries()){
   const cost=simulation.UNLOCK_COSTS[index];state.credits=cost-1;const before=structuredClone(state);
   expect(simulation.unlockNext(state)).toBe(false);expect(state).toEqual(before);state.credits++;
   expect(simulation.nextUnlock(state)).toBe(station);expect(simulation.unlockNext(state)).toBe(true);expect(state.credits).toBe(0);expect(state.unlocked).toBe(index+1);expect(simulation.isStationUnlocked(state,station)).toBe(true);
  }
  const before=structuredClone(state);expect(simulation.nextUnlock(state)).toBeNull();expect(simulation.unlockCost(state)).toBe(0);expect(simulation.unlockNext(state)).toBe(false);expect(state).toEqual(before);
 });
 it('bypasses one locked machine per tick and ships raw ore for two credits',()=>{
  const state=createGame();state.items=[{id:1,stage:0,progress:1,quality:0,value:2}];state.mined=1;state.nextId=2;
  step(state,.1);expect(state.items[0]).toEqual({id:1,stage:2,progress:0,quality:0,value:2});
  const fresh=createGame();step(fresh,60);expect(fresh.shipped).toBeGreaterThan(0);expect(fresh.credits).toBe(fresh.shipped*2);
  expect(fresh.items.every(item=>item.stage%2===0||item.stage===11)).toBe(true);
 });
 it('respects destination capacity when bypassing a locked machine',()=>{
  const state=createGame();state.items=[{id:1,stage:0,progress:1,quality:0,value:2},...Array.from({length:18},(_,index)=>({id:index+2,stage:2 as Stage,progress:0,quality:0,value:2}))];state.nextId=20;state.mined=19;
  step(state,.1);expect(state.items[0].stage).toBe(0);expectConservedAndBounded(state);
 });
 it('assigns a new value only when an unlocked process actually completes',()=>{
  for(let index=0;index<5;index++){
   const state=createGame();state.unlocked=index+1;state.items=[{id:1,stage:(index*2+1) as Stage,progress:0,quality:0,value:2}];state.mined=1;state.nextId=2;
   step(state,.1);expect(state.items[0].value).toBe(2);step(state,STAGE_SECONDS[index*2+1]-.1);
   expect(state.items[0]).toMatchObject({stage:index*2+2,quality:index+1,value:simulation.ITEM_VALUES[index+1]});
  }
 });
 it('does not reprice shipping cargo when a new process is unlocked',()=>{
  const state=createGame();state.credits=40;state.items=[{id:1,stage:11,progress:.95,quality:0,value:2}];state.mined=1;state.nextId=2;
  expect(simulation.unlockNext(state)).toBe(true);expect(state.items[0].value).toBe(2);step(state,.1);
  expect(state.shipped).toBe(1);expect(state.credits).toBe(2);
 });
 it('lets an already downstream raw item gain value only at a later newly unlocked process',()=>{
  const state=createGame();state.credits=160;state.items=[{id:1,stage:2,progress:1,quality:0,value:2}];state.mined=1;state.nextId=2;
  simulation.unlockNext(state);simulation.unlockNext(state);expect(state.items[0].value).toBe(2);
  step(state,.1);expect(state.items[0]).toMatchObject({stage:3,value:2});step(state,2.2);expect(state.items[0]).toMatchObject({stage:4,quality:2,value:7});
 });
 it('pays each package its own price when mixed cargo ships in the same tick',()=>{
  const state=createGame();state.unlocked=5;state.levels.shipping=6;
  state.items=[2,4,5,12,20,32].map((value,index)=>({id:index+1,stage:11 as Stage,progress:1,quality:index,value}));state.mined=6;state.nextId=7;
  step(state,.1);expect(state.items).toHaveLength(0);expect(state.shipped).toBe(6);expect(state.credits).toBe(75);
 });
 it('can afford every expansion through fresh play without deadlocks or injected money',()=>{
  const state=createGame(),milestones:number[]=[];
  for(let second=0;second<1800&&state.unlocked<5;second++){
   step(state,1);if(simulation.unlockNext(state))milestones.push(second+1);expectConservedAndBounded(state);
  }
  expect(state.unlocked).toBe(5);expect(milestones).toHaveLength(5);expect(milestones[0]).toBeLessThan(90);
  step(state,60);expect(state.items.some(item=>item.quality===5)).toBe(true);expect(state.credits).toBeGreaterThan(0);
 });
});
