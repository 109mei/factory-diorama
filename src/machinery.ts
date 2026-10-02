import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {STATIONS,type Station} from './simulation';
import {STATION_POSITIONS as P,BELT_ROUTES} from './layout';
export type MechanismKind='gear'|'roller'|'drum'|'ram'|'arm'|'hook'|'cable'|'drill';
export interface Mechanism{station:Station;kind:MechanismKind;object:THREE.Group;base:THREE.Vector3;phase:number;angle?:number;}
const random=(n:number)=>{const v=Math.sin(n*47.73+21.47)*49632.315;return v-Math.floor(v);};
export function createFactoryModel(){
 const root=new THREE.Group(),infrastructure=new THREE.Group(),dynamic=new THREE.Group();let staticRoot=infrastructure;root.add(infrastructure,dynamic);
 const stationGroups=Object.fromEntries(STATIONS.map(station=>{const group=new THREE.Group();root.add(group);return [station,group];})) as Record<Station,THREE.Group>;
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),mechanisms:Mechanism[]=[];
 const own=<T extends THREE.BufferGeometry>(g:T)=>{geometries.add(g);return g;};
 const material=(color:string,metalness=.2,roughness=.6,emissive?:string)=>{const m=new THREE.MeshStandardMaterial({color,metalness,roughness,...(emissive?{emissive,emissiveIntensity:1.4}:{})});materials.add(m);return m;};
 const m={concrete:material('#304346',.05,.96),foundation:material('#132a32',.05,.95),edge:material('#506669',.35,.7),steel:material('#a6b9b6',.8,.3),darkSteel:material('#30474f',.75,.4),teal:material('#3a807d',.55,.42),petrol:material('#24545f',.6,.46),gold:material('#dbad56',.65,.35),copper:material('#b77b50',.8,.4),rubber:material('#101b20',.05,.95),rock:material('#566068',.05,1),rockDark:material('#343f46',.05,1),ore:material('#ac793e',.45,.68),wood:material('#b99362',.1,.75),white:material('#d7ded0',.3,.4),glass:material('#5b9fab',.7,.16),hot:material('#ff9739',.25,.35,'#ff6b16'),lamp:material('#b9f6d2',.1,.3,'#86e8b7'),red:material('#ac5944',.35,.6)};
 const geo={box:own(new THREE.BoxGeometry(1,1,1)),round:own(new RoundedBoxGeometry(1,1,1,2,.075)),cylinder:own(new THREE.CylinderGeometry(1,1,1,16)),rock:own(new THREE.DodecahedronGeometry(1,0)),ball:own(new THREE.IcosahedronGeometry(1,1))};
 function mesh(g:THREE.Group,geometry:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number,sx=1,sy=1,sz=1){const o=new THREE.Mesh(geometry,mat);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;}
 const box=(g:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material,round=false)=>mesh(g,round?geo.round:geo.box,mat,x,y,z,w,h,d);
 const cyl=(g:THREE.Group,x:number,y:number,z:number,r:number,h:number,mat:THREE.Material)=>mesh(g,geo.cylinder,mat,x,y,z,r,h,r);
 function beam(g:THREE.Group,a:THREE.Vector3,b:THREE.Vector3,width:number,mat:THREE.Material){const o=box(g,0,0,0,width,a.distanceTo(b),width,mat);o.position.copy(a).lerp(b,.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return o;}
 function tube(g:THREE.Group,points:number[][],r:number,mat:THREE.Material){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],p[1],p[2])));return mesh(g,own(new THREE.TubeGeometry(curve,Math.max(10,points.length*5),r,7,false)),mat,0,0,0);}
 function batch(group:THREE.Group){group.updateWorldMatrix(true,true);const inverse=group.matrixWorld.clone().invert(),batches=new Map<THREE.Material,THREE.BufferGeometry[]>();group.traverse(o=>{if(o instanceof THREE.Mesh){const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(inverse.clone().multiply(o.matrixWorld));const mat=o.material as THREE.Material;if(!batches.has(mat))batches.set(mat,[]);batches.get(mat)!.push(g);}});group.clear();for(const [mat,geos] of batches){const merged=mergeGeometries(geos);geos.forEach(g=>g.dispose());if(merged)mesh(group,own(merged),mat,0,0,0);}}
 function mechanism(station:Station,kind:MechanismKind,x:number,y:number,z:number){const g=new THREE.Group();const [sx,sz]=P[station];g.position.set(sx+x,y,sz+z);g.name=`${station}:${kind}:${mechanisms.filter(m=>m.station===station&&m.kind===kind).length}`;dynamic.add(g);mechanisms.push({station,kind,object:g,base:g.position.clone(),phase:mechanisms.length*.7});return g;}
 function gear(g:THREE.Group,x:number,y:number,z:number,r:number,mat:THREE.Material,teeth=14){const shape=new THREE.Shape();for(let i=0;i<teeth*4;i++){const a=i/(teeth*4)*Math.PI*2,rr=i%4===0||i%4===3?r*.87:r;const px=Math.cos(a)*rr,py=Math.sin(a)*rr;if(i===0)shape.moveTo(px,py);else shape.lineTo(px,py);}shape.closePath();const hole=new THREE.Path();hole.absarc(0,0,r*.25,0,Math.PI*2,true);shape.holes.push(hole);return mesh(g,own(new THREE.ExtrudeGeometry(shape,{depth:.14,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.025,bevelThickness:.018,curveSegments:12})),mat,x,y,z);}
 function bolts(g:THREE.Group,x:number,y:number,z:number,w:number,h:number){for(const dx of [-w/2,w/2])for(const dy of [-h/2,h/2]){const b=cyl(g,x+dx,y+dy,z,.045,.05,m.steel);b.rotation.x=Math.PI/2;}}
 function motor(g:THREE.Group,x:number,y:number,z:number){const body=cyl(g,x,y,z,.24,.65,m.petrol);body.rotation.z=Math.PI/2;for(let i=0;i<6;i++){const rib=cyl(g,x-.27+i*.11,y,z,.27,.035,m.edge);rib.rotation.z=Math.PI/2;}box(g,x,y-.24,z,.7,.12,.56,m.darkSteel);box(g,x,y+.26,z,.23,.12,.2,m.gold,true);}
 function platform(g:THREE.Group,x:number,z:number,w=4.25,d=3.45){box(g,x,.43,z,w,.28,d,m.foundation,true);box(g,x,.61,z,w-.1,.08,d-.1,m.edge);for(let i=0;i<7;i++){const stripe=box(g,x-w/2+.28+i*.24,.665,z+d/2-.2,.11,.01,.28,i%2?m.rubber:m.gold);stripe.rotation.y=.25;}for(const dx of [-w/2+.15,w/2-.15])for(const dz of [-d/2+.14,d/2-.14])cyl(g,x+dx,.67,z+dz,.065,.03,m.steel);}
 // An irregular, cut-away industrial site rather than a featureless rectangular board.
 const outline=new THREE.Shape();const corners=[[-5.5,-18],[-2.5,-19],[3,-18.5],[5.1,-16.5],[5.5,14],[4.5,18.5],[-4.5,18.2],[-5.5,14]];corners.forEach(([x,z],i)=>i?outline.lineTo(x,-z):outline.moveTo(x,-z));outline.closePath();
 const island=mesh(staticRoot,own(new THREE.ExtrudeGeometry(outline,{depth:1.1,steps:1,bevelEnabled:true,bevelSize:.18,bevelThickness:.12,bevelSegments:2})),m.foundation,0,-1,0);island.rotation.x=-Math.PI/2;
 box(staticRoot,0,.12,0,10,.18,35.7,m.concrete,true);
 for(let i=0;i<26;i++){const z=-17.3+i*1.35;for(const side of [-1,1]){const r=mesh(staticRoot,geo.rock,i%3?m.rockDark:m.rock,side*(4.8+random(i)*.3),-.65,z,.55+random(i+3)*.3,.65+random(i+6)*.5,.8);r.rotation.set(random(i)*.4,random(i+2)*2,random(i+5)*.4);}}
 for(let z=-16;z<=16;z+=2){box(staticRoot,0,.224,z,9.7,.012,.023,m.foundation);for(const x of [-4.9,4.9])box(staticRoot,x,.26,z,.055,.035,.85,m.gold);}
 // Service spine: copper pipes, insulation bands, catwalk rail and warm maintenance lamps.
 tube(staticRoot,[[-4.55,.55,-16.8],[-4.55,.55,16.4]],.13,m.copper);
 for(let z=-16;z<17;z+=2.3){const ring=cyl(staticRoot,-4.55,.55,z,.17,.1,m.darkSteel);ring.rotation.x=Math.PI/2;box(staticRoot,-4.55,.31,z,.45,.18,.24,m.edge);}
 for(let z=-14;z<17;z+=5){cyl(staticRoot,4.8,1.04,z,.035,1.65,m.darkSteel);box(staticRoot,4.68,1.9,z,.4,.12,.24,m.darkSteel,true);box(staticRoot,4.68,1.82,z,.29,.025,.17,m.lamp);}
 // Belts have load-bearing trestles, inset rollers, continuous rails and guarded corners.
 for(const route of BELT_ROUTES)for(let j=0;j<route.length-1;j++){
  const [ax,az]=route[j],[bx,bz]=route[j+1],length=Math.hypot(bx-ax,bz-az),angle=Math.atan2(bx-ax,bz-az),x=(ax+bx)/2,z=(az+bz)/2;
  const bed=box(staticRoot,x,.91,z,.83,.16,length+.1,m.rubber);bed.rotation.y=angle;
  for(const side of [-1,1]){const rail=box(staticRoot,x+Math.cos(angle)*side*.48,1.05,z-Math.sin(angle)*side*.48,.055,.17,length+.15,m.darkSteel);rail.rotation.y=angle;const trim=box(staticRoot,x+Math.cos(angle)*side*.49,1.15,z-Math.sin(angle)*side*.49,.042,.04,length+.15,m.gold);trim.rotation.y=angle;}
  for(let d=.2;d<length;d+=.34){const t=d/length,o=cyl(staticRoot,ax+(bx-ax)*t,1,az+(bz-az)*t,.046,.75,m.steel);o.rotation.set(0,angle,Math.PI/2);}
  for(let d=.35;d<length;d+=1.6){const t=d/length,px=ax+(bx-ax)*t,pz=az+(bz-az)*t;for(const side of [-1,1])box(staticRoot,px+Math.cos(angle)*side*.32,.6,pz-Math.sin(angle)*side*.32,.09,.6,.13,m.edge);}
 }
 for(const station of STATIONS){const [x,z]=P[station];platform(staticRoot,x,z);}
 staticRoot=stationGroups.mine;
 // Mine: exposed mineral face and a toothed bucket-wheel excavator with a hydraulic boom.
 {const [x,z]=P.mine;for(let i=0;i<11;i++){const a=i/10*Math.PI,r=mesh(staticRoot,geo.rock,i%2?m.rock:m.rockDark,x+Math.cos(a)*2.2,.85+Math.sin(a)*2.5,z-1.5+(random(i)-.5)*.6,.8,1.1,.85);r.rotation.y=random(i+3)*4;}
  box(staticRoot,x,1.27,z-1.57,1.45,1.3,.17,m.rubber);for(let i=0;i<14;i++){const a=random(i+11)*Math.PI;mesh(staticRoot,geo.rock,m.ore,x+Math.cos(a)*2.05,1+Math.sin(a)*2.4,z-.95,.1,.15,.1);}
  box(staticRoot,x,.95,z+.08,1.9,.45,1.35,m.petrol,true);for(const dx of [-.8,.8]){box(staticRoot,x+dx,.79,z,.31,.4,1.68,m.rubber,true);for(let k=0;k<5;k++){const w=cyl(staticRoot,x+dx,.78,z-.63+k*.32,.18,.32,m.darkSteel);w.rotation.z=Math.PI/2;}}
  box(staticRoot,x+.45,1.48,z+.12,.73,.7,.9,m.teal,true);box(staticRoot,x+.45,1.56,z+.585,.55,.36,.027,m.glass);motor(staticRoot,x-.5,1.36,z+.3);
  beam(staticRoot,new THREE.Vector3(x-.25,1.35,z),new THREE.Vector3(x-.25,2.22,z-1.15),.21,m.gold);tube(staticRoot,[[x+.03,1.3,z+.2],[x+.03,1.9,z-.4],[x+.03,2.1,z-1.1]],.052,m.darkSteel);
  const wheel=mechanism('mine','drill',-.25,2.16,-1.13);gear(wheel,0,0,0,.69,m.gold,12);const hub=cyl(wheel,0,0,.05,.19,.25,m.steel);hub.rotation.x=Math.PI/2;for(let i=0;i<8;i++){const a=i/8*Math.PI*2;const bucket=box(wheel,Math.cos(a)*.64,Math.sin(a)*.64,.17,.23,.2,.27,m.darkSteel,true);bucket.rotation.z=a;}batch(wheel);
 }
 staticRoot=stationGroups.crusher;
 // Crusher: funnel, twin counter-rotating toothed rollers and an exposed flywheel drive.
 {const [x,z]=P.crusher;box(staticRoot,x,1.12,z,2.1,.72,1.5,m.petrol,true);bolts(staticRoot,x,1.15,z+.79,1.7,.4);motor(staticRoot,x-1.05,1.25,z+.16);
  const hopper=mesh(staticRoot,own(new THREE.CylinderGeometry(1.03,.49,.92,4,1,true)),m.darkSteel,x,2.05,z,1,1,.8);hopper.rotation.y=Math.PI/4;
  box(staticRoot,x,2.52,z-.02,1.62,.12,1.35,m.gold);box(staticRoot,x,2.58,z-.02,1.38,.015,1.1,m.rubber);
  for(const dx of [-.42,.42]){const roller=mechanism('crusher','roller',dx,1.76,.2);const body=cyl(roller,0,0,0,.28,1.12,m.steel);body.rotation.x=Math.PI/2;for(let i=0;i<8;i++){const a=i/8*Math.PI*2;const tooth=box(roller,Math.cos(a)*.28,Math.sin(a)*.28,0,.095,.13,1.04,m.gold);tooth.rotation.z=a;}batch(roller);}
  const wheel=mechanism('crusher','gear',1.17,1.3,.93);gear(wheel,0,0,0,.53,m.gold);batch(wheel);cyl(staticRoot,x+1.17,1.03,z+.5,.12,.7,m.darkSteel);
 }
 staticRoot=stationGroups.sorter;
 // Sorter: a visibly open rotating trommel with concentric bands and collection trays.
 {const [x,z]=P.sorter;for(const dx of [-.95,.95]){box(staticRoot,x+dx,1.15,z,.19,1.1,1.8,m.teal);beam(staticRoot,new THREE.Vector3(x+dx,.7,z-.8),new THREE.Vector3(x+dx,1.8,z+.7),.1,m.darkSteel);}
  const drum=mechanism('sorter','drum',0,1.62,0);for(const dz of [-.82,-.35,.35,.82]){const ring=mesh(drum,own(new THREE.TorusGeometry(.72,.055,6,24)),m.steel,0,0,dz);ring.rotation.z=.2;}
  for(let i=0;i<14;i++){const a=i/14*Math.PI*2;box(drum,Math.cos(a)*.71,Math.sin(a)*.71,0,.046,.046,1.72,m.gold);}batch(drum);
  for(const dx of [-.45,.45]){box(staticRoot,x+dx,.93,z+.5,.74,.15,1.48,m.darkSteel);box(staticRoot,x+dx,1.07,z+1.12,.75,.15,.08,m.steel);}motor(staticRoot,x+1.2,1.12,z-.6);
 }
 staticRoot=stationGroups.smelter;
 // Smelter: refractory shell, orange throat, flanged pipework and a service stair.
 {const [x,z]=P.smelter;cyl(staticRoot,x,1.5,z,.93,1.72,m.darkSteel);cyl(staticRoot,x,2.4,z,.98,.15,m.copper);cyl(staticRoot,x,2.6,z,.7,.3,m.petrol);cyl(staticRoot,x,2.83,z,.45,.22,m.rubber);
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;cyl(staticRoot,x+Math.cos(a)*.94,1.6,z+Math.sin(a)*.94,.042,1.4,m.edge);}
  box(staticRoot,x,1.43,z+.89,1.22,.97,.18,m.rubber,true);box(staticRoot,x,1.43,z+1.0,.94,.68,.07,m.hot,true);for(const dx of [-.33,0,.33])box(staticRoot,x+dx,1.43,z+1.05,.055,.7,.07,m.darkSteel);
  cyl(staticRoot,x+1.25,2.38,z-.65,.27,3.36,m.darkSteel);cyl(staticRoot,x+1.25,4.1,z-.65,.38,.13,m.copper);
  tube(staticRoot,[[x-.72,1.8,z-.3],[x-1.25,1.8,z-.3],[x-1.38,1.45,z-.3],[x-1.38,.9,z+.45]],.14,m.copper);for(let i=0;i<5;i++)box(staticRoot,x-1.47,.76+i*.15,z+.8-i*.27,.65,.13,.28,m.edge);
 }
 staticRoot=stationGroups.press;
 // Forming press: heavy portal frame, chromed hydraulic rods and a mechanically driven die.
 {const [x,z]=P.press;box(staticRoot,x,.96,z,2.3,.42,1.8,m.darkSteel,true);for(const dx of [-.93,.93]){box(staticRoot,x+dx,1.92,z,.3,2.15,1.05,m.petrol,true);cyl(staticRoot,x+dx*.68,1.86,z+.22,.08,1.96,m.steel);}box(staticRoot,x,3.04,z,2.35,.52,1.22,m.teal,true);box(staticRoot,x,3.36,z,1.32,.15,.93,m.gold);cyl(staticRoot,x,3.65,z,.32,.56,m.darkSteel);
  const ram=mechanism('press','ram',0,0,0);cyl(ram,0,2.35,0,.19,1.1,m.steel);box(ram,0,1.93,0,1.26,.32,1.01,m.gold,true);for(let i=0;i<5;i++){const stripe=box(ram,-.5+i*.25,1.93,.515,.12,.31,.02,m.rubber);stripe.rotation.z=-.35;}batch(ram);
  box(staticRoot,x,1.21,z,1.25,.17,1.04,m.steel);const wheel=mechanism('press','gear',1.35,2.11,.62);gear(wheel,0,0,0,.63,m.copper,18);batch(wheel);tube(staticRoot,[[x,3.65,z-.2],[x+.75,3.65,z-.5],[x+1.25,3.1,z-.5],[x+1.25,1.1,z-.5]],.055,m.rubber);
 }
 staticRoot=stationGroups.packer;
 // Packing cell: articulated pick-and-place arm, driven belt and banding arch.
 {const [x,z]=P.packer;box(staticRoot,x,1.0,z,2.24,.48,1.72,m.teal,true);for(const dx of [-.9,.9])box(staticRoot,x+dx,1.8,z+.52,.11,1.55,.13,m.gold);box(staticRoot,x,2.54,z+.52,1.91,.16,.19,m.gold,true);box(staticRoot,x,2.42,z+.52,.52,.16,.42,m.darkSteel,true);
  cyl(staticRoot,x-.88,1.5,z-.52,.34,.72,m.darkSteel);const arm=mechanism('packer','arm',-.88,1.82,-.52);beam(arm,new THREE.Vector3(0,0,0),new THREE.Vector3(.65,.72,.35),.18,m.gold);beam(arm,new THREE.Vector3(.65,.72,.35),new THREE.Vector3(1.02,.2,.88),.14,m.teal);mesh(arm,geo.ball,m.steel,.65,.72,.35,.17,.17,.17);cyl(arm,1.02,.1,.88,.13,.24,m.darkSteel);for(const dx of [-.16,.16])box(arm,1.02+dx,-.05,.88,.055,.24,.12,m.steel);tube(arm,[[0,.12,0],[.46,.84,.2],[.72,.84,.35],[1.13,.26,.82]],.034,m.rubber);batch(arm);
  box(staticRoot,x+1.43,1.1,z-.5,.64,.86,.65,m.wood,true);box(staticRoot,x+1.43,1.55,z-.5,.14,.025,.7,m.white);
 }
 staticRoot=stationGroups.shipping;
 // Dispatch: overhead gantry, moving hoist and an assembled little delivery truck.
 {const [x,z]=P.shipping;for(const dx of [-1.47,1.47]){box(staticRoot,x+dx,2.05,z,.19,2.8,.22,m.gold);beam(staticRoot,new THREE.Vector3(x+dx,.68,z-.63),new THREE.Vector3(x+dx,1.45,z),.11,m.darkSteel);}box(staticRoot,x,3.51,z,3.2,.25,.33,m.gold,true);box(staticRoot,x,3.7,z,3.33,.12,.45,m.darkSteel);
  box(staticRoot,x-.43,3.36,z-.42,.68,.21,.47,m.teal,true);box(staticRoot,x,3.5,z-.2,3.2,.15,.85,m.darkSteel);
  box(staticRoot,x,.96,z,1.8,.17,1.55,m.edge,true);
  const hook=mechanism('shipping','hook',-.43,0,-.42);const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,.18,0),new THREE.Vector3(-.1,.03,0),new THREE.Vector3(.03,-.08,0),new THREE.Vector3(.13,.02,0)]);mesh(hook,own(new THREE.TubeGeometry(curve,12,.045,6,false)),m.steel,0,0,0);batch(hook);
  const cable=mechanism('shipping','cable',-.43,0,-.42);cyl(cable,0,0,0,.024,1,m.rubber);batch(cable);

  const tx=x+1.4,tz=z+1.6;box(staticRoot,tx,.85,tz,2.8,.22,1.08,m.darkSteel,true);box(staticRoot,tx-1.03,1.36,tz,.84,.83,1.09,m.teal,true);box(staticRoot,tx-1.03,1.56,tz+.559,.63,.34,.02,m.glass);box(staticRoot,tx+.38,1.08,tz,1.77,.12,1.14,m.edge);for(const zz of [tz-.57,tz+.57]){for(const xx of [tx-.95,tx+.93]){const tire=cyl(staticRoot,xx,.63,zz,.29,.18,m.rubber);tire.rotation.x=Math.PI/2;const hub=cyl(staticRoot,xx,.63,zz+(zz>tz?.1:-.1),.13,.035,m.steel);hub.rotation.x=Math.PI/2;}}
  box(staticRoot,tx-1.46,1.16,tz+.36,.025,.14,.22,m.lamp);box(staticRoot,tx-1.46,1.16,tz-.36,.025,.14,.22,m.lamp);
 }
 // Equipment-specific auxiliary capacity physically appears with each purchased level.
 const extras=Object.fromEntries(STATIONS.map(s=>{const g=new THREE.Group();root.add(g);return [s,g];})) as Record<Station,THREE.Group>;
 function setLevel(station:Station,level:number){const g=extras[station];g.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();geometries.delete(o.geometry);}});g.clear();const [x,z]=P[station];for(let i=1;i<level;i++){const dx=(i%2?1:-1)*(1.75+Math.floor((i-1)/2)*.4),dz=-.6+Math.floor((i-1)/2)*.7;
  box(g,x+dx,.78,z+dz,.6,.25,.64,m.darkSteel,true);
  if(station==='smelter'||station==='sorter'){cyl(g,x+dx,1.27,z+dz,.26,.75,station==='smelter'?m.copper:m.petrol);cyl(g,x+dx,1.69,z+dz,.29,.1,m.steel);tube(g,[[x+dx,1,z+dz],[x+dx*.6,1,z+dz]],.065,m.copper);}
  else if(station==='shipping'||station==='packer'){box(g,x+dx,1.05,z+dz,.5,.38,.54,m.wood,true);box(g,x+dx,1.25,z+dz,.09,.018,.57,m.white);}
  else {box(g,x+dx,1.2,z+dz,.48,.65,.55,m.teal,true);cyl(g,x+dx,1.66,z+dz,.12,.28,m.steel);box(g,x+dx,1.42,z+dz+.28,.28,.065,.018,m.lamp);}
 }batch(g);}
 batch(infrastructure);for(const group of Object.values(stationGroups))batch(group);
 // The selection accent is architectural light, never a floating station label.
 const ringMat=new THREE.MeshBasicMaterial({color:'#a3e9c5',transparent:true,opacity:.45});materials.add(ringMat);
 const ring=mesh(root,own(new THREE.TorusGeometry(2.08,.022,4,64)),ringMat,0,.7,0);ring.rotation.x=-Math.PI/2;ring.visible=false;ring.castShadow=false;
 return {root,materials,geometries,mechanisms,stationGroups,extras,setLevel,ring,palette:m,batch,own};
}
