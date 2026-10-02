// @vitest-environment jsdom
import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
it('embeds the real same-origin game and changes its actual viewport dimensions',()=>{
 const html=readFileSync(resolve(process.cwd(),'public/qa.html'),'utf8');
 const parsed=new DOMParser().parseFromString(html,'text/html');document.body.innerHTML=parsed.body.innerHTML;
 const iframe=document.querySelector('iframe')!;
 expect(iframe.getAttribute('src')).toBe('./');
 const source=parsed.querySelector('script')?.textContent??'';
 Function(source)(); // Execute only this repository's own inline QA controller.
 const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>('[data-size]'));
 expect(buttons.length).toBe(3);
 for(const [i,[width,height]] of [[390,844],[320,568],[844,390]].entries()){
  buttons[i].click();expect(iframe.style.width).toBe(`${width}px`);expect(iframe.style.height).toBe(`${height}px`);expect(buttons[i].getAttribute('aria-pressed')).toBe('true');
 }
});
