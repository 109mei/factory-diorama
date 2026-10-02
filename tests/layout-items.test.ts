import {it,expect} from 'vitest';
import {createGame,step,STATIONS,TOTAL_STAGES} from '../src/simulation';
import {visualItemPosition} from '../src/layout';
it('makes every conveyor unit distinguishable when a downstream machine is jammed',()=>{
 const s=createGame();s.levels.mine=6;step(s,1800);
 for(const stage of Array.from({length:TOTAL_STAGES/2},(_,i)=>i*2)){
  const items=s.items.filter(i=>i.stage===stage),points=items.map(i=>visualItemPosition(i,s));
  const unique=new Set(points.map(([x,y,z])=>[x,y,z].map(n=>n.toFixed(5)).join(',')));
  expect(unique.size).toBe(items.length);
  for(let i=1;i<points.length;i++)expect(Math.hypot(points[i][0]-points[i-1][0],points[i][2]-points[i-1][2])).toBeGreaterThan(.39);
 }
});
it('renders moving items on a finite route',()=>{const s=createGame();step(s,40);for(const item of s.items){const p=visualItemPosition(item,s);expect(p.every(Number.isFinite)).toBe(true);expect(Math.abs(p[0])).toBeLessThan(6);expect(Math.abs(p[2])).toBeLessThan(19);}});
it('keeps simultaneous batch arrivals distinct after upgrading backed-up machines',()=>{
 const s=createGame();s.levels.mine=6;step(s,60);s.unlocked=5;for(const station of STATIONS)s.levels[station]=6;
 for(let frame=0;frame<300;frame++){
  step(s,.1);
  for(const stage of Array.from({length:TOTAL_STAGES/2},(_,i)=>i*2)){
   const items=s.items.filter(i=>i.stage===stage),points=items.map(i=>visualItemPosition(i,s));
   expect(new Set(points.map(([x,y,z])=>[x,y,z].map(n=>n.toFixed(5)).join(','))).size).toBe(items.length);
   for(let i=1;i<points.length;i++)expect(Math.hypot(points[i][0]-points[i-1][0],points[i][2]-points[i-1][2])).toBeGreaterThan(.39);
  }
 }
});
it('connects every belt through future machine bays without a bypass gap',async()=>{
 const {BELT_ROUTES}=await import('../src/layout');for(let i=1;i<BELT_ROUTES.length;i++)expect(BELT_ROUTES[i-1].at(-1)).toEqual(BELT_ROUTES[i][0]);
});
