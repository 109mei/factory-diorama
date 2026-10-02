import {STATIONS,STAGE_SECONDS,type Item,type GameState} from './simulation';
export interface ProcessingVisual {kind:number;surface:number;scaleY:number;x:number;z:number;openBox:boolean;}
/** A view of one real unit's work cycle. No inventory, value or timing mutation. */
export function processingVisual(item:Item,state:GameState,reduced=false):ProcessingVisual|null {
 if(item.stage%2===0||item.stage===11)return null;
 const station=STATIONS[(item.stage+1)/2],slot=state.items.filter(i=>i.stage===item.stage).indexOf(item);
 if(slot<0||slot>=state.levels[station])return null;
 const p=Math.min(1,item.progress+state.accumulator/STAGE_SECONDS[item.stage]);
 const pose:ProcessingVisual={kind:item.quality,surface:1.22,scaleY:1,x:(slot%3-1)*.48,z:-.28+Math.floor(slot/3)*.56,openBox:false};
 if(item.stage===1){pose.surface=2.04;pose.kind=p>=.62?1:item.quality;pose.scaleY=p<.62?1-.45*Math.sin(p/.62*Math.PI/2):1;}
 if(item.stage===3){pose.surface=1.22+(reduced?0:Math.sin(p*Math.PI*6)*.035);pose.kind=p>=.65?2:item.quality;pose.z+=p*.12;}
 if(item.stage===5){pose.surface=1.16;pose.kind=p<.28?item.quality:p<.72?6:3;pose.scaleY=p<.28?1-p/.28*.7:1;pose.z+=p*.2;}
 if(item.stage===7){pose.surface=1.3;pose.kind=p>=.6?4:item.quality;pose.scaleY=p<.6?1-.32*Math.sin(p/.6*Math.PI/2):1;}
 if(item.stage===9){pose.surface=1.25;pose.kind=p>=.78?5:item.quality;pose.openBox=p>=.32&&p<.78;if(pose.openBox)pose.surface=1.28;}
 return pose;
}
