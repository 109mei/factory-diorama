// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
it('does not force the app taller than a short landscape viewport',()=>{
 const style=document.createElement('style');style.textContent=readFileSync(resolve(process.cwd(),'src/style.css'),'utf8');document.head.appendChild(style);
 const app=document.createElement('main');app.id='app';document.body.appendChild(app);
 // Static layout invariant: an overflow-hidden page must not force a 420px floor.
 expect(parseFloat(getComputedStyle(app).minHeight)||0).toBe(0);
 app.remove();style.remove();
});
it('keeps objective offsets below the device top safe area',()=>{
 const style=document.createElement('style');style.textContent=readFileSync(resolve(process.cwd(),'src/style.css'),'utf8').replaceAll('env(safe-area-inset-top)','44px');document.head.appendChild(style);
 const objective=document.createElement('button');objective.className='objective';document.body.append(objective);expect(Number(getComputedStyle(objective).top.replace(/[^0-9.]/g,''))).toBe(120);objective.remove();style.remove();
});
