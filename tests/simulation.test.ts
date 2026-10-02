import {describe,it,expect} from 'vitest';
import {createGame,step,buyUpgrade,upgradeCost,STATIONS,MAX_ITEMS} from '../src/simulation';
describe('deterministic production',()=>{
 it('turns ore into shipped components and integer credits',()=>{const s=createGame();step(s,30);expect(s.shipped).toBeGreaterThan(0);expect(s.credits).toBe(s.shipped*5);});
 it('keeps every mined unit either in the line or shipped',()=>{const s=createGame();for(let i=0;i<180;i++){step(s,1);expect(s.mined).toBe(s.shipped+s.items.length);}});
 it('gives the first upgrade within the first minute',()=>{const s=createGame();step(s,60);expect(s.credits).toBeGreaterThanOrEqual(upgradeCost(s,'mine'));});
 it('rejects unaffordable and repeated purchases atomically',()=>{const s=createGame();expect(buyUpgrade(s,'mine')).toBe(false);s.credits=20;expect(buyUpgrade(s,'mine')).toBe(true);expect(buyUpgrade(s,'mine')).toBe(false);expect(s.credits).toBe(0);expect(s.levels.mine).toBe(2);});
 it('uses equivalent fixed steps for different frame sizes',()=>{const a=createGame(),b=createGame();step(a,60);for(let i=0;i<600;i++)step(b,.1);expect(a).toEqual(b);});
 it('stays finite, bounded and conserved for thirty minutes',()=>{const s=createGame();s.credits=100000;for(const k of STATIONS)while(buyUpgrade(s,k)){}step(s,1800);expect(s.items.length).toBeLessThanOrEqual(MAX_ITEMS);expect(s.mined).toBe(s.shipped+s.items.length);expect(Number.isSafeInteger(s.credits)).toBe(true);expect(s.credits).toBeGreaterThanOrEqual(0);for(const x of s.items)expect(x.progress).toBeGreaterThanOrEqual(0);});
 it('upgrades processing capacity and stops at the designed max',()=>{const base=createGame(),fast=createGame();fast.credits=100000;for(const k of STATIONS)while(buyUpgrade(fast,k)){}step(base,180);step(fast,180);expect(fast.shipped).toBeGreaterThan(base.shipped*3);expect(buyUpgrade(fast,'mine')).toBe(false);});
 it('ignores invalid and negative elapsed time',()=>{const s=createGame(),start=structuredClone(s);step(s,NaN);step(s,-1);step(s,Infinity);expect(s).toEqual(start);});
});
describe('advertised mining rates',()=>{
 it.each([3,5,6])('preserves fractional tick time at mine level %s',level=>{
  const s=createGame();s.levels={mine:level,smelter:6,press:6,shipping:6};step(s,1800);
  expect(s.mined).toBe(Math.floor((1800+1e-7)/(3.2/level)));
 });
});
