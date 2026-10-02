import {describe,it,expect} from 'vitest';
import {createGame,step} from '../src/simulation';
import {loadGame,saveGame,SAVE_KEY,LEGACY_SAVE_KEY} from '../src/save';
import {restoreGame} from '../src/storage';
class MemoryStorage {
 readonly values=new Map<string,string>();readonly reads:string[]=[];
 constructor(entries:Record<string,string>={}){for(const [key,value] of Object.entries(entries))this.values.set(key,value);}
 getItem(key:string){this.reads.push(key);return this.values.get(key)??null;}
}
function legacySave(){return JSON.stringify({version:1,savedAt:1000,state:{credits:145,levels:{mine:2,smelter:3,press:2,shipping:1},items:[{id:10,stage:5,progress:.95}],mineTimer:.5,accumulator:0,ticks:100,mined:10,shipped:9,nextId:11}});}
describe('storage restoration',()=>{
 it('prefers a valid v2 save without reading or changing its legacy backup',()=>{
  const state=createGame();state.unlocked=5;step(state,40);const raw=saveGame(state,1000);
  const storage=new MemoryStorage({[SAVE_KEY]:raw,[LEGACY_SAVE_KEY]:legacySave()}),before=[...storage.values];
  expect(restoreGame(storage,1000)).toEqual({...loadGame(raw,1000),storageAvailable:true,usedLegacy:false});
  expect(storage.reads).toEqual([SAVE_KEY]);expect([...storage.values]).toEqual(before);
 });
 it('migrates a legacy-only save and preserves both storage keys',()=>{
  const raw=legacySave(),storage=new MemoryStorage({[LEGACY_SAVE_KEY]:raw}),before=[...storage.values];
  expect(restoreGame(storage,1000)).toEqual({...loadGame(raw,1000),storageAvailable:true,usedLegacy:true});
  expect(storage.reads).toEqual([SAVE_KEY,LEGACY_SAVE_KEY]);expect([...storage.values]).toEqual(before);
 });
 it('starts fresh without a recovery warning when neither key exists',()=>{
  expect(restoreGame(new MemoryStorage(),1000)).toEqual({...loadGame(null,1000),storageAvailable:true,usedLegacy:false});
 });
 it.each(['broken','{"version":99,"savedAt":1000,"state":{}}'])('uses a valid legacy backup when the v2 save is invalid: %s',invalid=>{
  const raw=legacySave(),storage=new MemoryStorage({[SAVE_KEY]:invalid,[LEGACY_SAVE_KEY]:raw}),before=[...storage.values];
  expect(restoreGame(storage,1000)).toEqual({...loadGame(raw,1000),storageAvailable:true,usedLegacy:true});
  expect([...storage.values]).toEqual(before);
 });
 it('returns normal fresh recovery flags when both saves are corrupt',()=>{
  const storage=new MemoryStorage({[SAVE_KEY]:'broken',[LEGACY_SAVE_KEY]:'also broken'});
  expect(restoreGame(storage,1000)).toEqual({...loadGame('broken',1000),storageAvailable:true,usedLegacy:false});
 });
 it('reports recovery when only a corrupt legacy save exists',()=>{
  expect(restoreGame(new MemoryStorage({[LEGACY_SAVE_KEY]:'broken'}),1000)).toEqual({...loadGame('broken',1000),storageAvailable:true,usedLegacy:false});
 });
 it('reports unavailable storage when the first read throws',()=>{
  const storage={getItem(){throw new Error('Storage unavailable');}};
  expect(restoreGame(storage,1000)).toEqual({...loadGame(null,1000),storageAvailable:false,usedLegacy:false});
 });
 it('reports unavailable storage when the legacy fallback read throws',()=>{
  const storage={getItem(key:string){if(key===SAVE_KEY)return 'broken';throw new Error('Legacy read unavailable');}};
  expect(restoreGame(storage,1000)).toEqual({...loadGame(null,1000),storageAvailable:false,usedLegacy:false});
 });
 it('applies legacy offline production exactly once after the caller persists v2',()=>{
  const raw=legacySave(),storage=new MemoryStorage({[SAVE_KEY]:'broken',[LEGACY_SAVE_KEY]:raw});
  const first=restoreGame(storage,61000);expect(first.usedLegacy).toBe(true);expect(first.offlineEarned).toBeGreaterThan(0);expect(first.state).toEqual(loadGame(raw,61000).state);
  storage.values.set(SAVE_KEY,saveGame(first.state,61000));
  const second=restoreGame(storage,61000);expect(second.usedLegacy).toBe(false);expect(second.migrated).toBe(false);expect(second.offlineEarned).toBe(0);expect(second.state).toEqual(first.state);
  expect(storage.values.get(LEGACY_SAVE_KEY)).toBe(raw);
 });
});
