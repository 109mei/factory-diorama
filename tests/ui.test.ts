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
