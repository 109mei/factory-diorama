import {it,expect} from 'vitest';
import {damp,createCameraMotion,focusCamera,advanceCamera} from '../src/motion';
it('uses elapsed seconds so easing is invariant to frame partition',()=>{let a=0;for(let i=0;i<60;i++)a=damp(a,10,4,1/60);const b=damp(0,10,4,1);expect(a).toBeCloseTo(b,12);});
it('focuses without changing orientation and respects reduced motion',()=>{const c=createCameraMotion();focusCamera(c,2,10,2.5);advanceCamera(c,.1,false);expect(c.x).toBeGreaterThan(0);expect(c.x).toBeLessThan(2);expect(c.zoom).toBeGreaterThan(1);advanceCamera(c,.1,true);expect(c.x).toBe(2);expect(c.z).toBe(10);expect(c.zoom).toBe(2.5);});
