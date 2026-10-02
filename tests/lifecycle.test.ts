import {it,expect} from 'vitest';
import {createGame,step} from '../src/simulation';
import {createLifecycle} from '../src/lifecycle';
it('pauses foreground advancement while hidden and catches up exactly once',()=>{const s=createGame(),expected=createGame(),life=createLifecycle(s);life.advance(30);life.hide(1000);life.advance(100);life.hide(2000);const result=life.resume(61000);step(expected,90);expect(s).toEqual(expected);expect(result.seconds).toBe(60);const before=structuredClone(s);life.resume(62000);expect(s).toEqual(before);});
it('preserves the hide timestamp when saving during pagehide later',()=>{const life=createLifecycle(createGame());life.hide(1000);expect(life.saveTimestamp(61000)).toBe(1000);life.resume(61000);expect(life.saveTimestamp(62000)).toBe(62000);});
it('caps background production and rejects clock rollback',()=>{const s=createGame(),life=createLifecycle(s),expected=createGame();life.hide(10000);expect(life.resume(1000).seconds).toBe(0);expect(s).toEqual(expected);life.hide(20000);life.resume(99999999);step(expected,1800);expect(s).toEqual(expected);});
