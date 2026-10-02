import {expect,it} from 'vitest';
import {Raycaster,Vector3,DoubleSide,Mesh} from 'three';
import {createFactoryModel} from '../src/machinery';
import {STATION_POSITIONS} from '../src/layout';
it.each(['crusher','smelter'] as const)('opens the %s working bay to the fixed oblique camera',station=>{
 const model=createFactoryModel();model.root.updateMatrixWorld(true);const [x,z]=STATION_POSITIONS[station],point=new Vector3(x,1.5,z),direction=new Vector3(15,33.3,43).normalize(),ray=new Raycaster(point.clone().addScaledVector(direction,12),direction.clone().negate());
 const hits=ray.intersectObject(model.stationGroups[station],true).filter(hit=>hit.distance<11.7);
 expect(hits.map(hit=>hit.distance)).toEqual([]);model.geometries.forEach(g=>g.dispose());model.materials.forEach(m=>m.dispose());
});
it('retains opaque housings rather than making the whole factory transparent',()=>{const model=createFactoryModel();for(const name of ['petrol','darkSteel','teal'] as const)expect(model.palette[name].transparent).toBe(false);model.geometries.forEach(g=>g.dispose());model.materials.forEach(m=>m.dispose());});
