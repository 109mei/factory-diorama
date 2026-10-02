import {STATIONS,MAX_LEVEL,ITEM_VALUES,isStationUnlocked,nextUnlock,unlockCost,stationStats,upgradeCost,type GameState,type Station} from './simulation';
export const STATION_INFO:Record<Station,{name:string;short:string;en:string;description:string;icon:string}>={
 mine:{name:'採掘場',short:'採掘',en:'EXTRACT',description:'鉱脈 → 原石',icon:'⛏'},
 crusher:{name:'破砕機',short:'破砕',en:'CRUSH',description:'原石 → 砕石',icon:'◇'},
 sorter:{name:'選別ドラム',short:'選別',en:'SORT',description:'砕石 → 選鉱石',icon:'⌁'},
 smelter:{name:'製錬炉',short:'製錬',en:'SMELT',description:'選鉱石 → インゴット',icon:'♨'},
 press:{name:'成形プレス',short:'成形',en:'FORM',description:'インゴット → 精密部品',icon:'⚙'},
 packer:{name:'梱包ライン',short:'梱包',en:'PACK',description:'精密部品 → 製品箱',icon:'▣'},
 shipping:{name:'出荷ドック',short:'出荷',en:'DISPATCH',description:'完成品 → クレジット',icon:'↗'}
};
const n=(v:number)=>v.toLocaleString('ja-JP');
const compact=(v:number)=>v>=1e8?`${(v/1e8).toFixed(1)}億`:v>=1e4?`${(v/1e4).toFixed(1)}万`:n(v);
export function createUI(host:HTMLElement,getState:()=>GameState,onUpgrade:(station:Station)=>void){
 let selected:Station='mine',toastTimeout:ReturnType<typeof setTimeout>;
 host.innerHTML=`
 <header class="topbar"><div class="brand"><span class="brand-mark" aria-hidden="true">◈</span><div><span class="eyebrow">MINE LINE / WORKS</span><h1>鉱脈ライン</h1></div></div><div class="wallet"><span class="coin" aria-hidden="true">C</span><strong data-credits>0</strong><small>クレジット</small></div><button class="icon-button help-button" data-help aria-label="遊び方を開く">?</button></header>
 <button class="objective" data-next-process aria-label="次に開放する工程を表示"><span class="objective-dot"></span><span data-goal>次の工程を開放しよう</span><span class="goal-fraction" data-goal-progress>0 / 40</span><span class="goal-track"><i data-goal-bar></i></span></button>
 <div class="world-caption"><span class="live-dot"></span><span data-runtime>生産ライン稼働中</span><span data-line-count>0個を生産中</span></div>
 <section class="control-deck" aria-label="工場設備の管理"><nav class="station-tabs" aria-label="設備を選ぶ・左右にスクロール">${STATIONS.map((s,i)=>`<button data-station="${s}" class="station-tab" aria-pressed="${i===0}"><span class="tab-index">0${i+1}</span><span class="tab-icon" aria-hidden="true">${STATION_INFO[s].icon}</span><span>${STATION_INFO[s].short}</span><small data-level="${s}">Lv.1</small></button>`).join('')}</nav>
 <div class="machine-detail"><div class="detail-heading"><div><span class="eyebrow" data-detail-en>01 / EXTRACT</span><h2 data-detail-name>採掘場</h2></div><div class="level-pill" data-detail-level>LEVEL 01</div></div>
 <div class="machine-stats"><span><i class="mint-dot"></i><b data-rate>18.8</b><span data-rate-unit> 個/分</span></span><span data-queue>滞留 0個</span><span data-capacity>稼働 1基</span></div>
 <button class="upgrade-button" data-upgrade><span><span class="upgrade-plus">＋</span> <b data-upgrade-label>採掘機を増設</b><small data-upgrade-hint>1 → 2基・能力 +100%</small></span><strong data-cost>20 C</strong></button>
 <div class="bottom-status"><span data-saved>端末に自動保存</span><span>累計出荷 <b data-shipped>0</b> 個</span></div></div></section>
 <div class="toast" role="status" aria-live="polite" hidden></div>
 <div class="help-overlay" data-help-panel hidden><section class="help-panel" role="dialog" aria-modal="true" aria-labelledby="help-title"><button class="icon-button close-help" data-help-close aria-label="遊び方を閉じる">×</button><span class="eyebrow">FROM RAW STONE TO FINISHED GOODS</span><h2 id="help-title">工程が、つながる。</h2><p>最初は採掘と出荷だけの小さな工場。<br>新しい工程を開放すると、製品も価値も育ちます。</p><ol><li><b>出荷でクレジットを集める</b><span>原石は2 C。破砕・選別・製錬・成形・梱包を経ると、製品箱は32 Cに。</span></li><li><b>増設と新工程を選ぼう</b><span>下の設備一覧は左右にスクロールできます。選ぶとカメラが近くへ。上の目標を押すと次の工程へ。</span></li><li><b>工場全体を眺める</b><span>「全景」で全体表示へ。荷物が溜まる工程を増設すると、生産量が増えます。</span></li></ol><p class="help-note">全7工程・各設備は最大6基。新しい工程を通った製品だけ価値が上がります。<br>保存はこのブラウザ内。離席中は最大30分ぶん進みます。ブラウザのデータを消すと進行も消えます。</p><button class="help-done" data-help-close>工場へ戻る →</button></section></div>`;
 const $=<T extends HTMLElement=HTMLElement>(q:string)=>host.querySelector<T>(q)!;
 const fields={credits:$('[data-credits]'),goal:$('[data-goal]'),goalProgress:$('[data-goal-progress]'),goalBar:$('[data-goal-bar]'),lineCount:$('[data-line-count]'),detailEn:$('[data-detail-en]'),detailName:$('[data-detail-name]'),detailLevel:$('[data-detail-level]'),rate:$('[data-rate]'),rateUnit:$('[data-rate-unit]'),queue:$('[data-queue]'),capacity:$('[data-capacity]'),upgrade:$<HTMLButtonElement>('[data-upgrade]'),upgradeLabel:$('[data-upgrade-label]'),upgradeHint:$('[data-upgrade-hint]'),cost:$('[data-cost]'),shipped:$('[data-shipped]')};
 function update(){
  const s=getState(),info=STATION_INFO[selected],available=isStationUnlocked(s,selected),next=nextUnlock(s),isNext=next===selected,stats=stationStats(s,selected),level=s.levels[selected],cost=available?upgradeCost(s,selected):isNext?unlockCost(s):0,max=available&&level>=MAX_LEVEL;
  fields.credits.textContent=compact(s.credits);fields.credits.setAttribute('aria-label',`${n(s.credits)} クレジット`);fields.credits.title=n(s.credits);fields.shipped.textContent=n(s.shipped);fields.lineCount.textContent=`${s.items.length}個を生産中`;
  const total=STATIONS.reduce((v,k)=>v+s.levels[k]-1,0),target=next?unlockCost(s):35,progress=next?Math.min(target,s.credits):total;
  fields.goal.textContent=next?`${STATION_INFO[next].short}を開放 · ${ITEM_VALUES[s.unlocked]} → ${ITEM_VALUES[s.unlocked+1]} C/個`:total>=35?'全7工程・全設備の増設が完成！':'全7工程が稼働中 · 設備を増やそう';fields.goalProgress.textContent=`${n(progress)} / ${n(target)}`;fields.goalBar.style.width=`${Math.min(100,progress/target*100)}%`;
  fields.detailEn.textContent=`0${STATIONS.indexOf(selected)+1} / ${info.en}`;fields.detailName.textContent=info.name;fields.detailLevel.textContent=available?`LEVEL 0${level}`:isNext?'NEW PROCESS':'LOCKED';
  fields.rate.textContent=available?stats.perMinute.toFixed(1):String(ITEM_VALUES[Math.min(5,STATIONS.indexOf(selected))]);fields.rateUnit.textContent=available?' 個/分':' C/個';fields.queue.textContent=available?`滞留 ${stats.queued}個`:info.description;fields.queue.classList.toggle('has-queue',available&&stats.queued>0);fields.capacity.textContent=available?`稼働 ${level}基`:isNext?'新工程':'前の工程が必要';
  fields.upgrade.disabled=max||(!available&&!isNext)||s.credits<cost;fields.upgrade.classList.toggle('affordable',!fields.upgrade.disabled);
  fields.upgradeLabel.textContent=available?(max?'増設完了':`${selected==='mine'?'採掘機':info.short}を増設`):isNext?`${info.short}工程を開放`:'前の工程を開放しよう';
  fields.upgradeHint.textContent=available?(max?'最大レベルに到達':`${level} → ${level+1}基・能力 +${Math.round(100/level)}%`):info.description;
  fields.cost.textContent=max?'MAX':available||isNext?`${n(cost)} C`:'—';
  for(const k of STATIONS){const open=isStationUnlocked(s,k),button=$(`[data-station="${k}"]`);$(`[data-level="${k}"]`).textContent=open?`Lv.${s.levels[k]}`:k===next?'開放できる':'未開放';button.setAttribute('aria-pressed',String(k===selected));button.classList.toggle('locked',!open);button.classList.toggle('next-process',k===next);}
 }
 function select(station:Station){selected=station;update();$(`[data-station="${station}"]`).scrollIntoView?.({block:'nearest',inline:'center',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});host.dispatchEvent(new CustomEvent('station-select',{detail:station,bubbles:true}));}
 function showHelp(show:boolean){$('[data-help-panel]').hidden=!show;if(show)$('[data-help-close]').focus();else $('[data-help]').focus();}
 const click=(event:Event)=>{const button=(event.target as HTMLElement).closest('button');if(!button)return;const station=button.getAttribute('data-station') as Station|null;if(station)select(station);if(button.hasAttribute('data-next-process')){const next=nextUnlock(getState());if(next)select(next);}if(button.hasAttribute('data-upgrade')){onUpgrade(selected);update();}if(button.hasAttribute('data-help'))showHelp(true);if(button.hasAttribute('data-help-close'))showHelp(false);};
 const keydown=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!$('[data-help-panel]').hidden)showHelp(false);if(e.key==='Tab'&&!$('[data-help-panel]').hidden){const buttons=Array.from($('[data-help-panel]').querySelectorAll<HTMLButtonElement>('button')),first=buttons[0],last=buttons.at(-1)!;if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
 host.addEventListener('click',click);host.addEventListener('keydown',keydown);update();
 return {setRuntimeStatus(ready:boolean){$('[data-runtime]').textContent=ready?'生産ライン稼働中':'3D表示停止中';$('.world-caption').classList.toggle('is-paused',!ready);},update,select,getSelected:()=>selected,notify(text:string){const t=$('.toast');clearTimeout(toastTimeout);t.textContent=text;t.hidden=false;toastTimeout=setTimeout(()=>{t.hidden=true;},4500);},setSaveStatus(text:string){$('[data-saved]').textContent=text;},dispose(){clearTimeout(toastTimeout);host.removeEventListener('click',click);host.removeEventListener('keydown',keydown);host.innerHTML='';}};
}
