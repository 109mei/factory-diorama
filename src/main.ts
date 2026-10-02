import './style.css';
import {buyUpgrade,isStationUnlocked,nextUnlock,unlockNext,type Station} from './simulation';
import {loadGame,saveGame,SAVE_KEY} from './save';
import {createScene} from './scene';
import {restoreGame} from './storage';
import {createLifecycle} from './lifecycle';
import {createUI,STATION_INFO} from './ui';
const world=document.querySelector<HTMLElement>('#world')!,hud=document.querySelector<HTMLElement>('#hud')!;
let loaded:ReturnType<typeof restoreGame>;
try{loaded=restoreGame(localStorage,Date.now());}catch{loaded={...loadGame(null,Date.now()),storageAvailable:false,usedLegacy:false};}
let storageAvailable=loaded.storageAvailable;const state=loaded.state;const lifecycle=createLifecycle(state);if(document.hidden)lifecycle.hide(Date.now());
let scene:ReturnType<typeof createScene>|null=null;
const ui=createUI(hud,()=>state,(station:Station)=>{const opening=!isStationUnlocked(state,station)&&nextUnlock(state)===station;const success=opening?unlockNext(state):buyUpgrade(state,station);if(success){ui.notify(opening?`${STATION_INFO[station].name}が稼働！ 新しい製品をつくろう`:`${STATION_INFO[station].name}を増設！ Lv.${state.levels[station]}`);scene?.focusStation(station,true);persist();}});
function persist(){try{localStorage.setItem(SAVE_KEY,saveGame(state,lifecycle.saveTimestamp(Date.now())));storageAvailable=true;ui.setSaveStatus('✓ この端末に保存済み');}catch{storageAvailable=false;ui.setSaveStatus('保存できません・ブラウザ設定を確認');}}
try{scene=createScene(world);}catch(error){ui.setRuntimeStatus(false);world.setAttribute('aria-label','3D表示を開始できませんでした');world.innerHTML='<div class="renderer-error"><b>3D表示を開始できませんでした</b><span>WebGL対応のブラウザで開き直してください。保存された進行は維持されます。</span><button type="button" id="reload-renderer">もう一度試す</button></div>';document.querySelector('#reload-renderer')?.addEventListener('click',()=>location.reload());console.error('WebGL initialization failed',error);}
if(loaded.offlineEarned>0)ui.notify(`おかえりなさい！ 留守中に +${loaded.offlineEarned.toLocaleString('ja-JP')} C${loaded.awaySeconds>=1800?'（30分ぶん）':''}`);
else if(loaded.migrated)ui.notify('工場が新しくなりました。資金と設備を引き継ぎました');
else if(loaded.recovered)ui.notify('保存データを読み込めなかったため、新しい工場で開始しました');
else if(!storageAvailable)ui.notify('自動保存を利用できません。この画面を閉じると進行が失われる場合があります');
if(scene)persist();
hud.addEventListener('station-select',event=>scene?.focusStation((event as CustomEvent<Station>).detail));
let previous=performance.now(),elapsed=0,uiTimer=0,saveTimer=0;
const visibility=()=>{if(document.hidden){lifecycle.hide(Date.now());persist();}else{const result=lifecycle.resume(Date.now());previous=performance.now();persist();ui.update();if(result.earned>0)ui.notify(`留守中の出荷 +${result.earned.toLocaleString('ja-JP')} C`);}};
document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',persist);
function frame(now:number){requestAnimationFrame(frame);if(document.hidden||!scene){previous=now;return;}const dt=Math.max(0,(now-previous)/1000);previous=now;elapsed+=dt;lifecycle.advance(dt);scene.update(state,elapsed);uiTimer+=dt;saveTimer+=dt;if(uiTimer>=.1){ui.update();uiTimer=0;}if(saveTimer>=5){persist();saveTimer=0;}}
requestAnimationFrame(frame);
// Read-only development diagnostics. No mutation or shortcuts in the shipped game.
if(import.meta.env.DEV){Object.defineProperty(window,'__factory',{value:{snapshot:()=>structuredClone(state),metrics:()=>scene?.metrics(),storageAvailable:()=>storageAvailable},configurable:true});}
