// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import type {Scene,Material} from 'three';
let captured:Scene|undefined,capturedCamera:import('three').Camera|undefined;
vi.mock('three',async importOriginal=>{
 const real=await importOriginal<typeof import('three')>();
 return {...real,WebGLRenderer:class {
  domElement=document.createElement('canvas');shadowMap={};info={render:{calls:0,triangles:0},memory:{geometries:0}};
  setPixelRatio(){}setSize(){}dispose(){}render(scene:Scene,camera:import('three').Camera){captured=scene;capturedCamera=camera;}
 }};
});
import {createScene} from '../src/scene';
import {createGame,step} from '../src/simulation';
import {Mesh,InstancedMesh,Matrix4,Vector3,Raycaster} from 'three';
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
it('pans the real camera after a hold and overview restores the view',()=>{
 vi.useFakeTimers();vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});const host=document.createElement('div');Object.defineProperties(host,{clientWidth:{value:390},clientHeight:{value:500}});document.body.append(host);const view=createScene(host);view.update(createGame(),0);const canvas=host.querySelector('canvas')!;const fire=(type:string,x=100,y=100)=>canvas.dispatchEvent(Object.assign(new Event(type,{bubbles:true}),{pointerId:1,button:0,clientX:x,clientY:y}));
 const before=view.metrics().camera;fire('pointerdown');vi.advanceTimersByTime(280);fire('pointermove',150,100);view.update(createGame(),.016);expect(view.metrics().camera.x).not.toBe(before.x);expect(view.metrics().camera.zoom).toBe(before.zoom);fire('pointerup',150,100);view.overview();for(let i=1;i<=200;i++)view.update(createGame(),i*.1);expect(view.metrics().camera.x).toBeCloseTo(0,5);expect(view.metrics().camera.z).toBeCloseTo(0,5);expect(view.metrics().camera.zoom).toBeCloseTo(1,5);view.dispose();host.remove();vi.unstubAllGlobals();vi.useRealTimers();
});

it('selects visible tall machine components with geometry rays, not a floor-only hit box',()=>{
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});const host=document.createElement('div');Object.defineProperties(host,{clientWidth:{value:390},clientHeight:{value:500}});document.body.append(host);const view=createScene(host),state=createGame();state.unlocked=5;view.update(state,0);const canvas=host.querySelector('canvas')!;canvas.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,width:390,height:500,right:390,bottom:500,toJSON(){}});const selected:string[]=[];host.addEventListener('world-station-select',e=>selected.push((e as CustomEvent).detail));
 view.focusStation('press');for(let i=1;i<=100;i++)view.update(state,i*.1);capturedCamera!.updateMatrixWorld();const point=new Vector3(-1.3,3.7,5).project(capturedCamera!);const x=(point.x+1)*195,y=(1-point.y)*250;for(const type of ['pointerdown','pointerup'])canvas.dispatchEvent(Object.assign(new Event(type),{pointerId:1,button:0,clientX:x,clientY:y}));expect(selected).toEqual(['press']);view.dispose();host.remove();vi.unstubAllGlobals();
});
it('shows molten cargo and open packing shells for actual in-process IDs',()=>{
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});const host=document.createElement('div');document.body.append(host);const view=createScene(host),s=createGame();s.unlocked=5;s.items=[{id:1,stage:5,progress:.5,quality:2,value:7},{id:2,stage:9,progress:.5,quality:4,value:20}];s.mined=2;s.nextId=3;view.update(s,1);
 expect((captured!.getObjectByName('cargo:6') as InstancedMesh).count).toBe(1);expect((captured!.getObjectByName('cargo:4') as InstancedMesh).count).toBe(1);expect((captured!.getObjectByName('packing-shells') as InstancedMesh).count).toBe(1);expect(s.items.map(i=>i.quality)).toEqual([2,4]);
 for(const [kind,surface] of [[6,1.16],[4,1.28]]){const mesh=captured!.getObjectByName(`cargo:${kind}`) as InstancedMesh,matrix=new Matrix4();mesh.getMatrixAt(0,matrix);const p=mesh.geometry.getAttribute('position'),v=new Vector3();let min=Infinity;for(let i=0;i<p.count;i++)min=Math.min(min,v.fromBufferAttribute(p,i).applyMatrix4(matrix).y);expect(min).toBeCloseTo(surface,5);}view.dispose();host.remove();vi.unstubAllGlobals();
});
it('never lowers the press die through its actual six working cargo tops',()=>{
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});for(const progress of [.1,.3,.5,.7,.9]){const host=document.createElement('div');document.body.append(host);const view=createScene(host),s=createGame();s.unlocked=5;s.levels.press=6;s.items=Array.from({length:6},(_,i)=>({id:i+1,stage:7 as const,progress,quality:3,value:12}));s.mined=6;s.nextId=7;view.update(s,1);const mesh=captured!.getObjectByName(`cargo:${progress<.6?3:4}`) as InstancedMesh,matrix=new Matrix4();mesh.getMatrixAt(0,matrix);const attr=mesh.geometry.getAttribute('position'),v=new Vector3();let max=-Infinity;for(let i=0;i<attr.count;i++)max=Math.max(max,v.fromBufferAttribute(attr,i).applyMatrix4(matrix).y);const ram=captured!.getObjectByName('press:ram:0')!;expect(1.77+ram.position.y).toBeGreaterThanOrEqual(max+.014);view.dispose();host.remove();}vi.unstubAllGlobals();
});
it('rests the gear on the open packing box floor instead of inside it',()=>{
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});const host=document.createElement('div');document.body.append(host);const view=createScene(host),s=createGame();s.unlocked=5;s.items=[{id:1,stage:9,progress:.5,quality:4,value:20}];s.mined=1;s.nextId=2;view.update(s,1);const gear=captured!.getObjectByName('cargo:4') as InstancedMesh,shell=captured!.getObjectByName('packing-shells') as InstancedMesh,g=new Matrix4(),b=new Matrix4();gear.getMatrixAt(0,g);shell.getMatrixAt(0,b);const p=gear.geometry.getAttribute('position'),v=new Vector3();let min=Infinity;for(let i=0;i<p.count;i++)min=Math.min(min,v.fromBufferAttribute(p,i).applyMatrix4(g).y);const floor=new Vector3(0,.03,0).applyMatrix4(b);expect(min).toBeCloseTo(floor.y,5);view.dispose();host.remove();vi.unstubAllGlobals();
});

it('fits every packing gear tooth within the open box walls',()=>{
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});const host=document.createElement('div');const view=createScene(host),s=createGame();s.unlocked=5;s.items=[{id:1,stage:9,progress:.5,quality:4,value:20}];s.mined=1;s.nextId=2;view.update(s,1);const gear=captured!.getObjectByName('cargo:4') as InstancedMesh,shell=captured!.getObjectByName('packing-shells') as InstancedMesh,g=new Matrix4(),b=new Matrix4();gear.getMatrixAt(0,g);shell.getMatrixAt(0,b);const transform=b.invert().multiply(g),attr=gear.geometry.getAttribute('position'),v=new Vector3();for(let i=0;i<attr.count;i++){v.fromBufferAttribute(attr,i).applyMatrix4(transform);expect(Math.abs(v.x)).toBeLessThanOrEqual(.2);expect(Math.abs(v.z)).toBeLessThanOrEqual(.2);}view.dispose();vi.unstubAllGlobals();
});
it('exposes actual working cargo vertices throughout crush, melt and press phases',()=>{
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});const host=document.createElement('div');const view=createScene(host),s=createGame();s.unlocked=5;for(const station of Object.keys(s.levels))s.levels[station as keyof typeof s.levels]=6;let elapsed=0;const direction=new Vector3(15,33.3,43).normalize();
 for(const stage of [1,5,7])for(const progress of [.15,.5,.72,.99]){s.items=Array.from({length:6},(_,i)=>({id:i+1,stage:stage as any,progress,quality:(stage-1)/2,value:2}));s.mined=6;s.nextId=7;for(let i=0;i<30;i++)view.update(s,elapsed+=1/60);captured!.updateMatrixWorld(true);const root=captured!.children.find(o=>o.type==='Group')!,obstacles:Mesh[]=[];root.traverse(o=>{if(o instanceof Mesh){let at:import('three').Object3D|null=o,visible=true;while(at){if(!at.visible)visible=false;at=at.parent;}if(visible)obstacles.push(o);}});
  const kind=stage===1?(progress>=.62?1:0):stage===5?(progress<.28?2:progress<.72?6:3):(progress>=.6?4:3),cargo=captured!.getObjectByName(`cargo:${kind}`) as InstancedMesh;
  for(let slot=0;slot<6;slot++){const matrix=new Matrix4();cargo.getMatrixAt(slot,matrix);const attr=cargo.geometry.getAttribute('position');let visible=0;for(let i=0;i<attr.count;i++){const v=new Vector3().fromBufferAttribute(attr,i).applyMatrix4(matrix),ray=new Raycaster(v.clone().addScaledVector(direction,12),direction.clone().negate());if(!ray.intersectObjects(obstacles,false).some(h=>h.distance<11.999)){visible++;break;}}expect(visible,`stage${stage} phase${progress} slot${slot}`).toBeGreaterThan(0);}
 }view.dispose();vi.unstubAllGlobals();
});
it('keeps the open ram stationary under reduced motion',()=>{
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener(){},removeEventListener(){}}));const host=document.createElement('div');const view=createScene(host),s=createGame();s.unlocked=5;s.items=[{id:1,stage:7,progress:.1,quality:3,value:12}];s.mined=1;s.nextId=2;view.update(s,0);const ram=captured!.getObjectByName('press:ram:0')!,before=ram.position.y;s.items[0].progress=.5;view.update(s,.2);expect(ram.position.y).toBe(before);s.items[0].progress=.9;view.update(s,.4);expect(ram.position.y).toBe(before);view.dispose();vi.unstubAllGlobals();
});
it('keeps parallel ingot extents separated, not only their center positions',()=>{
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});const host=document.createElement('div');const view=createScene(host),s=createGame();s.unlocked=5;s.levels.press=6;s.items=Array.from({length:6},(_,i)=>({id:i+1,stage:7 as const,progress:.1,quality:3,value:12}));s.mined=6;s.nextId=7;view.update(s,0);const mesh=captured!.getObjectByName('cargo:3') as InstancedMesh,extents=[];for(let slot=0;slot<6;slot++){const matrix=new Matrix4();mesh.getMatrixAt(slot,matrix);const attr=mesh.geometry.getAttribute('position'),v=new Vector3();let min=Infinity,max=-Infinity;for(let i=0;i<attr.count;i++){const x=v.fromBufferAttribute(attr,i).applyMatrix4(matrix).x;min=Math.min(min,x);max=Math.max(max,x);}extents.push({min,max});}for(const i of [0,1,3,4])expect(extents[i+1].min-extents[i].max).toBeGreaterThan(.02);view.dispose();vi.unstubAllGlobals();
});
