// @vitest-environment jsdom
import {describe,it,expect} from 'vitest';
import {createGame,buyUpgrade} from '../src/simulation';
import {createUI} from '../src/ui';
describe('portrait HUD',()=>{
 it('disables an unaffordable upgrade and enables it with enough credits',()=>{const host=document.createElement('div'),s=createGame(),ui=createUI(host,()=>s,k=>buyUpgrade(s,k));ui.update();expect((host.querySelector('[data-upgrade]') as HTMLButtonElement).disabled).toBe(true);s.credits=20;ui.update();expect((host.querySelector('[data-upgrade]') as HTMLButtonElement).disabled).toBe(false);ui.dispose();});
 it('selects the station and shows its own upgrade details',()=>{const host=document.createElement('div'),s=createGame(),ui=createUI(host,()=>s,k=>buyUpgrade(s,k));(host.querySelector('[data-station="smelter"]') as HTMLButtonElement).click();expect(host.querySelector('[data-detail-name]')?.textContent).toBe('製錬炉');expect(ui.getSelected()).toBe('smelter');ui.dispose();});
 it('cannot overspend when the buy control is clicked repeatedly',()=>{const host=document.createElement('div'),s=createGame();s.credits=20;const ui=createUI(host,()=>s,k=>buyUpgrade(s,k));ui.update();const button=host.querySelector('[data-upgrade]') as HTMLButtonElement;for(let i=0;i<20;i++)button.click();expect(s.credits).toBe(0);expect(s.levels.mine).toBe(2);ui.dispose();});
 it('keeps help closed until asked and allows closing it',()=>{const host=document.createElement('div'),s=createGame(),ui=createUI(host,()=>s,()=>{});expect((host.querySelector('[data-help-panel]') as HTMLElement).hidden).toBe(true);(host.querySelector('[data-help]') as HTMLButtonElement).click();expect((host.querySelector('[data-help-panel]') as HTMLElement).hidden).toBe(false);(host.querySelector('[data-help-close]') as HTMLButtonElement).click();expect((host.querySelector('[data-help-panel]') as HTMLElement).hidden).toBe(true);ui.dispose();});
});
it('announces a paused renderer instead of claiming production is running when initialization fails',()=>{
 const host=document.createElement('div'),s=createGame(),ui=createUI(host,()=>s,()=>{});
 ui.setRuntimeStatus(false);expect(host.querySelector('.world-caption')?.textContent).toContain('3D表示停止中');
 ui.setRuntimeStatus(true);expect(host.querySelector('.world-caption')?.textContent).toContain('生産ライン稼働中');ui.dispose();
});
it('offers all seven processes without shrinking their touch controls and directs the next expansion',()=>{
 const host=document.createElement('div'),s=createGame(),ui=createUI(host,()=>s,()=>{});
 expect(host.querySelectorAll('[data-station]').length).toBe(7);
 (host.querySelector('[data-next-process]') as HTMLButtonElement).click();
 expect(ui.getSelected()).toBe('crusher');expect(host.querySelector('[data-upgrade-label]')?.textContent).toContain('開放');ui.dispose();
});
it('celebrates a fully expanded factory instead of requesting impossible upgrades',()=>{
 const host=document.createElement('div'),s=createGame();s.unlocked=5;for(const station of Object.keys(s.levels) as (keyof typeof s.levels)[])s.levels[station]=6;
 const ui=createUI(host,()=>s,()=>{});expect(host.querySelector('[data-goal]')?.textContent).toContain('完成');ui.dispose();
});
it.each([1000000,123456789,1000000000000])('keeps balance %s compact while retaining its exact accessible amount',balance=>{
 const host=document.createElement('div'),s=createGame();s.credits=balance;const ui=createUI(host,()=>s,()=>{});const value=host.querySelector('[data-credits]')!;expect(value.textContent!.length).toBeLessThanOrEqual(7);expect(value.getAttribute('aria-label')).toContain(balance.toLocaleString('ja-JP'));ui.dispose();
});
it('requires an explicit sound action and exposes a volume control',()=>{
 const host=document.createElement('div'),s=createGame();let toggles=0,volume=-1;const ui=createUI(host,()=>s,()=>{},{toggle:()=>{toggles++;},volume:v=>{volume=v;}});
 expect(toggles).toBe(0);(host.querySelector('[data-sound]') as HTMLButtonElement).click();expect(toggles).toBe(1);
 const input=host.querySelector('[data-volume]') as HTMLInputElement;input.value='30';input.dispatchEvent(new Event('input',{bubbles:true}));expect(volume).toBe(.3);ui.dispose();
});
it('shows waiting/unavailable sound truthfully without claiming playback',()=>{
 const host=document.createElement('div'),s=createGame(),ui=createUI(host,()=>s,()=>{});
 ui.setSoundState({preferences:{enabled:true,volume:.25},status:'waiting'});expect(host.querySelector('[data-sound]')?.getAttribute('aria-label')).toContain('待機');
 ui.setSoundState({preferences:{enabled:true,volume:.25},status:'starting'});expect(host.querySelector('[data-sound-status]')?.textContent).toContain('開始');
 ui.setSoundState({preferences:{enabled:true,volume:.25},status:'unavailable'});expect(host.querySelector('[data-sound-status]')?.textContent).toContain('利用できません');ui.dispose();
});
