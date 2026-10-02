import {STATIONS,MAX_LEVEL,stationStats,upgradeCost,type GameState,type Station} from './simulation';
export const STATION_INFO:Record<Station,{name:string;short:string;en:string;description:string;icon:string}>={
 mine:{name:'採掘場',short:'採掘',en:'EXTRACT',description:'鉱脈から鉱石を掘り出す。採掘機を増設すると、運ばれる鉱石が増える。',icon:'⛏'},
 smelter:{name:'製錬炉',short:'製錬',en:'SMELT',description:'鉱石を熱で溶かしてインゴットへ。炉を増設して、鉱石の滞留を解消しよう。',icon:'♨'},
 press:{name:'加工プレス',short:'加工',en:'PRESS',description:'インゴットを精密部品へ。プレスを増設すると同時に加工できる数が増える。',icon:'⚙'},
 shipping:{name:'出荷ドック',short:'出荷',en:'SHIP',description:'完成した部品を出荷。1個につき5クレジット。ドックの増設で出荷を速く。',icon:'↗'}
};
const n=(v:number)=>v.toLocaleString('ja-JP');
export function createUI(host:HTMLElement,getState:()=>GameState,onUpgrade:(station:Station)=>void){
 let selected:Station='mine',toastTimeout:ReturnType<typeof setTimeout>;
 host.innerHTML=`
 <header class="topbar"><div class="brand"><span class="brand-mark" aria-hidden="true">◈</span><div><span class="eyebrow">MINE LINE / 01</span><h1>鉱脈ライン</h1></div></div><div class="wallet"><span class="coin" aria-hidden="true">C</span><strong data-credits>0</strong><small>クレジット</small></div><button class="icon-button help-button" data-help aria-label="遊び方を開く">?</button></header>
 <div class="objective"><span class="objective-dot"></span><span data-goal>まずは20 C。採掘場を増設しよう</span><span class="goal-fraction" data-goal-progress>0 / 20</span><div class="goal-track"><i data-goal-bar></i></div></div>
 <div class="world-caption"><span class="live-dot"></span> 生産ライン稼働中 <span data-line-count>0個を搬送中</span></div>
 <section class="control-deck" aria-label="工場設備の管理"><nav class="station-tabs" aria-label="設備を選ぶ">${STATIONS.map((s,i)=>`<button data-station="${s}" class="station-tab" aria-pressed="${i===0}"><span class="tab-index">0${i+1}</span><span class="tab-icon" aria-hidden="true">${STATION_INFO[s].icon}</span><span>${STATION_INFO[s].short}</span><small data-level="${s}">Lv.1</small></button>`).join('')}</nav>
 <div class="machine-detail"><div class="detail-heading"><div><span class="eyebrow" data-detail-en>01 / EXTRACT</span><h2 data-detail-name>採掘場</h2></div><div class="level-pill" data-detail-level>LEVEL 01</div></div>
 <div class="machine-stats"><span><i class="mint-dot"></i><b data-rate>18.8</b> 個/分</span><span data-queue>滞留 0個</span><span data-capacity>稼働 1基</span></div>
 <button class="upgrade-button" data-upgrade><span><span class="upgrade-plus">＋</span> <b data-upgrade-label>採掘機を増設</b><small data-upgrade-hint>生産能力 ×2</small></span><strong data-cost>20 <small>C</small></strong></button>
 <div class="bottom-status"><span data-saved>端末に自動保存</span><span>累計出荷 <b data-shipped>0</b> 個</span></div></div></section>
 <div class="toast" role="status" aria-live="polite" hidden></div>
 <div class="help-overlay" data-help-panel hidden><section class="help-panel" role="dialog" aria-modal="true" aria-labelledby="help-title"><button class="icon-button close-help" data-help-close aria-label="遊び方を閉じる">×</button><span class="eyebrow">A SMALL FACTORY, A BIG LITTLE WORLD</span><h2 id="help-title">眺めて、育てる。</h2><p>鉱石が運ばれ、形を変え、クレジットになる。<br>あなたの小さな工場は、自動で動き続けます。</p><ol><li><b>まずは出荷を待とう</b><span>鉱石 → インゴット → 部品。1個の出荷で5 C。</span></li><li><b>設備を選んで増設</b><span>下の4つのタブ、または工場のラベルをタップ。</span></li><li><b>滞留を見つけよう</b><span>待ち行列のある設備を増やすと、流れがスムーズに。</span></li></ol><p class="help-note">各設備は最大6基。自動保存はこのブラウザ内だけです。<br>離れている間も、最大30分ぶん生産が進みます。<br>ブラウザのデータを消すと進行も消えます。</p><button class="help-done" data-help-close>工場へ戻る →</button></section></div>`;
 const $=<T extends HTMLElement=HTMLElement>(q:string)=>host.querySelector<T>(q)!;
 const fields={credits:$('[data-credits]'),goal:$('[data-goal]'),goalProgress:$('[data-goal-progress]'),goalBar:$('[data-goal-bar]'),lineCount:$('[data-line-count]'),detailEn:$('[data-detail-en]'),detailName:$('[data-detail-name]'),detailLevel:$('[data-detail-level]'),rate:$('[data-rate]'),queue:$('[data-queue]'),capacity:$('[data-capacity]'),upgrade:$<HTMLButtonElement>('[data-upgrade]'),upgradeLabel:$('[data-upgrade-label]'),upgradeHint:$('[data-upgrade-hint]'),cost:$('[data-cost]'),shipped:$('[data-shipped]')};
 function update(){
  const s=getState(),info=STATION_INFO[selected],stats=stationStats(s,selected),level=s.levels[selected],cost=upgradeCost(s,selected),max=level>=MAX_LEVEL,total=STATIONS.reduce((v,k)=>v+s.levels[k]-1,0);
  fields.credits.textContent=n(s.credits);fields.shipped.textContent=n(s.shipped);fields.lineCount.textContent=`${s.items.length}個を生産中`;
  const allMax=total===20;
  fields.goal.textContent=total===0?'まずは20 C。採掘場を増設しよう':allMax?'全設備が最大稼働。あなたの工場が完成！':total<4?'4つの設備を増やして、流れを育てよう':'工場を拡張しよう。滞留している設備に注目';
  const progress=total===0?Math.min(20,s.credits):total<4?STATIONS.filter(k=>s.levels[k]>1).length:total;
  const target=total===0?20:total<4?4:20;
  fields.goalProgress.textContent=`${n(progress)} / ${target}`;fields.goalBar.style.width=`${progress/target*100}%`;
  fields.detailEn.textContent=`0${STATIONS.indexOf(selected)+1} / ${info.en}`;fields.detailName.textContent=info.name;fields.detailLevel.textContent=`LEVEL 0${level}`;
  fields.rate.textContent=stats.perMinute.toFixed(1);fields.queue.textContent=`滞留 ${stats.queued}個`;fields.queue.classList.toggle('has-queue',stats.queued>0);fields.capacity.textContent=`稼働 ${level}基`;
  fields.upgrade.disabled=max||s.credits<cost;fields.upgrade.classList.toggle('affordable',!fields.upgrade.disabled);
  fields.upgradeLabel.textContent=max?'増設完了':`${selected==='mine'?'採掘機':selected==='smelter'?'製錬炉':selected==='press'?'プレス':'ドック'}を増設`;
  fields.upgradeHint.textContent=max?'最大レベルに到達':`${level} → ${level+1}基・能力 +${Math.round(100/level)}%`;
  fields.cost.textContent=max?'MAX':`${n(cost)} C`;
  for(const k of STATIONS){$(`[data-level="${k}"]`).textContent=`Lv.${s.levels[k]}`;$(`[data-station="${k}"]`).setAttribute('aria-pressed',String(k===selected));}
 }
 function select(station:Station){selected=station;update();host.dispatchEvent(new CustomEvent('station-select',{detail:station,bubbles:true}));}
 function showHelp(show:boolean){$('[data-help-panel]').hidden=!show;if(show)$('[data-help-close]').focus();else $('[data-help]').focus();}
 const click=(event:Event)=>{const button=(event.target as HTMLElement).closest('button');if(!button)return;const station=button.getAttribute('data-station') as Station|null;if(station)select(station);if(button.hasAttribute('data-upgrade')){onUpgrade(selected);update();}if(button.hasAttribute('data-help'))showHelp(true);if(button.hasAttribute('data-help-close'))showHelp(false);};
 const keydown=(e:KeyboardEvent)=>{if(e.key==='Escape')showHelp(false);if(e.key==='Tab'&&!$('[data-help-panel]').hidden){const focusables=Array.from($('[data-help-panel]').querySelectorAll<HTMLButtonElement>('button'));const first=focusables[0],last=focusables.at(-1)!;if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
 host.addEventListener('click',click);host.addEventListener('keydown',keydown);update();
 return {update,select,getSelected:()=>selected,notify(text:string){const t=$('.toast');clearTimeout(toastTimeout);t.textContent=text;t.hidden=false;toastTimeout=setTimeout(()=>{t.hidden=true;},4500);},setSaveStatus(text:string){$('[data-saved]').textContent=text;},dispose(){clearTimeout(toastTimeout);host.removeEventListener('click',click);host.removeEventListener('keydown',keydown);host.innerHTML='';}};
}
