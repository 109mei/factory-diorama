import './style.css';
import {buyUpgrade,isStationUnlocked,nextUnlock,unlockNext,type Station} from './simulation';
import {loadGame,saveGame,SAVE_KEY} from './save';
import {createScene} from './scene';
import {restoreGame} from './storage';
import {createLifecycle} from './lifecycle';
import {createUI,STATION_INFO} from './ui';
import {createFactoryAudio,readAudioPreferenceState,serializeAudioPreferences,AUDIO_STORAGE_KEY,DEFAULT_AUDIO_PREFERENCES,type AudioIntent} from './audio';

const world=document.querySelector<HTMLElement>('#world')!,hud=document.querySelector<HTMLElement>('#hud')!;
let loaded:ReturnType<typeof restoreGame>;
try{loaded=restoreGame(localStorage,Date.now());}catch{loaded={...loadGame(null,Date.now()),storageAvailable:false,usedLegacy:false};}
let storageAvailable=loaded.storageAvailable;
const state=loaded.state,lifecycle=createLifecycle(state);
if(document.hidden)lifecycle.hide(Date.now());
let scene:ReturnType<typeof createScene>|null=null,audio:ReturnType<typeof createFactoryAudio>|null=null,rendererPaused=true;
let audioIntent:AudioIntent='default',soundPromptSeen=false;
let preferenceTimer:ReturnType<typeof setTimeout>|undefined;
const ui=createUI(hud,()=>state,station=>{
 const opening=!isStationUnlocked(state,station)&&nextUnlock(state)===station;
 const success=opening?unlockNext(state):buyUpgrade(state,station);
 if(success){ui.notify(opening?`${STATION_INFO[station].name}が稼働！ 新しい製品をつくろう`:`${STATION_INFO[station].name}を増設！ Lv.${state.levels[station]}`);scene?.focusStation(station,true);persist();}
},{toggle:toggleSound,volume:value=>{audio?.setVolume(value);clearTimeout(preferenceTimer);preferenceTimer=setTimeout(saveSoundPreferences,150);}});
function persist(){
 try{localStorage.setItem(SAVE_KEY,saveGame(state,lifecycle.saveTimestamp(Date.now())));storageAvailable=true;ui.setSaveStatus('✓ この端末に保存済み');}
 catch{storageAvailable=false;ui.setSaveStatus('保存できません・ブラウザ設定を確認');}
}
function saveSoundPreferences(){
 clearTimeout(preferenceTimer);preferenceTimer=undefined;if(!audio)return;
 try{localStorage.setItem(AUDIO_STORAGE_KEY,serializeAudioPreferences(audio.getPreferences(),{intent:audioIntent,promptSeen:soundPromptSeen}));}
 catch{ui.notify('サウンド設定を保存できません。この画面では設定を使えます。');}
}
function toggleSound(){
 if(!audio)return;
 if(audio.getState().status==='running'){audioIntent='explicit';void audio.setEnabled(false);saveSoundPreferences();return;}
 if(!scene||rendererPaused){ui.notify('3D表示が停止しています。サウンド設定は保ったまま、表示の再開を待ちます。');return;}
 audioIntent='explicit';
 // This call stays directly in the user's click handler, before any await.
 void audio.enableFromGesture().then(started=>{saveSoundPreferences();if(!started&&audio?.getState().status==='unavailable')ui.notify('このブラウザでは音声を開始できませんでした。');});
}
function syncSoundVisibility(){audio?.setHidden(document.hidden||!scene||rendererPaused);}
try{scene=createScene(world);rendererPaused=false;}
catch(error){
 ui.setRuntimeStatus(false);world.setAttribute('aria-label','3D表示を開始できませんでした');
 world.innerHTML='<div class="renderer-error"><b>3D表示を開始できませんでした</b><span>WebGL対応のブラウザで開き直してください。保存された進行は維持されます。</span><button type="button" id="reload-renderer">もう一度試す</button></div>';
 document.querySelector('#reload-renderer')?.addEventListener('click',()=>location.reload());console.error('WebGL initialization failed',error);
}
let preferences={...DEFAULT_AUDIO_PREFERENCES};
try{const stored=readAudioPreferenceState(localStorage);preferences=stored.preferences;audioIntent=stored.intent;soundPromptSeen=stored.promptSeen;}catch{/* A denied Storage getter keeps the safe defaults. */}
audio=createFactoryAudio(preferences,soundState=>ui.setSoundState(soundState));ui.setSoundState(audio.getState());syncSoundVisibility();
const soundGestureEvents=['pointerup','touchend','click','keydown'] as const;
function removeSoundGestures(){for(const type of soundGestureEvents)document.removeEventListener(type,firstSoundGesture);}
function firstSoundGesture(event:Event){
 if(event instanceof KeyboardEvent&&!['Enter',' '].includes(event.key))return;
 if(event.target instanceof Element&&event.target.closest('[data-sound]'))return;
 if(navigator.userActivation?.isActive===false)return;
 if(audio?.getPreferences().enabled&&scene&&!rendererPaused){
  // Keep listeners until a real resume succeeds. A rejected or pending attempt
  // must not consume the next touch-end/click opportunity on iOS.
  void audio.enableFromGesture().then(started=>{if(started)removeSoundGestures();});
 }
}
for(const type of soundGestureEvents)document.addEventListener(type,firstSoundGesture);
world.addEventListener('webglcontextlost',()=>{rendererPaused=true;syncSoundVisibility();},true);
world.addEventListener('webglcontextrestored',()=>{rendererPaused=false;syncSoundVisibility();},true);
if(loaded.offlineEarned>0)ui.notify(`おかえりなさい！ 留守中に +${loaded.offlineEarned.toLocaleString('ja-JP')} C${loaded.awaySeconds>=1800?'（30分ぶん）':''}`);
else if(loaded.migrated)ui.notify('工場が新しくなりました。資金と設備を引き継ぎました');
else if(loaded.recovered)ui.notify('保存データを読み込めなかったため、新しい工場で開始しました');
else if(!storageAvailable)ui.notify('自動保存を利用できません。この画面を閉じると進行が失われる場合があります');
if(audioIntent==='legacy-off'&&!soundPromptSeen){ui.notify('以前の音声OFF設定を維持しています。♪を押すと音が始まります。');soundPromptSeen=true;saveSoundPreferences();}
if(scene)persist();
world.addEventListener('world-station-select',event=>ui.select((event as CustomEvent<Station>).detail));
hud.addEventListener('station-select',event=>scene?.focusStation((event as CustomEvent<Station>).detail));
let previous=performance.now(),elapsed=0,uiTimer=0,saveTimer=0;
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){lifecycle.hide(Date.now());persist();}
 else{const result=lifecycle.resume(Date.now());previous=performance.now();persist();ui.update();if(result.earned>0)ui.notify(`留守中の出荷 +${result.earned.toLocaleString('ja-JP')} C`);}
 syncSoundVisibility();
});
window.addEventListener('pagehide',(event:PageTransitionEvent)=>{
 persist();saveSoundPreferences();
 if(event.persisted)audio?.setHidden(true);
 else{audio?.dispose();removeSoundGestures();}
});
window.addEventListener('pageshow',(event:PageTransitionEvent)=>{if(event.persisted)syncSoundVisibility();});
function frame(now:number){
 requestAnimationFrame(frame);if(document.hidden||!scene){previous=now;return;}
 const dt=Math.max(0,(now-previous)/1000);previous=now;elapsed+=dt;
 lifecycle.advance(dt);scene.update(state,elapsed);audio?.update(state,dt);
 uiTimer+=dt;saveTimer+=dt;if(uiTimer>=.1){ui.update();uiTimer=0;}if(saveTimer>=5){persist();saveTimer=0;}
}
requestAnimationFrame(frame);
// Read-only development diagnostics. No production-state mutation shortcuts.
if(import.meta.env.DEV)Object.defineProperty(window,'__factory',{value:{snapshot:()=>structuredClone(state),metrics:()=>scene?.metrics(),storageAvailable:()=>storageAvailable},configurable:true});
