export function damp(current:number,target:number,speed:number,dt:number):number{
 if(!Number.isFinite(dt)||dt<=0)return current;
 return target+(current-target)*Math.exp(-speed*dt);
}
export interface CameraMotion{x:number;z:number;zoom:number;targetX:number;targetZ:number;targetZoom:number;}
export function createCameraMotion():CameraMotion{return {x:0,z:0,zoom:1,targetX:0,targetZ:0,targetZoom:1};}
export function focusCamera(camera:CameraMotion,x:number,z:number,zoom:number):void{camera.targetX=x;camera.targetZ=z;camera.targetZoom=zoom;}
export function advanceCamera(camera:CameraMotion,dt:number,reduced:boolean):void{
 if(reduced){camera.x=camera.targetX;camera.z=camera.targetZ;camera.zoom=camera.targetZoom;return;}
 camera.x=damp(camera.x,camera.targetX,4,dt);camera.z=damp(camera.z,camera.targetZ,4,dt);camera.zoom=damp(camera.zoom,camera.targetZoom,4,dt);
}
