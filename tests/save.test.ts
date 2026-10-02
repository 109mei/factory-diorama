import {describe,it,expect} from 'vitest';
import {createGame,step} from '../src/simulation';
import {loadGame,saveGame} from '../src/save';
describe('versioned persistence',()=>{
 it('roundtrips all real production state',()=>{const s=createGame();step(s,41.7);expect(loadGame(saveGame(s,100000),100000).state).toEqual(s);});
 it.each([null,'','broken','{}','{"version":99,"state":{}}'])('recovers missing, corrupt and unknown saves: %s',raw=>{expect(loadGame(raw,100000).state).toEqual(createGame());});
 it('rejects nonfinite credits, hostile levels and excessive items',()=>{for(const mutate of [(s:any)=>s.credits=-10,(s:any)=>s.levels.mine=999,(s:any)=>s.items=Array(200).fill({}),(s:any)=>s.credits=1e30]){const state=createGame();mutate(state);expect(loadGame(JSON.stringify({version:1,savedAt:1,state}),1).state).toEqual(createGame());}});
 it('applies offline production by the identical simulation',()=>{const s=createGame();step(s,50);const original=s.credits;const raw=saveGame(s,1000);step(s,60);const restored=loadGame(raw,61000);expect(restored.state).toEqual(s);expect(restored.offlineEarned).toBe(s.credits-original);});
 it('caps offline production at thirty minutes',()=>{const s=createGame(),raw=saveGame(s,1000);step(s,1800);expect(loadGame(raw,99999999).state).toEqual(s);});
 it('does not pay for clock rollback',()=>{const s=createGame();step(s,20);const restored=loadGame(saveGame(s,10000),100);expect(restored.state).toEqual(s);expect(restored.offlineEarned).toBe(0);});
});
