import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {STATIONS,MAX_ITEMS,type GameState,type Station} from './simulation';
import {STATION_INFO} from './ui';
import {STATION_POSITIONS as POS,BELT_ROUTES as ROUTES,visualItemPosition} from './layout';
const rand=(n:number)=>{const x=Math.sin(n*71.27+18.8)*43758.5453;return x-Math.floor(x);};
export function createScene(host:HTMLElement){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#0b2029');scene.fog=new THREE.Fog('#0b2029',55,100);
 const camera=new THREE.OrthographicCamera(-10,10,15,-15,.1,130);camera.position.set(13,30,38);camera.lookAt(0,.2,0);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
 renderer.domElement.setAttribute('aria-hidden','true');host.appendChild(renderer.domElement);
 scene.add(new THREE.HemisphereLight('#c4e7f3','#152323',2.25));
 const sun=new THREE.DirectionalLight('#ffe3ae',3.5);sun.position.set(-9,22,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-15;sun.shadow.camera.right=15;sun.shadow.camera.top=18;sun.shadow.camera.bottom=-18;sun.shadow.normalBias=.035;scene.add(sun);
 const rim=new THREE.DirectionalLight('#42b4c3',1.8);rim.position.set(12,7,-15);scene.add(rim);
 const materials=new Map<string,THREE.MeshStandardMaterial>();
 function mat(color:string,metal=.1,emissive=false){const key=color+metal+emissive;let m=materials.get(key);if(!m){m=new THREE.MeshStandardMaterial({color,roughness:emissive?.65:.82,metalness:metal,flatShading:true,...(emissive?{emissive:color,emissiveIntensity:1.2}:{})});materials.set(key,m);}return m;}
 const M={slate:mat('#2e4750'),dark:mat('#172e37'),edge:mat('#425e62'),rock:mat('#516267'),rock2:mat('#364e58'),rock3:mat('#6c7971'),soil:mat('#263e3e'),brass:mat('#d99b45',.5),gold:mat('#ffc85c',.3),steel:mat('#859996',.55),teal:mat('#3d8a86',.3),light:mat('#92f7c9',.1,true),orange:mat('#ff9b35',.1,true),black:mat('#0a171d'),white:mat('#e0dac7'),cargo:mat('#deac5b'),belt:mat('#23373e')};
 const geometries={box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(1,1,1,10),rock:new THREE.DodecahedronGeometry(1,0),sphere:new THREE.IcosahedronGeometry(1,0)};
 const staticGroup=new THREE.Group();scene.add(staticGroup);
 const dynamic=new THREE.Group();scene.add(dynamic);
 function box(g:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material){const mesh=new THREE.Mesh(geometries.box,m);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;}
 function cyl(g:THREE.Group,x:number,y:number,z:number,r:number,h:number,m:THREE.Material){const mesh=new THREE.Mesh(geometries.cylinder,m);mesh.position.set(x,y,z);mesh.scale.set(r,h,r);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;}
 function rock(g:THREE.Group,x:number,y:number,z:number,sx:number,sy:number,sz:number,m:THREE.Material,seed:number){const mesh=new THREE.Mesh(geometries.rock,m);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.set(rand(seed)*.6,rand(seed+1)*3,rand(seed+2)*.5);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;}
 function bar(g:THREE.Group,a:THREE.Vector3,b:THREE.Vector3,width:number,m:THREE.Material){const mesh=box(g,0,0,0,width,a.distanceTo(b),width,m);mesh.position.copy(a).lerp(b,.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return mesh;}
 function merge(group:THREE.Group){group.updateMatrixWorld(true);const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();group.traverse(o=>{if(o instanceof THREE.Mesh){const material=o.material as THREE.Material;const geo=o.geometry.clone().applyMatrix4(o.matrixWorld);if(!batches.has(material))batches.set(material,[]);batches.get(material)!.push(geo);}});group.clear();for(const [material,geos] of batches){const geo=mergeGeometries(geos);for(const g of geos)g.dispose();if(geo){const mesh=new THREE.Mesh(geo,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}}}
 // A floating cutaway island: original geometry, no external art or models.
 box(staticGroup,0,-.55,0,8.4,1.1,23,M.dark);box(staticGroup,0,.04,0,8.7,.2,23.3,M.slate);box(staticGroup,0,.2,0,8.2,.14,22.8,M.soil);
 for(let i=0;i<25;i++){const z=-11.4+i*.95;for(const side of [-1,1])rock(staticGroup,side*(3.8+rand(i)*.2),-.7,z,.5+rand(i+21)*.35,.7+rand(i+1)*.65,.65,i%3?M.rock2:M.rock,i+side+90);}
 for(let i=0;i<15;i++)box(staticGroup,(rand(i+51)-.5)*7,.286,(rand(i+94)-.5)*21,.3+rand(i)*.3,.022,.15,M.edge);
 // Broken edge stripes, posts, and understated pool lighting.
 for(let z=-10;z<11;z+=2){box(staticGroup,-3.94,.38,z,.11,.13,.7,M.brass);box(staticGroup,3.94,.38,z,.11,.13,.7,M.brass);}
 for(const [x,z] of [[-3.8,-6],[3.8,-.8],[-3.8,5.2],[3.8,10.5]]){cyl(staticGroup,x,.8,z,.035,1.2,M.steel);box(staticGroup,x,1.44,z,.22,.16,.2,M.orange);}
 // Each raised conveyor has rollers, rails, legs and a continuous visible route.
 const rollers:THREE.Mesh[]=[];
 for(const route of ROUTES){for(let j=0;j<route.length-1;j++){
  const [ax,az]=route[j],[bx,bz]=route[j+1],len=Math.hypot(bx-ax,bz-az),x=(ax+bx)/2,z=(az+bz)/2,angle=Math.atan2(bx-ax,bz-az);
  const belt=box(staticGroup,x,.69,z,.85,.18,len+.1,M.belt);belt.rotation.y=angle;
  for(const side of [-1,1]){const rail=box(staticGroup,x+Math.cos(angle)*side*.48,.85,z-Math.sin(angle)*side*.48,.055,.16,len+.15,M.brass);rail.rotation.y=angle;}
  for(let d=.22;d<len;d+=.42){const t=d/len;const roller=cyl(staticGroup,ax+(bx-ax)*t,.8,az+(bz-az)*t,.075,.74,M.steel);roller.rotation.set(0,angle,Math.PI/2);rollers.push(roller);}
  for(let d=.45;d<len;d+=1.7){const t=d/len;box(staticGroup,ax+(bx-ax)*t,.46,az+(bz-az)*t,.55,.38,.18,M.dark);}
 }}
 const movingParts:Record<Station,THREE.Group>={mine:new THREE.Group(),smelter:new THREE.Group(),press:new THREE.Group(),shipping:new THREE.Group()};
 const extras:Record<Station,THREE.Group>={mine:new THREE.Group(),smelter:new THREE.Group(),press:new THREE.Group(),shipping:new THREE.Group()};
 const labelEls={} as Record<Station,HTMLButtonElement>;
 for(const station of STATIONS){
  const [x,z]=POS[station];box(staticGroup,x,.39,z,3.2,.22,2.8,M.edge);box(staticGroup,x,.53,z,3,.08,2.65,M.dark);
  for(const dx of [-1.42,1.42])for(const dz of [-1.22,1.22])box(staticGroup,x+dx,.59,z+dz,.18,.05,.18,M.brass);
  movingParts[station].position.set(x,0,z);dynamic.add(movingParts[station]);scene.add(extras[station]);
  const label=document.createElement('button');label.className='world-label';label.dataset.worldStation=station;label.setAttribute('aria-label',`${STATION_INFO[station].name}を選択`);label.innerHTML=`<i></i><span>${STATION_INFO[station].short}</span><small>01</small>`;host.appendChild(label);labelEls[station]=label;
 }
 // Mine mouth and cantilevered drill rig.
 for(let i=0;i<9;i++){const a=i/8*Math.PI;rock(staticGroup,-1+Math.cos(a)*1.65,1.0+Math.sin(a)*1.8,-8.75+(rand(i)-.5)*.3,.7,.9,.75,i%2?M.rock:M.rock2,i+15);}
 box(staticGroup,-1,.99,-8.83,1.4,1.1,.3,M.black);
 for(let i=0;i<10;i++){const angle=rand(i+5)*Math.PI;rock(staticGroup,-1+Math.cos(angle)*1.75,1.08+Math.sin(angle)*1.8,-8.15,.1,.14,.1,M.gold,i+3);}
 box(staticGroup,-1,1.0,-7.72,1.1,.7,1.05,M.teal);box(staticGroup,-1,1.45,-7.9,1.32,.21,.75,M.brass);box(staticGroup,-1,1.32,-7.28,.65,.16,.08,M.light);
 for(const dx of [-.62,.62]){cyl(staticGroup,-1+dx,.72,-7.85,.23,.22,M.black).rotation.z=Math.PI/2;}
 const drill=movingParts.mine;const drillAxle=cyl(drill,0,1.36,-.68,.14,1.1,M.steel);drillAxle.rotation.x=Math.PI/2;for(let i=0;i<5;i++){const tooth=box(drill,0,1.36,-.5-i*.15,.47-i*.065,.12,.12,M.brass);tooth.rotation.z=i*.8;}
 for(let i=0;i<5;i++)rock(staticGroup,-2.6+rand(i)*.6,.43,-7.5+rand(i+8),.22,.18,.19,M.gold,i);
 // Smelter, glowing front, chimney, and service pipe.
 cyl(staticGroup,1,1.28,-2.7,.82,1.45,M.slate);cyl(staticGroup,1,2.05,-2.7,.95,.18,M.brass);cyl(staticGroup,1,2.34,-2.7,.64,.42,M.dark);cyl(staticGroup,1,2.59,-2.7,.52,.12,M.steel);
 box(staticGroup,1,1.1,-1.96,.95,.7,.18,M.black);box(staticGroup,1,1.07,-1.83,.71,.47,.12,M.orange);for(let i=0;i<3;i++)box(staticGroup,.75+i*.25,1.06,-1.74,.07,.55,.08,M.dark);
 cyl(staticGroup,1.8,2.5,-3.2,.25,2.85,M.dark);cyl(staticGroup,1.8,3.98,-3.2,.35,.12,M.brass);bar(staticGroup,new THREE.Vector3(1.45,1.9,-2.7),new THREE.Vector3(1.8,1.9,-3.2),.23,M.steel);
 const fire=new THREE.PointLight('#ff9e3b',9,5,2);fire.position.set(1,1.55,-1.55);scene.add(fire);
 for(let i=0;i<4;i++){const cloud=new THREE.Mesh(geometries.sphere,new THREE.MeshStandardMaterial({color:'#93a8a2',transparent:true,opacity:.14,flatShading:true,depthWrite:false}));movingParts.smelter.add(cloud);cloud.position.set(.8,4+i*.4,-.5);}
 // Gantry press, working piston and striped die.
 box(staticGroup,-1,.78,2.7,2.2,.32,1.55,M.steel);for(const dx of [-.86,.86])box(staticGroup,-1+dx,1.7,2.65,.27,2.0,.8,M.teal);box(staticGroup,-1,2.64,2.65,2.1,.45,1.0,M.teal);box(staticGroup,-1,2.91,2.65,1.2,.15,.7,M.brass);cyl(staticGroup,-1,3.11,2.65,.27,.4,M.dark);
 box(staticGroup,-1,.99,2.7,1.08,.12,.93,M.dark);box(staticGroup,-1,2.66,3.18,.77,.11,.02,M.light);
 cyl(movingParts.press,0,2.08,-.05,.18,.95,M.steel);box(movingParts.press,0,1.72,0,1.1,.3,.9,M.brass);for(let i=0;i<4;i++){const stripe=box(movingParts.press,-.42+i*.27,1.72,.457,.12,.3,.01,M.black);stripe.rotation.z=-.3;}
 // Shipping depot, packing bench, crates, and a tiny electric delivery cart.
 box(staticGroup,1,.74,8,2.5,.3,2.05,M.teal);for(const dx of [-1.05,1.05])box(staticGroup,1+dx,1.69,7.5,.13,1.6,.13,M.steel);box(staticGroup,1,2.48,7.65,2.7,.16,1.4,M.teal);box(staticGroup,1,2.4,8.38,2.7,.15,.05,M.brass);
 box(staticGroup,1.72,1.2,7.7,.55,.65,.6,M.cargo);box(staticGroup,1.72,1.23,8.34,.6,.6,.6,M.cargo);for(const z of [7.7,8.34])box(staticGroup,1.72,1.53,z,.14,.03,.64,M.white);
 box(staticGroup,-.65,.77,9.4,1.6,.28,1,M.dark);box(staticGroup,-1.18,1.2,9.4,.65,.6,1,M.teal);box(staticGroup,-1.18,1.38,9.95,.52,.3,.02,M.light);box(staticGroup,-.18,1.07,9.4,.65,.42,.82,M.cargo);for(const x of [-1.2,-.1])for(const z of [8.91,9.89]){const wheel=cyl(staticGroup,x,.55,z,.22,.18,M.black);wheel.rotation.x=Math.PI/2;}
 // Small utility details give the line a human scale.
 for(const [x,z] of [[-2.8,-2.8],[2.7,2.4],[-2.5,8]]){cyl(staticGroup,x,.74,z,.24,.8,M.teal);cyl(staticGroup,x,1.16,z,.26,.06,M.steel);}
 merge(staticGroup);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(1.9,.028,4,56),new THREE.MeshBasicMaterial({color:'#9bf0d1',transparent:true,opacity:.7}));ring.rotation.x=-Math.PI/2;ring.position.y=.57;scene.add(ring);
 const itemMaterials=[M.gold,M.steel,M.cargo];
 const itemMeshes=itemMaterials.map((material,i)=>{const geometry=i===0?geometries.rock:geometries.box;const m=new THREE.InstancedMesh(geometry,material,MAX_ITEMS);m.count=0;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.castShadow=true;m.frustumCulled=false;scene.add(m);return m;});
 const dummy=new THREE.Object3D();const lastLevels={mine:0,smelter:0,press:0,shipping:0};let selected:Station='mine';let lost=false;
 function setSelected(s:Station){selected=s;const [x,z]=POS[s];ring.position.set(x,.57,z);for(const k of STATIONS)labelEls[k].classList.toggle('selected',k===s);}
 const pick=(event:Event)=>{const s=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-world-station]')?.dataset.worldStation as Station|undefined;if(s)host.dispatchEvent(new CustomEvent('world-select',{detail:s,bubbles:true}));};host.addEventListener('click',pick);
 function grow(station:Station,level:number){const group=extras[station];for(const child of [...group.children]){if(child instanceof THREE.Mesh)child.geometry.dispose();group.remove(child);}const [x,z]=POS[station];for(let i=1;i<level;i++){const dx=(i%2?1:-1)*(1.7+Math.floor((i-1)/2)*.42),dz=-.7+Math.floor((i-1)/2)*.64;
  if(station==='mine'){box(group,x+dx,.96,z+dz,.48,.85,.56,M.teal);cyl(group,x+dx,1.57,z+dz,.14,.45,M.brass);box(group,x+dx,1.3,z+dz+.3,.29,.08,.04,M.light);}
  if(station==='smelter'){cyl(group,x+dx,.95,z+dz,.26,1.1,M.slate);cyl(group,x+dx,1.57,z+dz,.3,.15,M.brass);box(group,x+dx,.85,z+dz+.27,.23,.3,.05,M.orange);}
  if(station==='press'){box(group,x+dx,1.02,z+dz,.53,1.0,.56,M.teal);box(group,x+dx,1.56,z+dz,.6,.2,.64,M.brass);box(group,x+dx,1.0,z+dz+.29,.28,.4,.03,M.dark);}
  if(station==='shipping'){box(group,x+dx,.73,z+dz,.6,.4,.63,M.cargo);box(group,x+dx,.94,z+dz,.16,.03,.65,M.white);box(group,x+dx,.52,z+dz,.75,.05,.75,M.teal);}
 }merge(group);lastLevels[station]=level;}
 function resize(){const w=host.clientWidth,h=host.clientHeight;if(w===0||h===0)return;renderer.setSize(w,h,false);const aspect=w/h;camera.updateMatrixWorld();const bounds=new THREE.Box3();for(const x of [-4.6,4.6])for(const y of [-1.5,4.9])for(const z of [-11.9,11.9])bounds.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));const width=Math.max((bounds.max.x-bounds.min.x)*1.06,(bounds.max.y-bounds.min.y)*aspect*1.03);const height=width/aspect;camera.left=-width/2;camera.right=width/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();}
 const error=document.createElement('div');error.className='renderer-error';error.hidden=true;error.setAttribute('role','alert');error.innerHTML='<b>3D表示が一時停止しました</b><span>進行は保存されています。</span><button type="button">表示を再読み込み</button>';error.querySelector('button')!.onclick=()=>window.location.reload();host.appendChild(error);
 const contextLost=(event:Event)=>{event.preventDefault();lost=true;error.hidden=false;};const contextRestored=()=>{lost=false;error.hidden=true;resize();};renderer.domElement.addEventListener('webglcontextlost',contextLost);renderer.domElement.addEventListener('webglcontextrestored',contextRestored);
 const observer=new ResizeObserver(resize);observer.observe(host);setSelected('mine');resize();
 return {resize,setSelected,update(state:GameState,elapsed:number){
  if(lost)return;for(const k of STATIONS){if(state.levels[k]!==lastLevels[k])grow(k,state.levels[k]);const label=labelEls[k];label.querySelector('small')!.textContent=`0${state.levels[k]}`;const q=state.items.filter(i=>i.stage===STATIONS.indexOf(k)*2-1).length-state.levels[k];label.classList.toggle('waiting',q>0);const [x,z]=POS[k],p=new THREE.Vector3(x-1.85,.8,z-1.4).project(camera);label.style.left=`${(p.x*.5+.5)*host.clientWidth}px`;label.style.top=`${(-p.y*.5+.5)*host.clientHeight}px`;}
  movingParts.mine.rotation.z=Math.sin(elapsed*18)*.035;const active=state.items.find(i=>i.stage===3);movingParts.press.position.y=active?-.48*Math.sin(active.progress*Math.PI):0;
  movingParts.smelter.children.forEach((o,i)=>{const phase=(elapsed*.3+i*.25)%1;o.position.y=4+phase*1.6;o.position.x=.8+phase*.4;o.scale.setScalar(.18+phase*.35);(o as THREE.Mesh).material instanceof THREE.MeshStandardMaterial&&((o as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>).material.opacity=(1-phase)*.14);});
  fire.intensity=state.items.some(i=>i.stage===1)?8+Math.sin(elapsed*7)*2:4;
  const counts=[0,0,0];for(const item of state.items){const kind=Math.min(2,Math.floor(item.stage/2)),[x,y,z,angle]=visualItemPosition(item,state);dummy.position.set(x,y,z);dummy.rotation.set(kind===0?.3:0,angle+ (kind===0?item.id*.73:0),kind===0?.12:0);dummy.scale.set(kind===0?.22:kind===1?.42:.33,kind===0?.2:kind===1?.14:.3,kind===0?.22:kind===1?.25:.33);dummy.updateMatrix();itemMeshes[kind].setMatrixAt(counts[kind]++,dummy.matrix);}
  itemMeshes.forEach((mesh,i)=>{mesh.count=counts[i];mesh.instanceMatrix.needsUpdate=true;});renderer.render(scene,camera);
 },metrics:()=>({drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,selected}),dispose(){observer.disconnect();host.removeEventListener('click',pick);renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.domElement.removeEventListener('webglcontextrestored',contextRestored);const ownedMaterials=new Set<THREE.Material>(materials.values());scene.traverse(o=>{if(o instanceof THREE.Mesh){if(!Object.values(geometries).includes(o.geometry))o.geometry.dispose();for(const material of Array.isArray(o.material)?o.material:[o.material])ownedMaterials.add(material);}});for(const geo of Object.values(geometries))geo.dispose();for(const material of ownedMaterials)material.dispose();renderer.dispose();host.innerHTML='';}};
}
