import {expect,it} from 'vitest';
import {createGame,type Item} from '../src/simulation';
import {processingVisual} from '../src/processing';
function work(stage:number,p:number){const s=createGame();s.unlocked=5;const item={id:1,stage,progress:p,quality:(stage-1)/2,value:2} as Item;s.items=[item];return {s,item};}
it('visually transforms actual working cargo inside each machine without changing production state',()=>{
 for(const stage of [1,3,5,7,9]){const {s,item}=work(stage,.9),before=JSON.stringify(s),pose=processingVisual(item,s);expect(pose?.kind).toBe((stage+1)/2);expect(JSON.stringify(s)).toBe(before);}
});
it('shows molten metal between ore and ingot, plus open packaging around the gear',()=>{const {s,item}=work(5,.5);expect(processingVisual(item,s)?.kind).toBe(6);const p=work(9,.5);expect(processingVisual(p.item,p.s)?.openBox).toBe(true);expect(processingVisual(p.item,p.s)?.kind).toBe(4);});
it('leaves queued units untouched and keeps six working slots distinct at every process phase',()=>{for(const stage of [1,3,5,7,9])for(const progress of [0,.3,.6,.9]){const {s,item}=work(stage,progress);for(const key of Object.keys(s.levels))s.levels[key as keyof typeof s.levels]=6;s.items=Array.from({length:18},(_,i)=>({...item,id:i+1}));const positions=s.items.slice(0,6).map(i=>{const p=processingVisual(i,s)!;return `${p.x},${p.z}`;});expect(new Set(positions).size).toBe(6);expect(processingVisual(s.items[6],s)).toBeNull();}});
it('uses reduced motion to suppress tumbling, not the actual material transformation',()=>{const {s,item}=work(3,.85);const pose=processingVisual(item,s,true);expect(pose?.kind).toBe(2);expect(pose?.surface).toBe(1.22);});
