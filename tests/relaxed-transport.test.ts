import {expect,it} from 'vitest';
import {createGame,step,STAGE_SECONDS,STATIONS,unlockNext,buyUpgrade,type Stage} from '../src/simulation';
import {loadGame,saveGame} from '../src/save';
it('slows every conveyor to 3.6 seconds while retaining processing cadence',()=>{
 for(let stage=0;stage<12;stage+=2)expect(STAGE_SECONDS[stage]).toBe(3.6);
 expect(STAGE_SECONDS.filter((_,i)=>i%2)).toEqual([2.4,2.2,2.6,3.2,2.4,2]);
});
it('keeps exact old progress and cargo value through loading slower transport',()=>{
 const state=createGame();state.unlocked=5;state.mined=6;state.nextId=7;
 state.items=Array.from({length:6},(_,i)=>({id:i+1,stage:(i*2) as Stage,progress:.45,quality:i,value:[2,4,7,12,20,32][i]}));
 expect(loadGame(saveGame(state,1000),1000).state).toEqual(state);
});
it('still affords an early upgrade within a minute and all processes without deadlock',()=>{
 const s=createGame();step(s,60);expect(s.credits).toBeGreaterThanOrEqual(20);
 const fresh=createGame();let elapsed=0;while(fresh.unlocked<5&&elapsed<1800){step(fresh,.1);elapsed+=.1;unlockNext(fresh);}
 expect(fresh.unlocked).toBe(5);expect(elapsed).toBeLessThan(1200);
});
it('keeps steady-state maximum throughput and bounded conserved inventory',()=>{
 const s=createGame();s.unlocked=5;s.credits=1e8;for(const station of STATIONS)while(buyUpgrade(s,station)){};
 step(s,300);const shipped=s.shipped;step(s,600);
 expect(s.shipped-shipped).toBeGreaterThanOrEqual(1100);expect(s.items.length).toBeLessThanOrEqual(216);expect(s.mined).toBe(s.shipped+s.items.length);
});
