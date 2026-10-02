import {it,expect} from 'vitest';
import {createGame,step} from '../src/simulation';
import {visualItemPosition} from '../src/layout';
it('makes every conveyor unit distinguishable when a downstream machine is jammed',()=>{
 const s=createGame();s.levels.mine=6;step(s,1800);
 for(const stage of [0,2,4]){
  const items=s.items.filter(i=>i.stage===stage),points=items.map(i=>visualItemPosition(i,s));
  const unique=new Set(points.map(([x,y,z])=>[x,y,z].map(n=>n.toFixed(5)).join(',')));
  expect(unique.size).toBe(items.length);
  for(let i=1;i<points.length;i++)expect(Math.hypot(points[i][0]-points[i-1][0],points[i][2]-points[i-1][2])).toBeGreaterThan(.39);
 }
});
it('renders moving items on a finite route',()=>{const s=createGame();step(s,40);for(const item of s.items){const p=visualItemPosition(item,s);expect(p.every(Number.isFinite)).toBe(true);expect(Math.abs(p[0])).toBeLessThan(4.5);expect(Math.abs(p[2])).toBeLessThan(11);}});
it('keeps simultaneous batch arrivals distinct after upgrading backed-up machines',()=>{
 const s=createGame();s.levels.mine=6;step(s,60);s.levels={mine:6,smelter:6,press:6,shipping:6};
 for(let frame=0;frame<300;frame++){
  step(s,.1);
  for(const stage of [0,2,4]){
   const items=s.items.filter(i=>i.stage===stage),points=items.map(i=>visualItemPosition(i,s));
   expect(new Set(points.map(([x,y,z])=>[x,y,z].map(n=>n.toFixed(5)).join(','))).size).toBe(items.length);
   for(let i=1;i<points.length;i++)expect(Math.hypot(points[i][0]-points[i-1][0],points[i][2]-points[i-1][2])).toBeGreaterThan(.39);
  }
 }
});
