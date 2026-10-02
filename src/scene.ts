import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {STATIONS,MAX_ITEMS,isStationUnlocked,STAGE_SECONDS,type GameState,type Station} from './simulation';
import {STATION_POSITIONS as POS,visualItemPosition} from './layout';
import {createFactoryModel} from './machinery';
import {damp,createCameraMotion,focusCamera,advanceCamera} from './motion';
export function createScene(host:HTMLElement){
 const scene=new THREE.Scene();scene.background=new THREE.Color('#0a1b25');scene.fog=new THREE.Fog('#0a1b25',63,115);
 const camera=new THREE.OrthographicCamera(-14,14,22,-22,.1,150),offset=new THREE.Vector3(15,34,43),rig=createCameraMotion();camera.position.copy(offset);camera.lookAt(0,.7,0);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;renderer.domElement.setAttribute('aria-hidden','true');host.appendChild(renderer.domElement);
 scene.add(new THREE.HemisphereLight('#b6dce7','#15282a',1.8));
 // Original low-resolution studio radiance, generated locally; no downloaded HDR asset.
 const faceColors=[[78,110,124],[185,155,111],[146,172,184],[18,28,32],[86,125,139],[54,86,103]];
 const environmentFaces=faceColors.map(color=>{const data=new Uint8Array(32*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const strip=Math.exp(-(((x-11)/4)**2))*.48,falloff=.55+.45*(1-y/31);const i=(y*32+x)*4;for(let c=0;c<3;c++)data[i+c]=Math.min(255,Math.round(color[c]*(falloff+strip)));data[i+3]=255;}const texture=new THREE.DataTexture(data,32,32,THREE.RGBAFormat);texture.needsUpdate=true;return texture;});
 const environment=new THREE.CubeTexture(environmentFaces);environment.colorSpace=THREE.SRGBColorSpace;environment.needsUpdate=true;scene.environment=environment;

 const sun=new THREE.DirectionalLight('#ffe4bc',3.4);sun.position.set(-12,25,13);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-22;sun.shadow.camera.right=22;sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25;sun.shadow.normalBias=.035;scene.add(sun);
 const rim=new THREE.DirectionalLight('#64c8dc',1.65);rim.position.set(17,12,-18);scene.add(rim);
 const model=createFactoryModel();scene.add(model.root);
 const moltenLight=new THREE.PointLight('#ff9148',10,6,2);moltenLight.position.set(POS.smelter[0],1.8,POS.smelter[1]+1.3);scene.add(moltenLight);
 const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');let reduced=media?.matches??false;const onMotionChange=(e:MediaQueryListEvent)=>{reduced=e.matches;};media?.addEventListener?.('change',onMotionChange);
 // Different geometry/material at each real production transformation.
 const raw=new THREE.DodecahedronGeometry(.27,0);
 function cluster(scale:number,colorOffset:number){const source=new THREE.DodecahedronGeometry(scale,0),parts=[];for(let i=0;i<3;i++){const g=source.clone();g.translate((i-1)*scale*.8,i%2*.07,(i%2-.5)*scale);g.rotateY(i+colorOffset);parts.push(g);}source.dispose();const merged=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());return merged;}
 const gearShape=new THREE.Shape();for(let i=0;i<48;i++){const a=i/48*Math.PI*2,r=i%4===0||i%4===3?.22:.285;i===0?gearShape.moveTo(Math.cos(a)*r,Math.sin(a)*r):gearShape.lineTo(Math.cos(a)*r,Math.sin(a)*r);}gearShape.closePath();const hole=new THREE.Path();hole.absarc(0,0,.105,0,Math.PI*2,true);gearShape.holes.push(hole);const gear=new THREE.ExtrudeGeometry(gearShape,{depth:.09,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:1,steps:1,curveSegments:12});gear.rotateX(-Math.PI/2);
 const itemGeometries=[raw,cluster(.15,.1),cluster(.135,.6),new RoundedBoxGeometry(.52,.17,.3,2,.035),gear,new RoundedBoxGeometry(.43,.38,.43,1,.025)];
 const itemMaterials=[new THREE.MeshStandardMaterial({color:'#c38b42',metalness:.5,roughness:.63,flatShading:true}),new THREE.MeshStandardMaterial({color:'#b59061',metalness:.3,roughness:.78,flatShading:true}),new THREE.MeshStandardMaterial({color:'#f2bf60',metalness:.65,roughness:.4,flatShading:true}),new THREE.MeshStandardMaterial({color:'#ffc088',metalness:.8,roughness:.3,emissive:'#8c3b12',emissiveIntensity:.35}),new THREE.MeshStandardMaterial({color:'#b7d0d1',metalness:.85,roughness:.23}),new THREE.MeshStandardMaterial({color:'#c99d62',metalness:.1,roughness:.74})];
 const itemMeshes=itemGeometries.map((geometry,i)=>{const mesh=new THREE.InstancedMesh(geometry,itemMaterials[i],MAX_ITEMS);mesh.name=`cargo:${i}`;mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=true;scene.add(mesh);return mesh;});
 // Packing bands travel with the same actual crate IDs, not extra inventory.
 const bandGeo=new THREE.BoxGeometry(.075,.398,.448),bandMat=new THREE.MeshStandardMaterial({color:'#dee0c8',metalness:.4,roughness:.5}),bands=new THREE.InstancedMesh(bandGeo,bandMat,MAX_ITEMS);bands.count=0;bands.frustumCulled=false;scene.add(bands);
 const smokeGeo=new THREE.IcosahedronGeometry(1,1),smokeMat=new THREE.MeshStandardMaterial({color:'#8da6ac',transparent:true,opacity:.13,depthWrite:false,roughness:1}),smoke=new THREE.InstancedMesh(smokeGeo,smokeMat,8);smoke.count=8;smoke.frustumCulled=false;scene.add(smoke);
 const dummy=new THREE.Object3D(),positions=new Map<number,THREE.Vector3>(),poseBounds=new Map<number,{quality:number;angle:number;min:number;max:number}>(),lastLevels=new Map<Station,number>();let selected:Station='mine',lost=false,lastElapsed=0,initialized=false,frameCount=0;
 const overviewButton=document.createElement('button');overviewButton.className='overview-button';overviewButton.textContent='↖ 全景';overviewButton.setAttribute('aria-label','工場全体を表示');host.appendChild(overviewButton);
 function overview(){focusCamera(rig,0,0,1);model.ring.visible=false;overviewButton.classList.remove('is-focused');}
 function focusStation(station:Station,upgrade=false){selected=station;const [x,z]=POS[station];focusCamera(rig,x,z,upgrade?2.65:2.2);model.ring.position.set(x,.7,z);model.ring.visible=true;overviewButton.classList.add('is-focused');}
 overviewButton.addEventListener('click',overview);
 function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);const aspect=w/h;const neutral=new THREE.PerspectiveCamera();neutral.position.copy(offset);neutral.lookAt(0,.7,0);neutral.updateMatrixWorld();const bounds=new THREE.Box3();for(const x of [-6.2,6.2])for(const y of [-1.7,5])for(const z of [-19.8,19.8])bounds.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(neutral.matrixWorldInverse));const width=Math.max((bounds.max.x-bounds.min.x)*1.05,(bounds.max.y-bounds.min.y)*aspect*1.02),height=width/aspect;camera.left=-width/2;camera.right=width/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();}
 const error=document.createElement('div');error.className='renderer-error';error.hidden=true;error.setAttribute('role','alert');error.innerHTML='<b>3D表示が一時停止しました</b><span>未保存の進行は、再読み込みで失われる場合があります。</span><button type="button">表示を再読み込み</button>';error.querySelector('button')!.onclick=()=>location.reload();host.appendChild(error);
 const contextLost=(event:Event)=>{event.preventDefault();lost=true;error.hidden=false;};const contextRestored=()=>{lost=false;error.hidden=true;resize();};renderer.domElement.addEventListener('webglcontextlost',contextLost);renderer.domElement.addEventListener('webglcontextrestored',contextRestored);const observer=new ResizeObserver(resize);observer.observe(host);resize();
 function update(state:GameState,elapsed:number){
  const dt=Math.min(.15,Math.max(0,elapsed-lastElapsed));lastElapsed=elapsed;if(lost)return;
  if(!initialized){initialized=true;focusStation('mine');rig.x=rig.targetX;rig.z=rig.targetZ;rig.zoom=rig.targetZoom;}
  for(const station of STATIONS){const available=isStationUnlocked(state,station);model.stationGroups[station].visible=available;model.extras[station].visible=available;if(lastLevels.get(station)!==state.levels[station]){model.setLevel(station,state.levels[station]);lastLevels.set(station,state.levels[station]);}}
  advanceCamera(rig,dt,reduced);camera.position.copy(offset).add(new THREE.Vector3(rig.x,0,rig.z));camera.lookAt(rig.x,.7,rig.z);camera.zoom=rig.zoom;camera.updateProjectionMatrix();
  const simTime=state.ticks*.1+state.accumulator;
  moltenLight.visible=isStationUnlocked(state,'smelter');moltenLight.intensity=state.items.some(i=>i.stage===5)?10+(reduced?0:Math.sin(simTime*7)*1.2):5;
  smoke.visible=isStationUnlocked(state,'smelter')&&!reduced;for(let i=0;i<8;i++){const p=(simTime*.17+i/8)%1;dummy.position.set(POS.smelter[0]+1.25+p*.65,4.2+p*2.5,POS.smelter[1]-.65+p*.25);dummy.scale.setScalar(.12+Math.sin(p*Math.PI)*.35);dummy.rotation.set(0,p*2,0);dummy.updateMatrix();smoke.setMatrixAt(i,dummy.matrix);}smoke.instanceMatrix.needsUpdate=true;
  const counts=[0,0,0,0,0,0],alive=new Set<number>();let bandCount=0;
  for(const item of state.items){alive.add(item.id);const kind=item.quality??Math.min(5,Math.floor(item.stage/2));let [x,y,z,angle]=visualItemPosition(item,state);const p=Math.min(1,item.progress+state.accumulator/STAGE_SECONDS[item.stage]);
   if(item.stage===1&&item.progress<1){const slot=state.items.filter(i=>i.stage===1).indexOf(item);if(slot<state.levels.crusher){y=2.42-p*.68;x=POS.crusher[0]+(slot%3-1)*.4;z=POS.crusher[1]-.35+Math.floor(slot/3)*.5;}}
   if(item.stage===9&&item.progress<1){y+=Math.sin(p*Math.PI)*(reduced?.1:.45);}
   
   dummy.rotation.set(kind<3?.16:0,angle+(kind<3?item.id*.73:0),kind<3?.07:0);
   let bounds=poseBounds.get(item.id);if(!bounds||bounds.quality!==kind||bounds.angle!==angle){const attr=itemGeometries[kind].getAttribute('position'),vertex=new THREE.Vector3();let min=Infinity,max=-Infinity;for(let i=0;i<attr.count;i++){const yy=vertex.fromBufferAttribute(attr,i).applyQuaternion(dummy.quaternion).y;min=Math.min(min,yy);max=Math.max(max,yy);}bounds={quality:kind,angle,min,max};poseBounds.set(item.id,bounds);}
   if(item.stage%2===0)y=1.05-bounds.min;
   if(item.stage===11){y=1.05-bounds.min;if(state.items.find(i=>i.stage===11)?.id===item.id&&item.progress<1)y+=Math.sin(p*Math.PI)*(reduced?.1:.5);}
   const target=new THREE.Vector3(x,y,z);let at=positions.get(item.id);if(!at){at=target.clone();positions.set(item.id,at);}else{at.x=damp(at.x,target.x,18,dt);at.y=damp(at.y,target.y,18,dt);at.z=damp(at.z,target.z,18,dt);if(item.stage%2===0)at.y=Math.max(at.y,target.y);}
   dummy.position.copy(at);dummy.rotation.set(kind<3?.16:0,angle+(kind<3?item.id*.73:0),kind<3?.07:0);dummy.scale.setScalar(1);dummy.updateMatrix();itemMeshes[kind].setMatrixAt(counts[kind]++,dummy.matrix);if(kind===5)bands.setMatrixAt(bandCount++,dummy.matrix);
  }
  for(const id of positions.keys())if(!alive.has(id)){positions.delete(id);poseBounds.delete(id);}itemMeshes.forEach((mesh,i)=>{mesh.count=counts[i];mesh.instanceMatrix.needsUpdate=true;});bands.count=bandCount;bands.instanceMatrix.needsUpdate=true;
  for(const mechanism of model.mechanisms){const {object,station,kind,base,phase}=mechanism;object.visible=isStationUnlocked(state,station);if(!object.visible)continue;const stage=STATIONS.indexOf(station)*2-1,item=state.items.find(i=>i.stage===stage);const progress=item?Math.min(1,item.progress+state.accumulator/STAGE_SECONDS[stage]):0;const moving=station==='mine'||!!item;
   object.position.copy(base);
   if(kind==='gear'||kind==='drill'||kind==='roller'||kind==='drum'){const speed=kind==='drill'?1.4:kind==='roller'?3.5:kind==='drum'?1.15:1.9;const direction=kind==='roller'&&base.x>POS[station][0]?-1:1;mechanism.angle=(mechanism.angle??phase)+dt*speed*(moving?1:.15)*direction;object.rotation.z=reduced?phase:mechanism.angle;}
   if(kind==='ram')object.position.y=base.y-(reduced?.2:.62)*Math.sin(progress*Math.PI);
   if(kind==='arm'){object.rotation.y=reduced?0:Math.sin(progress*Math.PI*2)*.38;object.rotation.z=reduced?0:Math.sin(progress*Math.PI)*-.15;}
   if(kind==='hook'||kind==='cable'){const at=item?positions.get(item.id):undefined,bounds=item?poseBounds.get(item.id):undefined;const hookY=at&&bounds?at.y+bounds.max+.08:1.51;if(at){object.position.x=at.x;object.position.z=at.z;}if(kind==='hook')object.position.y=hookY;else{const low=hookY+.18;object.position.y=(3.25+low)/2;object.scale.y=Math.max(.1,3.25-low);}}
  }
  renderer.render(scene,camera);frameCount++;
 }
 return {update,resize,focusStation,setSelected:focusStation,overview,metrics:()=>({drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,selected,frameCount,camera:{x:rig.x,z:rig.z,zoom:rig.zoom},reducedMotion:reduced,trackedItems:positions.size}),dispose(){observer.disconnect();overviewButton.removeEventListener('click',overview);media?.removeEventListener?.('change',onMotionChange);renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.domElement.removeEventListener('webglcontextrestored',contextRestored);const gs=new Set<THREE.BufferGeometry>(model.geometries),ms=new Set<THREE.Material>(model.materials);scene.traverse(o=>{if(o instanceof THREE.Mesh){gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])ms.add(m);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());environment.dispose();environmentFaces.forEach(texture=>texture.dispose());renderer.dispose();positions.clear();poseBounds.clear();host.innerHTML='';}};
}
