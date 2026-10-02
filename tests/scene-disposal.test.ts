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
import {createGame,step} from '../src/simulation';
import {Mesh,InstancedMesh,Matrix4,Vector3} from 'three';
it('disposes every material in the real factory graph, including smoke and selection ring',()=>{
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
 const host=document.createElement('div');document.body.append(host);const view=createScene(host);view.update(createGame(),0);
 const materials=new Set<Material>();captured!.traverse(o=>{if(o instanceof Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
 expect(materials.size).toBeGreaterThan(16);const disposed=new Set<Material>();for(const m of materials)m.addEventListener('dispose',()=>disposed.add(m));
 view.dispose();expect(disposed.size).toBe(materials.size);host.remove();vi.unstubAllGlobals();
});
it('keeps all station names out of the 3D world and exposes explicit camera focus',()=>{
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
 const host=document.createElement('div');document.body.append(host);const view=createScene(host);view.update(createGame(),0);
 expect(host.querySelectorAll('.world-label,[data-world-station]').length).toBe(0);
 expect(typeof (view as any).focusStation).toBe('function');expect(typeof (view as any).overview).toBe('function');view.dispose();host.remove();vi.unstubAllGlobals();
});
it.each(['backlog','parallel'])('keeps crusher %s cargo at unique actual render positions',mode=>{
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});const s=createGame();s.unlocked=1;
 if(mode==='backlog'){s.levels.mine=6;step(s,1800);}else{s.levels.crusher=6;s.items=Array.from({length:6},(_,i)=>({id:i+1,stage:1 as const,progress:.3,quality:0,value:2}));s.mined=6;s.nextId=7;}
 const host=document.createElement('div');document.body.append(host);const view=createScene(host);view.update(s,1);const raw=s.items.filter(i=>i.quality===0),mesh=captured!.getObjectByName('cargo:0') as InstancedMesh,positions=[];
 for(const item of s.items.filter(i=>i.stage===1)){const matrix=new Matrix4();mesh.getMatrixAt(raw.indexOf(item),matrix);const p=new Vector3().setFromMatrixPosition(matrix);positions.push(p.toArray().map(x=>x.toFixed(5)).join(','));}
 expect(new Set(positions).size).toBe(positions.length);view.dispose();host.remove();vi.unstubAllGlobals();
});
it('counter-rotates crusher rollers without a phase jump when work starts',()=>{
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});const s=createGame();s.unlocked=5;s.ticks=1000;const host=document.createElement('div');document.body.append(host);const view=createScene(host);view.update(s,100);
 const left=captured!.getObjectByName('crusher:roller:0')!,right=captured!.getObjectByName('crusher:roller:1')!,a=left.rotation.z,b=right.rotation.z;
 s.items=[{id:1,stage:1,progress:.2,quality:0,value:2}];s.mined=1;s.nextId=2;s.ticks=1001;view.update(s,100.1);
 const wrap=(x:number)=>Math.atan2(Math.sin(x),Math.cos(x)),da=wrap(left.rotation.z-a),db=wrap(right.rotation.z-b);expect(Math.abs(da)).toBeLessThan(.5);expect(Math.abs(db)).toBeLessThan(.5);expect(da*db).toBeLessThan(0);view.dispose();host.remove();vi.unstubAllGlobals();
});
it('does not promise a successful save when context is lost',()=>{
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});const host=document.createElement('div');document.body.append(host);const view=createScene(host);host.querySelector('canvas')!.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));expect(host.querySelector('.renderer-error')?.textContent).toContain('未保存');view.dispose();host.remove();vi.unstubAllGlobals();
});
it('uses owned procedural reflection textures and disposes them on teardown',()=>{
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});const host=document.createElement('div');document.body.append(host);const view=createScene(host);view.update(createGame(),0);const environment=captured!.environment as import('three').CubeTexture;
 expect(environment).toBeTruthy();expect(environment.images.length).toBe(6);const textures=[environment,...environment.images] as import('three').Texture[],disposed=new Set();for(const texture of textures)texture.addEventListener('dispose',()=>disposed.add(texture));view.dispose();expect(disposed.size).toBe(7);host.remove();vi.unstubAllGlobals();
});
it('rests every transformed cargo quality on the belt surface, including rotated raw ore',()=>{
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});const s=createGame();s.unlocked=5;s.items=Array.from({length:6},(_,i)=>({id:i+1,stage:(i*2) as any,progress:.5,quality:i,value:[2,4,7,12,20,32][i]}));s.items.push({id:11,stage:0,progress:.25,quality:0,value:2});s.mined=7;s.nextId=12;
 const host=document.createElement('div');document.body.append(host);const view=createScene(host);view.update(s,1);const counters=Array(6).fill(0);
 for(const item of s.items){const mesh=captured!.getObjectByName(`cargo:${item.quality}`) as InstancedMesh,matrix=new Matrix4();mesh.getMatrixAt(counters[item.quality]++,matrix);const attr=mesh.geometry.getAttribute('position'),v=new Vector3();let bottom=Infinity;for(let i=0;i<attr.count;i++)bottom=Math.min(bottom,v.fromBufferAttribute(attr,i).applyMatrix4(matrix).y);expect(bottom).toBeCloseTo(1.05,5);}
 view.dispose();host.remove();vi.unstubAllGlobals();
});
it('keeps the dispatch hook attached to the actual lifted cargo top',()=>{
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});const s=createGame();s.unlocked=5;s.items=[{id:1,stage:11,progress:.5,quality:5,value:32}];s.mined=1;s.nextId=2;const host=document.createElement('div');document.body.append(host);const view=createScene(host);view.update(s,1);
 const hook=captured!.getObjectByName('shipping:hook:0')!,cargo=captured!.getObjectByName('cargo:5') as InstancedMesh,matrix=new Matrix4();cargo.getMatrixAt(0,matrix);const position=new Vector3().setFromMatrixPosition(matrix);expect(hook.position.y-.08).toBeCloseTo(position.y+.19,5);expect(hook.position.x).toBeCloseTo(position.x,5);expect(hook.position.z).toBeCloseTo(position.z,5);view.dispose();host.remove();vi.unstubAllGlobals();
});
