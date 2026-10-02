// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import type {Scene,Material} from 'three';
let captured:Scene|undefined;
vi.mock('three',async importOriginal=>{
 const real=await importOriginal<typeof import('three')>();
 return {...real,WebGLRenderer:class {
  domElement=document.createElement('canvas');shadowMap={};info={render:{calls:0,triangles:0},memory:{geometries:0}};
  setPixelRatio(){}setSize(){}dispose(){}render(scene:Scene){captured=scene;}
 }};
});
import {createScene} from '../src/scene';
import {createGame} from '../src/simulation';
import {Mesh} from 'three';
it('disposes every material in the real factory graph, including smoke and selection ring',()=>{
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
 const host=document.createElement('div');document.body.append(host);const view=createScene(host);view.update(createGame(),0);
 const materials=new Set<Material>();captured!.traverse(o=>{if(o instanceof Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
 expect(materials.size).toBeGreaterThan(16);const disposed=new Set<Material>();for(const m of materials)m.addEventListener('dispose',()=>disposed.add(m));
 view.dispose();expect(disposed.size).toBe(materials.size);host.remove();vi.unstubAllGlobals();
});
