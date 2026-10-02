import {OrthographicCamera,Plane,Raycaster,Vector2,Vector3} from 'three';
export const PAN_HOLD_MS=280,PAN_SLOP=8;
/** Pointer capture keeps one uninterrupted hold/drag, including outside the canvas. */
export function attachCameraPan(canvas:HTMLElement,callbacks:{move:(x:number,y:number)=>void;tap:(x:number,y:number)=>void;start:()=>void}){
 const pointers=new Set<number>();let pointer:number|null=null,originX=0,originY=0,lastX=0,lastY=0,panning=false,blocked=false,disposed=false;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const clear=()=>{clearTimeout(timer);timer=undefined;panning=false;pointer=null;canvas.classList.remove('is-panning');};
 function cancel(){clear();blocked=pointers.size>0;}
 function down(e:PointerEvent){
  if(disposed||e.button!==0)return;pointers.add(e.pointerId);
  if(pointers.size>1||blocked){cancel();return;}
  pointer=e.pointerId;originX=lastX=e.clientX;originY=lastY=e.clientY;
  try{canvas.setPointerCapture(e.pointerId);}catch{/* Old browsers still support an in-canvas drag. */}
  timer=setTimeout(()=>{timer=undefined;if(pointer===e.pointerId&&!blocked){panning=true;callbacks.start();canvas.classList.add('is-panning');}},PAN_HOLD_MS);
 }
 function move(e:PointerEvent){
  if(e.pointerId!==pointer||blocked)return;
  if(!panning){if(Math.hypot(e.clientX-originX,e.clientY-originY)>PAN_SLOP)cancel();return;}
  e.preventDefault();callbacks.move(e.clientX-lastX,e.clientY-lastY);lastX=e.clientX;lastY=e.clientY;
 }
 function finish(e:PointerEvent){
  const tap=e.type==='pointerup'&&pointer===e.pointerId&&!panning&&!blocked&&Math.hypot(e.clientX-originX,e.clientY-originY)<=PAN_SLOP;
  pointers.delete(e.pointerId);if(pointer===e.pointerId)clear();if(pointers.size===0)blocked=false;
  try{if(canvas.hasPointerCapture?.(e.pointerId))canvas.releasePointerCapture(e.pointerId);}catch{/* Capture may already be gone after cancellation. */}
  if(tap)callbacks.tap(e.clientX,e.clientY);
 }
 const lost=(e:PointerEvent)=>{if(pointer===e.pointerId)cancel();pointers.delete(e.pointerId);if(pointers.size===0)blocked=false;};
 const reset=()=>{cancel();pointers.clear();blocked=false;};
 const hidden=()=>{if(document.hidden)reset();};
 const menu=(e:Event)=>e.preventDefault();
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);canvas.addEventListener('lostpointercapture',lost);canvas.addEventListener('contextmenu',menu);
 window.addEventListener('blur',reset);document.addEventListener('visibilitychange',hidden);
 return {active:()=>panning,cancel,dispose(){disposed=true;reset();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',finish);canvas.removeEventListener('pointercancel',finish);canvas.removeEventListener('lostpointercapture',lost);canvas.removeEventListener('contextmenu',menu);window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',hidden);}};
}
const plane=new Plane(new Vector3(0,1,0),-1.05);
export function groundPoint(camera:OrthographicCamera,nx:number,ny:number):Vector3|null {camera.updateMatrixWorld();const ray=new Raycaster();ray.setFromCamera(new Vector2(nx,ny),camera);return ray.ray.intersectPlane(plane,new Vector3());}
export function groundPanDelta(camera:OrthographicCamera,dx:number,dy:number,width:number,height:number):[number,number]{
 if(width<=0||height<=0)return [0,0];const a=groundPoint(camera,0,0),b=groundPoint(camera,dx/width*2,-dy/height*2);return a&&b?[a.x-b.x,a.z-b.z]:[0,0];
}
export function clampPan(x:number,z:number):[number,number]{return [Math.max(-6,Math.min(6,x)),Math.max(-18,Math.min(18,z))];}
